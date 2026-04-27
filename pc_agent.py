#!/usr/bin/env python3
"""
PC Monitor Agent v2 - Full hardware monitoring.

End users get this as a single-file binary built with PyInstaller — see
build/pc-agent.spec and .github/workflows/build-agent.yml. They just
double-click pc-agent.exe (Windows) or pc-agent (macOS) and it starts
listening on port 8765.

Hardware sensors come from LibreHardwareMonitor (bundled DLL, called via
pythonnet) when running on Windows. If LHM cannot initialise (DLL missing,
.NET runtime broken, kernel driver refused) we silently fall back to
reading HWiNFO64's shared-memory block, so a power user with HWiNFO64
already running keeps working.

Developers can also run from source:
  python -m pip install psutil flask flask-cors
  python -m pip install pythonnet      # Windows only, for the LHM path
  python pc_agent.py                   (auto-elevates to admin on Windows via UAC)
"""
import os, platform, subprocess, time, socket, re, ctypes, sys, math
import psutil
from flask import Flask, jsonify, request
from flask_cors import CORS

IS_WINDOWS = platform.system() == "Windows"
IS_MAC = platform.system() == "Darwin"
# True when running inside a PyInstaller bundle (sys.executable is the .exe).
IS_FROZEN = getattr(sys, "frozen", False)

# Every subprocess.run / Popen call from a windowed PyInstaller .exe (our
# Windows release config — see build/pc-agent.spec, console=False) flashes
# a brief cmd / conhost console window unless we explicitly pass
# CREATE_NO_WINDOW. Because the agent polls metrics roughly once per second
# and each metrics handler shells out to nvidia-smi / wmic / etc., the
# user sees a continuous flicker of black windows on their desktop. This
# kwarg dict gets splatted into every subprocess call below; on macOS /
# Linux it's empty so the calls are unchanged. CREATE_NO_WINDOW is a
# Windows-only flag (0x08000000); we use the literal so this module still
# imports on non-Windows where subprocess.CREATE_NO_WINDOW doesn't exist.
_NO_WINDOW_KW = {"creationflags": 0x08000000} if IS_WINDOWS else {}

# Agent version reported via /version and embedded in /metrics responses so
# the mobile app can show users which build is running and surface an
# "update available" hint when a newer GitHub release exists.
# Bump on every release tag — and the CI build pipeline
# (.github/workflows/build-agent.yml) rewrites this string at build time to
# match the pushed git tag, so it can never drift from the published release.
AGENT_VERSION = "0.1.0"

# ── Auto-elevate to admin on Windows ────────────────────────────────────────
def _ensure_admin():
    if not IS_WINDOWS:
        return
    try:
        already_admin = ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        already_admin = False
    if not already_admin:
        # Re-launch this process with UAC elevation and exit the current one.
        # When frozen by PyInstaller, sys.executable IS the agent binary and
        # sys.argv[0] is also that binary path — so we must skip argv[0],
        # otherwise the elevated process gets the exe path as its first arg.
        # When running as a plain .py script, sys.executable is python.exe
        # and sys.argv[0] is the script path (a real argument we must keep).
        argv_to_forward = sys.argv[1:] if IS_FROZEN else sys.argv
        params = " ".join(f'"{a}"' for a in argv_to_forward)
        ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, params, None, 1)
        sys.exit(0)

_ensure_admin()
# ── End admin elevation ──────────────────────────────────────────────────────

# ── Windowed-mode stdio redirect (must run before any module-level print) ──
# When PyInstaller builds with `console=False` (our Windows release config —
# see build/pc-agent.spec), `sys.stdout` and `sys.stderr` are not attached
# to anything and every `print()` raises AttributeError. Several module-load
# `print()` calls below (the "Initialising hardware info..." banner, the
# CPU/GPU lines, LHM init failure messages, the tray-deps-missing fallback)
# would crash before `__main__` ever runs. Redirect both streams to a
# per-user log file IMMEDIATELY so those prints succeed AND the user has a
# tail-able diagnostic file at %LOCALAPPDATA%\PCMonitorAgent\agent.log
# (also exposed via the tray's "Show log file" menu item).
_log_path: "str | None" = None
def _redirect_stdio_to_logfile() -> None:
    global _log_path
    if not (IS_WINDOWS and IS_FROZEN):
        # Console mode (running from source, or macOS / Linux build) — keep
        # the real stdout so developers see startup output in their terminal.
        return
    try:
        log_dir = os.path.join(
            os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
            "PCMonitorAgent",
        )
        os.makedirs(log_dir, exist_ok=True)
        _log_path = os.path.join(log_dir, "agent.log")
        # buffering=1 -> line-buffered so `Get-Content -Wait agent.log`
        # streams logs as they happen, and crashes are flushed promptly.
        f = open(_log_path, "a", buffering=1, encoding="utf-8", errors="replace")
        sys.stdout = f
        sys.stderr = f
        print(f"\n=== PC Monitor Agent {AGENT_VERSION} starting at "
              f"{time.strftime('%Y-%m-%d %H:%M:%S')} ===")
    except Exception:
        # Even if we can't open the log file, replace None stdout with an
        # in-memory sink so subsequent print() calls don't crash. Better to
        # lose logs than to crash before the tray icon appears.
        import io
        sys.stdout = sys.stdout or io.StringIO()
        sys.stderr = sys.stderr or io.StringIO()
_redirect_stdio_to_logfile()

app = Flask(__name__)
CORS(app)

API_KEY = os.environ.get("PC_AGENT_KEY", "")
PORT = int(os.environ.get("PC_AGENT_PORT", 8765))

# ── Module-level state ──────────────────────────────────────────────────────
_prev_net_io = {}
_prev_disk_io = {}
_prev_time = time.time()

# Warm up cpu_percent (first call always returns 0)
psutil.cpu_percent(percpu=True)

# Cache slow one-time queries at startup so metrics endpoint stays fast
def _init_cpu_name():
    if IS_WINDOWS:
        # 1) Registry — most reliable on all Windows versions
        try:
            import winreg
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
            name = winreg.QueryValueEx(key, "ProcessorNameString")[0].strip()
            winreg.CloseKey(key)
            if name:
                return name
        except Exception:
            pass
        # 2) PowerShell CIM (works on Windows 10/11 where wmic is deprecated)
        try:
            r = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "(Get-CimInstance Win32_Processor).Name"],
                capture_output=True, text=True, timeout=8, **_NO_WINDOW_KW)
            name = r.stdout.strip()
            if name:
                return name
        except Exception:
            pass
        # 3) wmic legacy fallback
        try:
            r = subprocess.run(["wmic", "cpu", "get", "name"],
                               capture_output=True, text=True, timeout=5,
                               **_NO_WINDOW_KW)
            lines = [l.strip() for l in r.stdout.splitlines()
                     if l.strip() and l.strip().lower() != "name"]
            if lines:
                return lines[0]
        except Exception:
            pass
    return platform.processor() or "Unknown CPU"

def _init_gpu_names():
    """Return list of GPU name strings (queried once at startup)."""
    try:
        r = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=8, **_NO_WINDOW_KW
        )
        if r.returncode == 0:
            return [l.strip() for l in r.stdout.strip().splitlines() if l.strip()]
    except Exception:
        pass
    if IS_WINDOWS:
        try:
            r = subprocess.run(
                ["wmic", "path", "win32_videocontroller", "get", "name"],
                capture_output=True, text=True, timeout=5, **_NO_WINDOW_KW
            )
            lines = [l.strip() for l in r.stdout.splitlines()
                     if l.strip() and l.strip().lower() != "name"]
            return lines
        except Exception:
            pass
    return []

print("Initialising hardware info (first run may take a few seconds)...")
_CPU_NAME = _init_cpu_name()
_GPU_NAMES = _init_gpu_names()
print(f"CPU: {_CPU_NAME}")
print(f"GPU(s): {_GPU_NAMES or 'none detected'}")

def check_key():
    if API_KEY and request.headers.get("X-API-Key") != API_KEY:
        return jsonify({"error": "Unauthorized"}), 401

def open_firewall_port(port):
    if not IS_WINDOWS:
        return
    rule_name = f"PC Agent Port {port}"
    try:
        subprocess.run(
            ["netsh", "advfirewall", "firewall", "add", "rule",
             f"name={rule_name}", "dir=in", "action=allow",
             "protocol=TCP", f"localport={port}"],
            capture_output=True, check=False, **_NO_WINDOW_KW
        )
        print(f"Firewall rule added for port {port} (or already exists)")
    except Exception as e:
        print(f"Could not add firewall rule: {e}")

# ── LibreHardwareMonitor (preferred sensor source on Windows) ───────────────
# Bundled as LibreHardwareMonitorLib.dll and called via pythonnet. End users
# do not install anything — the DLL ships inside the PyInstaller binary.
_LHM_COMPUTER = None
_LHM_VISITOR = None
_LHM_FAILED = False  # latch True after first failure so we don't retry every poll
# LibreHardwareMonitor's `Computer` object holds .NET/WMI/SMBus state that is
# NOT thread-safe — calling `_LHM_COMPUTER.Accept(_LHM_VISITOR)` from two
# Flask request threads at the same time races the underlying sensor
# enumeration via pythonnet and both threads hang indefinitely. Flask's
# `app.run` defaults to `threaded=True`, so the polling burst from a freshly
# launched mobile client (or from `curl` in a tight loop) reliably reproduces
# the deadlock. Serialize all LHM reads behind a single process-wide lock.
import threading as _threading
_LHM_LOCK = _threading.Lock()

# LHM SensorType enum string -> (our type tag, unit). These match the type
# tags read_hwinfo64() emits, so the rest of the agent (and the mobile app)
# does not care which source the data came from.
_LHM_TYPE_MAP = {
    "Temperature": ("temperature", "\u00b0C"),
    "Voltage":     ("voltage",     "V"),
    "Fan":         ("fan",         "RPM"),
    "Current":     ("current",     "A"),
    "Power":       ("power",       "W"),
    "Clock":       ("clock",       "MHz"),
    "Load":        ("usage",       "%"),
}

def _lhm_dll_dir():
    """Return the directory that should contain LibreHardwareMonitorLib.dll.
    Inside a PyInstaller onefile bundle, datas are unpacked under
    sys._MEIPASS; in dev we look next to this script.
    """
    base = sys._MEIPASS if IS_FROZEN else os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, "vendor")

def _init_lhm():
    """Lazy-init LHM. Returns True on success, False if LHM is unavailable
    (DLL missing, pythonnet not installed, .NET runtime broken, etc.)."""
    global _LHM_COMPUTER, _LHM_VISITOR
    if not IS_WINDOWS:
        return False

    dll_dir = _lhm_dll_dir()
    dll_path = os.path.join(dll_dir, "LibreHardwareMonitorLib.dll")
    if not os.path.exists(dll_path):
        print(f"LibreHardwareMonitor: DLL not found at {dll_path}")
        return False

    # net472 LHM build needs the .NET Framework runtime, not modern .NET.
    # Set this BEFORE importing pythonnet/clr.
    os.environ.setdefault("PYTHONNET_RUNTIME", "netfx")
    # Make sure HidSharp.dll and other side-by-side deps resolve.
    os.environ["PATH"] = dll_dir + os.pathsep + os.environ.get("PATH", "")

    import clr  # type: ignore  # provided by pythonnet
    clr.AddReference(dll_path)

    from LibreHardwareMonitor.Hardware import Computer, IVisitor  # type: ignore

    class _UpdateVisitor(IVisitor):  # type: ignore[misc]
        # pythonnet requires __namespace__ when implementing a .NET interface.
        __namespace__ = "PCAgent"
        def VisitComputer(self, computer):
            computer.Traverse(self)
        def VisitHardware(self, hardware):
            hardware.Update()
            for sub in hardware.SubHardware:
                sub.Accept(self)
        def VisitSensor(self, sensor):
            pass
        def VisitParameter(self, parameter):
            pass

    computer = Computer()
    computer.IsCpuEnabled = True
    computer.IsGpuEnabled = True
    computer.IsMemoryEnabled = True
    computer.IsMotherboardEnabled = True
    computer.IsControllerEnabled = True
    computer.IsStorageEnabled = True
    # Network counters come from psutil — no need to pay LHM's overhead for them.
    computer.IsNetworkEnabled = False
    computer.Open()

    _LHM_COMPUTER = computer
    _LHM_VISITOR = _UpdateVisitor()
    print("LibreHardwareMonitor: initialised, sensors active")
    return True

def read_lhm():
    """Read sensor data from LibreHardwareMonitor. Returns the same dict
    shape as read_hwinfo64() — {temps, fans, sensors} — or None if LHM is
    not usable on this machine (silent fallback then takes over)."""
    global _LHM_COMPUTER, _LHM_VISITOR, _LHM_FAILED
    if _LHM_FAILED or not IS_WINDOWS:
        return None
    if _LHM_COMPUTER is None:
        try:
            if not _init_lhm():
                _LHM_FAILED = True
                return None
        except Exception as e:
            _LHM_FAILED = True
            print(f"LibreHardwareMonitor init failed: {e}; falling back to HWiNFO64 if available")
            return None

    # Serialize LHM enumeration across all Flask request threads — see the
    # comment on _LHM_LOCK above. The lock covers the full Accept + walk so
    # the visitor's intermediate state can't be observed by a second thread.
    try:
        with _LHM_LOCK:
            _LHM_COMPUTER.Accept(_LHM_VISITOR)
            temps, fans, sensors = [], [], []
            fan_counter = [0]

            def _walk(hw, comp_name):
                for sensor in hw.Sensors:
                    stype = str(sensor.SensorType)
                    mapping = _LHM_TYPE_MAP.get(stype)
                    if not mapping:
                        continue  # skip Frequency, Control, Throughput, etc.
                    kind, unit = mapping
                    v = sensor.Value
                    if v is None:
                        continue
                    try:
                        value = float(v)
                    except (TypeError, ValueError):
                        continue
                    label = str(sensor.Name) or ""
                    if not label and kind == "fan":
                        fan_counter[0] += 1
                        label = f"Fan #{fan_counter[0]}"
                    if not label:
                        continue
                    sensors.append({
                        "label": label,
                        "value": round(value, 3),
                        "unit": unit,
                        "type": kind,
                        "component": comp_name,
                    })
                    if kind == "temperature":
                        temps.append({"label": label, "value": round(value, 1)})
                    elif kind == "fan":
                        fans.append({"label": label, "rpm": round(value)})
                for sub in hw.SubHardware:
                    _walk(sub, f"{comp_name} / {str(sub.Name)}")

            for hardware in _LHM_COMPUTER.Hardware:
                _walk(hardware, str(hardware.Name))

            return {"temps": temps, "fans": fans, "sensors": sensors}
    except Exception as e:
        # Latch the failure so we don't keep paying the exception cost on every
        # poll — the HWiNFO64 fallback (if available) will take over for the
        # rest of the agent's lifetime.
        _LHM_FAILED = True
        print(f"LibreHardwareMonitor read error: {e}; falling back to HWiNFO64 if available")
        return None

def read_sensors():
    """Try LibreHardwareMonitor first, fall back to HWiNFO64 shared memory.
    Returns {temps, fans, sensors} or None if neither source is available.
    """
    data = read_lhm()
    if data is not None:
        return data
    return read_hwinfo64()

def read_hwinfo64():
    """Read sensor data from HWiNFO64 shared memory (Windows only).
    HWiNFO64 must be running with 'Shared Memory Support' enabled:
    HWiNFO64 -> Settings -> HWiNFO64 -> check 'Shared Memory Support'.
    Returns dict with 'temps' and 'fans', or None if unavailable.

    NOTE: this is now the silent fallback path — bundled LibreHardwareMonitor
    is tried first. Kept for users who already have HWiNFO64 running and want
    the agent to use it if LHM ever fails.
    """
    if not IS_WINDOWS:
        return None
    try:
        import ctypes, struct
        HWINFO_SM2_KEY = "Global\\HWiNFO_SENS_SM2"
        FILE_MAP_READ = 0x0004
        k32 = ctypes.windll.kernel32
        # Set correct return types so 64-bit pointers aren't truncated
        k32.OpenFileMappingW.restype = ctypes.c_void_p
        k32.OpenFileMappingW.argtypes = [ctypes.c_ulong, ctypes.c_int, ctypes.c_wchar_p]
        k32.MapViewOfFile.restype = ctypes.c_void_p
        k32.MapViewOfFile.argtypes = [ctypes.c_void_p, ctypes.c_ulong,
                                       ctypes.c_ulong, ctypes.c_ulong, ctypes.c_size_t]
        k32.UnmapViewOfFile.argtypes = [ctypes.c_void_p]
        k32.CloseHandle.argtypes = [ctypes.c_void_p]
        handle = k32.OpenFileMappingW(FILE_MAP_READ, 0, HWINFO_SM2_KEY)
        if not handle:
            err = ctypes.GetLastError()
            print(f"HWiNFO64: shared memory not found (OpenFileMappingW=0, err={err}). "
                  "Make sure HWiNFO64 is running with Shared Memory Support enabled and was restarted.")
            return None
        hdr_size = 88
        ptr = k32.MapViewOfFile(handle, FILE_MAP_READ, 0, 0, hdr_size)
        if not ptr:
            k32.CloseHandle(handle)
            return None
        hdr = bytes((ctypes.c_byte * hdr_size).from_address(ptr))
        k32.UnmapViewOfFile(ptr)
        sig = struct.unpack_from('<I', hdr, 0)[0]
        # Accept both legacy (0x12345678) and newer HWiNFO64 v7+ ('HWiS' = 0x53695748) signatures
        VALID_SIGS = {0x12345678, 0x53695748}
        if sig not in VALID_SIGS:
            k32.CloseHandle(handle)
            print(f"HWiNFO64: unknown signature {hex(sig)}, skipping")
            return None
        off_sensors, size_sensor, num_sensors = struct.unpack_from('<III', hdr, 20)
        off_readings, size_reading, num_readings = struct.unpack_from('<III', hdr, 32)
        # Guard against corrupt header values
        if size_reading == 0 or num_readings > 50000:
            k32.CloseHandle(handle)
            return None
        total = off_readings + size_reading * num_readings + 4096
        ptr = k32.MapViewOfFile(handle, FILE_MAP_READ, 0, 0, total)
        if not ptr:
            k32.CloseHandle(handle)
            return None
        data = bytes((ctypes.c_byte * total).from_address(ptr))
        k32.UnmapViewOfFile(ptr)
        k32.CloseHandle(handle)

        # Detect element format from size_reading:
        # Old HWiNFO64 (<=v6):  WCHAR[128] labels  → 256 bytes each, total ~588
        # New HWiNFO64 (v7+):   CHAR[128]  labels  → 128 bytes each, total ~316
        # If ambiguous, auto-detect from whether odd bytes are null (UTF-16-LE) or not (ASCII)
        if size_reading >= 500:
            LBL_BYTES = 256; VAL_OFF_BASE = 12 + 256 + 256 + 32   # = 556
        elif size_reading >= 280:
            LBL_BYTES = 128; VAL_OFF_BASE = 12 + 128 + 128 + 16   # = 284
        else:
            LBL_BYTES = 256; VAL_OFF_BASE = 12 + 256 + 256 + 32   # fallback

        def _label(raw):
            """Decode label: byte[1]==0 means UTF-16-LE (ASCII stored wide), else Latin-1."""
            if len(raw) < 2 or raw[0] == 0:
                return ""
            if raw[1] == 0:
                # High byte of first char is null → UTF-16-LE (old HWiNFO format)
                s = raw.decode('utf-16-le', errors='ignore')
                cut = s.find('\x00')
                return (s[:cut] if cut >= 0 else s).strip()
            # Non-null second byte → ASCII / Latin-1 (new HWiNFO v7+ format)
            cut = raw.find(b'\x00')
            return (raw[:cut] if cut >= 0 else raw).decode('latin-1').strip()

        # All HWiNFO64 sensor reading types and their units
        RTYPE_UNIT = {0:"",1:"°C",2:"V",3:"RPM",4:"A",5:"W",6:"MHz",7:"%",8:""}
        RTYPE_NAME = {0:"other",1:"temperature",2:"voltage",3:"fan",
                      4:"current",5:"power",6:"clock",7:"usage",8:"other"}

        # Parse hardware component names from the sensor section.
        # HWINFO sensor element layout: [dwSensorID:4][dwSensorInst:4][nameOrig:LBL][nameUser:LBL]
        component_names = {}
        for si in range(num_sensors):
            s_base = off_sensors + si * size_sensor
            if s_base + size_sensor > len(data):
                break
            s_orig = _label(data[s_base+8 : s_base+8+LBL_BYTES])
            s_user = _label(data[s_base+8+LBL_BYTES : s_base+8+LBL_BYTES+LBL_BYTES])
            component_names[si] = s_user if s_user else s_orig
        print(f"HWiNFO64: {len(component_names)} hardware components: "
              f"{list(component_names.values())[:4]}")

        # Parse all readings and link each to its hardware component.
        # Reading layout: [type:4][sensorIndex:4][readingID:4][labelOrig:LBL][labelUser:LBL][unit:*][value:8]...
        TEMP, FAN = 1, 3
        temps, fans, sensors = [], [], []
        fan_counter = [0]
        for i in range(num_readings):
            base = off_readings + i * size_reading
            if base + size_reading > len(data):
                break
            r_type = struct.unpack_from('<I', data, base)[0]
            if r_type not in RTYPE_UNIT:
                continue
            sensor_idx = struct.unpack_from('<I', data, base+4)[0]
            orig = _label(data[base+12 : base+12+LBL_BYTES])
            user = _label(data[base+12+LBL_BYTES : base+12+LBL_BYTES+LBL_BYTES])
            label = user if user else orig
            val_off = base + VAL_OFF_BASE
            if val_off + 8 > len(data):
                continue
            value = struct.unpack_from('<d', data, val_off)[0]
            # Generate fallback label for fan readings with empty labels
            if not label:
                if r_type == FAN:
                    fan_counter[0] += 1
                    label = f"Fan #{fan_counter[0]}"
                else:
                    continue
            component = component_names.get(sensor_idx, "Unknown")
            sensors.append({
                "label": label,
                "value": round(value, 3),
                "unit": RTYPE_UNIT[r_type],
                "type": RTYPE_NAME[r_type],
                "component": component,
            })
            if r_type == TEMP:
                temps.append({"label": label, "value": round(value, 1)})
            elif r_type == FAN:
                fans.append({"label": label, "rpm": round(value)})
        print(f"HWiNFO64: {num_readings} readings, {len(sensors)} sensors "
              f"({len(temps)} temps, {len(fans)} fans)")
        return {"temps": temps, "fans": fans, "sensors": sensors}
    except Exception as e:
        print(f"HWiNFO64 read error: {e}")
        import traceback; traceback.print_exc()
        return None

def get_cpu_temp_hwinfo(hwinfo_data):
    """Extract CPU package temperature from HWiNFO64 data."""
    if not hwinfo_data or not hwinfo_data.get("temps"):
        return None
    temps = hwinfo_data["temps"]
    for priority in ["CPU Package", "CPU (Tctl/Tdie)", "Core (Tdie)", "CPU Tctl", "CPU"]:
        for t in temps:
            if priority.lower() in t["label"].lower():
                return t["value"]
    return None

def get_cpu_info(hwinfo_data=None):
    try:
        name = _CPU_NAME  # Cached at startup — no subprocess on every request
        freq = psutil.cpu_freq()
        cores_logical = psutil.cpu_count(logical=True) or 1
        cores_physical = psutil.cpu_count(logical=False) or 1
        per_core = psutil.cpu_percent(percpu=True)
        usage_total = round(sum(per_core) / len(per_core), 1) if per_core else 0

        # Prefer LHM / HWiNFO64 load sensors over psutil when available.
        # psutil.cpu_percent() can read near-zero on Windows with P+E core CPUs because
        # Windows' performance counter diverges from actual hardware load in certain
        # parking states. LHM reads directly from MSR/hardware and is more accurate.
        if hwinfo_data:
            load_sensors = [s for s in (hwinfo_data.get("sensors") or []) if s.get("type") == "usage"]
            # Total
            cpu_total_s = next(
                (s for s in load_sensors
                 if re.search(r"^cpu[\s_-]*total$", s.get("label", ""), re.I)
                 and s.get("value") is not None),
                None
            )
            if cpu_total_s is not None:
                usage_total = round(float(cpu_total_s["value"]), 1)
            # Per-core: "CPU Core #1", "CPU Core #2", … sorted numerically.
            core_load_sensors = sorted(
                [s for s in load_sensors
                 if re.search(r"^cpu\s+core\s+#\d+$", s.get("label", ""), re.I)
                 and s.get("value") is not None],
                key=lambda s: int(re.search(r"\d+", s["label"]).group())
            )
            if core_load_sensors:
                per_core = [round(float(s["value"]), 1) for s in core_load_sensors]

        # Try psutil temps first, then HWiNFO64 (Windows needs HWiNFO64)
        temp = None
        try:
            temps = psutil.sensors_temperatures()
            for key in ["coretemp", "k10temp", "cpu_thermal", "acpitz"]:
                if key in temps and temps[key]:
                    temp = round(max(e.current for e in temps[key]), 1)
                    break
        except Exception:
            pass
        if temp is None:
            temp = get_cpu_temp_hwinfo(hwinfo_data)
        # Try HWiNFO64 clock sensors for real-time current frequency
        # psutil.cpu_freq().current is static on Windows (always shows rated base clock)
        freq_current_mhz = None
        hw_sensors = (hwinfo_data.get("sensors") or []) if hwinfo_data else []
        clock_sensors = [s for s in hw_sensors if s.get("type") == "clock"]
        # 1. Best: average of P-core effective clocks only (excludes slower E-cores)
        p_eff_clocks = [
            s["value"] for s in clock_sensors
            if re.search(r"p-core.*effective", s.get("label", ""), re.I)
        ]
        if p_eff_clocks:
            freq_current_mhz = round(sum(p_eff_clocks) / len(p_eff_clocks))
        else:
            # 2. Average of all effective clocks (includes E-cores, but better than static)
            eff_clocks = [
                s["value"] for s in clock_sensors
                if re.search(r"effective\s+clock", s.get("label", ""), re.I)
            ]
            if eff_clocks:
                freq_current_mhz = round(sum(eff_clocks) / len(eff_clocks))
            else:
                # 3. Average all core clocks: "P-core X Clock", "E-core X Clock", "CPU Core #X Clock"
                core_clocks = [
                    s["value"] for s in clock_sensors
                    if re.search(r"[pe]-core.*clock|cpu.*core.*clock", s.get("label", ""), re.I)
                    and not re.search(r"effective|bus|ring|llc", s.get("label", ""), re.I)
                    and s.get("value", 0) > 500
                ]
                if core_clocks:
                    freq_current_mhz = round(sum(core_clocks) / len(core_clocks))
        # Final fallback: psutil (static base clock on Windows)
        if freq_current_mhz is None:
            freq_current_mhz = round(freq.current) if freq else 0

        # freqMax: highest single-core clock from HWiNFO64 (real boost), fallback to psutil
        max_core_clocks = [
            s["value"] for s in clock_sensors
            if re.search(r"[pe]-core.*clock|cpu.*core.*clock", s.get("label", ""), re.I)
            and not re.search(r"effective|bus|ring|llc", s.get("label", ""), re.I)
            and s.get("value", 0) > 500
        ]
        if max_core_clocks:
            freq_max_mhz = round(max(max_core_clocks))
        else:
            eff_vals = [s["value"] for s in clock_sensors if re.search(r"effective\s+clock", s.get("label", ""), re.I)]
            freq_max_mhz = round(max(eff_vals)) if eff_vals else (round(freq.max) if freq and freq.max else 0)

        return {
            "name": name,
            "coresPhysical": cores_physical,
            "coresLogical": cores_logical,
            "freqCurrent": freq_current_mhz,
            "freqMax": freq_max_mhz,
            "usageTotal": round(usage_total, 1),
            "usagePerCore": [round(u, 1) for u in per_core],
            "temperature": temp,
        }
    except Exception as e:
        return {"name": "Unknown", "usageTotal": 0, "usagePerCore": []}

def get_gpu_info():
    """Query only dynamic GPU data per-request. Names come from cached _GPU_NAMES."""
    gpus = []
    try:
        r = subprocess.run(
            ["nvidia-smi",
             "--query-gpu=utilization.gpu,memory.used,memory.total,"
             "temperature.gpu,clocks.current.graphics,clocks.current.memory",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5, **_NO_WINDOW_KW
        )
        if r.returncode == 0:
            for i, line in enumerate(r.stdout.strip().splitlines()):
                p = [x.strip() for x in line.split(",")]
                name = _GPU_NAMES[i] if i < len(_GPU_NAMES) else f"GPU {i}"
                if len(p) >= 4:
                    gpus.append({
                        "name": name,
                        "usage": float(p[0]) if p[0] not in ("N/A", "") else None,
                        "vramUsed": int(p[1]) if p[1] not in ("N/A", "") else None,
                        "vramTotal": int(p[2]) if p[2] not in ("N/A", "") else None,
                        "temperature": float(p[3]) if p[3] not in ("N/A", "") else None,
                        "clockGpu": int(p[4]) if len(p) > 4 and p[4] not in ("N/A", "") else None,
                        "clockMem": int(p[5]) if len(p) > 5 and p[5] not in ("N/A", "") else None,
                    })
    except Exception:
        pass
    # Fallback: show GPU names from cache with no live data
    if not gpus and _GPU_NAMES:
        for name in _GPU_NAMES:
            gpus.append({"name": name, "usage": None, "vramUsed": None,
                         "vramTotal": None, "temperature": None,
                         "clockGpu": None, "clockMem": None})
    return gpus

def get_ram_info():
    try:
        v = psutil.virtual_memory()
        s = psutil.swap_memory()
        return {
            "used": round(v.used / 1024 / 1024),
            "total": round(v.total / 1024 / 1024),
            "available": round(v.available / 1024 / 1024),
            "percent": round(v.percent, 1),
            "swapUsed": round(s.used / 1024 / 1024),
            "swapTotal": round(s.total / 1024 / 1024),
        }
    except Exception:
        return {"used": 0, "total": 0, "available": 0, "percent": 0,
                "swapUsed": 0, "swapTotal": 0}

def get_memory_temp_hwinfo(hwinfo_data):
    """Extract memory/DIMM temperature from HWiNFO64 data.
    Returns the highest reported DIMM/RAM temperature, or None if unavailable.
    Common HWiNFO64 labels: 'DIMM1', 'DRAM', 'Memory Temperature', 'DDR5 Temp', etc.
    """
    if not hwinfo_data or not hwinfo_data.get("temps"):
        return None
    keywords = ["dimm", "dram", "memory temp", "ram temp", "ddr"]
    exclude  = ["gpu", "vram", "video"]
    best = None
    for t in hwinfo_data["temps"]:
        lbl = t["label"].lower()
        if any(k in lbl for k in exclude):
            continue
        if any(k in lbl for k in keywords):
            v = t["value"]
            if v and v > 0 and (best is None or v > best):
                best = v
    return best

def get_fans(hwinfo_data=None):
    # HWiNFO64 shared memory gives the richest fan data on Windows
    if hwinfo_data and hwinfo_data.get("fans"):
        return hwinfo_data["fans"]
    fans = []
    try:
        data = psutil.sensors_fans()
        if data:
            for label, entries in data.items():
                for e in entries:
                    fans.append({"label": e.label or label, "rpm": e.current})
    except Exception:
        pass
    return fans

def get_disks(prev_io, elapsed):
    disks = []
    try:
        curr_io = psutil.disk_io_counters(perdisk=True) or {}
        for part in psutil.disk_partitions(all=False):
            if IS_WINDOWS and "cdrom" in part.opts:
                continue
            try:
                usage = psutil.disk_usage(part.mountpoint)
                read_spd = write_spd = 0.0
                dev_key = part.device.replace("\\\\.\\", "").rstrip("\\").rstrip(":")
                for key in [dev_key, part.device, part.mountpoint]:
                    if key in curr_io and prev_io and key in prev_io:
                        read_spd = max(0, (curr_io[key].read_bytes - prev_io[key].read_bytes) / elapsed / 1024)
                        write_spd = max(0, (curr_io[key].write_bytes - prev_io[key].write_bytes) / elapsed / 1024)
                        break
                disks.append({
                    "device": part.device,
                    "mountpoint": part.mountpoint,
                    "fstype": part.fstype,
                    "total": round(usage.total / 1024 / 1024),
                    "used": round(usage.used / 1024 / 1024),
                    "free": round(usage.free / 1024 / 1024),
                    "percent": round(usage.percent, 1),
                    "readSpeed": round(read_spd, 1),
                    "writeSpeed": round(write_spd, 1),
                })
            except Exception:
                continue
        return disks, curr_io
    except Exception:
        return [], {}

def get_network(prev_io, elapsed):
    interfaces = []
    try:
        curr_io = psutil.net_io_counters(pernic=True) or {}
        stats = psutil.net_if_stats() or {}
        for name, s in curr_io.items():
            if_stat = stats.get(name)
            if not if_stat or not if_stat.isup:
                continue
            spd_up = spd_down = 0.0
            if prev_io and name in prev_io:
                spd_up = max(0, (s.bytes_sent - prev_io[name].bytes_sent) / elapsed / 1024)
                spd_down = max(0, (s.bytes_recv - prev_io[name].bytes_recv) / elapsed / 1024)
            interfaces.append({
                "name": name,
                "speedUp": round(spd_up, 1),
                "speedDown": round(spd_down, 1),
                "totalSent": round(s.bytes_sent / 1024 / 1024, 1),
                "totalRecv": round(s.bytes_recv / 1024 / 1024, 1),
                "isUp": True,
                "speedMax": if_stat.speed if if_stat.speed > 0 else None,
            })
        return interfaces, curr_io
    except Exception:
        return [], {}

def _strip_non_finite(obj):
    """Recursively replace NaN, +Infinity, and -Infinity floats with
    None so the resulting payload is valid standard JSON.

    Python's ``json.dumps`` (which Flask's ``jsonify`` uses) defaults to
    ``allow_nan=True`` and emits the bareword tokens ``NaN``/``Infinity``,
    which JS ``JSON.parse`` rejects. Hardware sensors regularly return
    NaN for unreadable channels (LibreHardwareMonitor in particular),
    and ``round(nan, n)`` propagates the NaN. Without this guard a single
    bad sensor would make the whole ``/metrics`` response unparseable on
    the phone and every PC would appear offline.

    The mobile app also has a defensive fallback parser, but sanitising
    here keeps third-party clients (curl, browsers, scripts) honest too.
    """
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _strip_non_finite(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_strip_non_finite(v) for v in obj]
    return obj

@app.route("/version")
def version():
    """Return the running agent's version. The mobile app polls /metrics
    (which already includes agentVersion) for the connected case, but a
    standalone /version endpoint is handy for quick "what's installed?"
    checks from a browser without needing the API key to fetch full metrics."""
    auth = check_key()
    if auth: return auth
    return jsonify({"version": AGENT_VERSION})

@app.route("/metrics")
def metrics():
    global _prev_net_io, _prev_disk_io, _prev_time
    auth = check_key()
    if auth: return auth
    try:
        return _collect_metrics()
    except Exception as exc:
        import traceback
        print(f"[ERROR] /metrics failed: {exc}")
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500

def _collect_metrics():
    global _prev_net_io, _prev_disk_io, _prev_time

    now = time.time()
    elapsed = max(now - _prev_time, 0.1)

    sensor_data = read_sensors()
    cpu_info = get_cpu_info(sensor_data)
    gpu_info = get_gpu_info()
    ram_info = get_ram_info()
    ram_info["temperature"] = get_memory_temp_hwinfo(sensor_data)
    fans = get_fans(sensor_data)
    disks, new_disk_io = get_disks(_prev_disk_io, elapsed)
    network, new_net_io = get_network(_prev_net_io, elapsed)

    _prev_disk_io = new_disk_io
    _prev_net_io = new_net_io
    _prev_time = now

    # Flat fields for backward compat
    primary_disk = disks[0] if disks else None
    net_up = sum(i["speedUp"] for i in network)
    net_down = sum(i["speedDown"] for i in network)

    return jsonify(_strip_non_finite({
        "os": platform.system() + " " + platform.release(),
        "hostname": socket.gethostname(),
        "agentVersion": AGENT_VERSION,
        "metrics": {
            "cpuUsage": cpu_info.get("usageTotal", 0),
            "ramUsage": ram_info["used"],
            "ramTotal": ram_info["total"],
            "diskUsage": primary_disk["used"] if primary_disk else 0,
            "diskTotal": primary_disk["total"] if primary_disk else 1,
            "networkUp": round(net_up, 1),
            "networkDown": round(net_down, 1),
            "uptime": int(time.time() - psutil.boot_time()),
            "temperature": cpu_info.get("temperature"),
            "processes": len(psutil.pids()),
            "cpu": cpu_info,
            "gpu": gpu_info,
            "ram": ram_info,
            "fans": fans,
            "disks": disks,
            "network": network,
            "sensors": sensor_data.get("sensors", []) if sensor_data else [],
        }
    }))

@app.route("/command", methods=["POST"])
def command():
    auth = check_key()
    if auth: return auth
    data = request.json or {}
    cmd = data.get("command", "")
    args = data.get("args", [])

    if cmd == "shutdown":
        if IS_WINDOWS:
            subprocess.Popen("shutdown /s /t 5", shell=True, **_NO_WINDOW_KW)
        elif IS_MAC:
            subprocess.Popen("sudo shutdown -h +0", shell=True)
        else:
            subprocess.Popen("sudo shutdown -h +0", shell=True)
        return jsonify({"success": True, "output": "Shutting down in 5 seconds..."})

    elif cmd == "restart":
        if IS_WINDOWS:
            subprocess.Popen("shutdown /r /t 5", shell=True, **_NO_WINDOW_KW)
        else:
            subprocess.Popen("sudo shutdown -r +0", shell=True)
        return jsonify({"success": True, "output": "Restarting in 5 seconds..."})

    elif cmd == "sleep":
        if IS_WINDOWS:
            subprocess.Popen("rundll32.exe powrprof.dll,SetSuspendState 0,1,0",
                             shell=True, **_NO_WINDOW_KW)
        elif IS_MAC:
            subprocess.Popen("pmset sleepnow", shell=True)
        else:
            subprocess.Popen("systemctl suspend", shell=True)
        return jsonify({"success": True, "output": "Going to sleep..."})

    elif cmd == "lock":
        if IS_WINDOWS:
            subprocess.Popen("rundll32.exe user32.dll,LockWorkStation",
                             shell=True, **_NO_WINDOW_KW)
        elif IS_MAC:
            subprocess.Popen("pmset displaysleepnow", shell=True)
        else:
            subprocess.Popen("loginctl lock-session", shell=True)
        return jsonify({"success": True, "output": "Screen locked."})

    elif cmd == "run" and args:
        shell_cmd = " ".join(args)
        try:
            result = subprocess.run(
                shell_cmd, capture_output=True, text=True,
                timeout=30, shell=True, **_NO_WINDOW_KW
            )
            output = result.stdout or result.stderr or "(no output)"
            return jsonify({"success": result.returncode == 0, "output": output})
        except subprocess.TimeoutExpired:
            return jsonify({"success": False, "error": "Command timed out (30s)"})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)})

    elif cmd == "open" and args:
        app_name = " ".join(args)
        try:
            if IS_WINDOWS:
                subprocess.Popen(f"start {app_name}", shell=True)
            elif IS_MAC:
                subprocess.Popen(["open", "-a", app_name])
            else:
                subprocess.Popen([app_name])
            return jsonify({"success": True, "output": f"Opened {app_name}"})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)})

    return jsonify({"success": False, "error": f"Unknown command: {cmd}"})

@app.route("/sensor_debug")
def sensor_debug():
    """Quick health check for the sensor pipeline. Returns which source is
    active (LHM vs HWiNFO64) and how many readings it produced."""
    auth = check_key()
    if auth: return auth
    lhm_data = read_lhm()
    if lhm_data is not None:
        return jsonify({
            "source": "lhm",
            "num_temps": len(lhm_data.get("temps") or []),
            "num_fans": len(lhm_data.get("fans") or []),
            "num_sensors": len(lhm_data.get("sensors") or []),
            "temps_sample": (lhm_data.get("temps") or [])[:5],
            "fans_sample": (lhm_data.get("fans") or [])[:5],
        })
    hw = read_hwinfo64()
    if hw is not None:
        return jsonify({
            "source": "hwinfo64",
            "num_temps": len(hw.get("temps") or []),
            "num_fans": len(hw.get("fans") or []),
            "num_sensors": len(hw.get("sensors") or []),
            "temps_sample": (hw.get("temps") or [])[:5],
            "fans_sample": (hw.get("fans") or [])[:5],
        })
    return jsonify({
        "source": "none",
        "detail": "No sensor source available. On Windows the bundled "
                  "LibreHardwareMonitor DLL should be unpacked next to the "
                  "agent — check the agent's terminal for an init error.",
    })

@app.route("/hwinfo_debug")
def hwinfo_debug():
    """Diagnostic endpoint — call from a browser on the PC to check HWiNFO64 shared memory."""
    if not IS_WINDOWS:
        return jsonify({"status": "not_windows", "detail": "HWiNFO64 is Windows-only."})
    try:
        import ctypes, struct
        HWINFO_SM2_KEY = "Global\\HWiNFO_SENS_SM2"
        FILE_MAP_READ = 0x0004
        k32 = ctypes.windll.kernel32
        k32.OpenFileMappingW.restype = ctypes.c_void_p
        k32.OpenFileMappingW.argtypes = [ctypes.c_ulong, ctypes.c_int, ctypes.c_wchar_p]
        k32.MapViewOfFile.restype = ctypes.c_void_p
        k32.MapViewOfFile.argtypes = [ctypes.c_void_p, ctypes.c_ulong,
                                       ctypes.c_ulong, ctypes.c_ulong, ctypes.c_size_t]
        k32.UnmapViewOfFile.argtypes = [ctypes.c_void_p]
        k32.CloseHandle.argtypes = [ctypes.c_void_p]
        handle = k32.OpenFileMappingW(FILE_MAP_READ, 0, HWINFO_SM2_KEY)
        if not handle:
            err = ctypes.GetLastError()
            return jsonify({
                "status": "no_shared_memory",
                "error_code": err,
                "detail": (
                    "OpenFileMappingW returned 0. HWiNFO64 shared memory not found. "
                    "Fix: Open HWiNFO64 -> Settings -> HWiNFO64 tab -> check 'Shared Memory Support' "
                    "-> click OK -> then CLOSE AND REOPEN HWiNFO64 completely."
                )
            })
        hdr_size = 88
        ptr = k32.MapViewOfFile(handle, FILE_MAP_READ, 0, 0, hdr_size)
        if not ptr:
            k32.CloseHandle(handle)
            return jsonify({"status": "map_failed", "detail": "MapViewOfFile failed for header."})
        hdr = bytes((ctypes.c_byte * hdr_size).from_address(ptr))
        k32.UnmapViewOfFile(ptr)
        sig = struct.unpack_from('<I', hdr, 0)[0]
        ver = struct.unpack_from('<I', hdr, 4)[0]
        rev = struct.unpack_from('<I', hdr, 8)[0]
        VALID_SIGS = {0x12345678, 0x53695748}
        if sig not in VALID_SIGS:
            k32.CloseHandle(handle)
            return jsonify({
                "status": "bad_signature",
                "sig_hex": hex(sig),
                "detail": f"Unexpected signature {hex(sig)}. Known good values: 0x12345678 (classic), 0x53695748 (HWiNFO64 v7+)."
            })
        off_sensors, size_sensor, num_sensors = struct.unpack_from('<III', hdr, 20)
        off_readings, size_reading, num_readings = struct.unpack_from('<III', hdr, 32)
        if size_reading == 0 or num_readings > 50000:
            k32.CloseHandle(handle)
            return jsonify({"status": "bad_header",
                            "size_reading": size_reading, "num_readings": num_readings})
        total = off_readings + size_reading * num_readings + 4096
        ptr = k32.MapViewOfFile(handle, FILE_MAP_READ, 0, 0, total)
        if not ptr:
            k32.CloseHandle(handle)
            return jsonify({"status": "map_full_failed", "total_bytes": total})
        data = bytes((ctypes.c_byte * total).from_address(ptr))
        k32.UnmapViewOfFile(ptr)
        k32.CloseHandle(handle)

        # Detect format from size_reading
        if size_reading >= 500:
            LBL_BYTES = 256; VAL_OFF_BASE = 12 + 256 + 256 + 32
        elif size_reading >= 280:
            LBL_BYTES = 128; VAL_OFF_BASE = 12 + 128 + 128 + 16
        else:
            LBL_BYTES = 256; VAL_OFF_BASE = 12 + 256 + 256 + 32

        def _lbl(raw):
            if len(raw) < 2 or raw[0] == 0:
                return ""
            if raw[1] == 0:
                s = raw.decode('utf-16-le', errors='ignore')
                cut = s.find('\x00')
                return (s[:cut] if cut >= 0 else s).strip()
            cut = raw.find(b'\x00')
            return (raw[:cut] if cut >= 0 else raw).decode('latin-1').strip()

        # Hex dump of first element for diagnosis
        first_base = off_readings
        first_hex = data[first_base:first_base+min(32, size_reading)].hex(' ')

        TEMP, FAN = 1, 3
        samples = []
        for i in range(min(num_readings, 500)):
            base = off_readings + i * size_reading
            if base + size_reading > len(data):
                break
            r_type = struct.unpack_from('<I', data, base)[0]
            orig = _lbl(data[base+12 : base+12+LBL_BYTES])
            user = _lbl(data[base+12+LBL_BYTES : base+12+LBL_BYTES+LBL_BYTES])
            val_off = base + VAL_OFF_BASE
            value = struct.unpack_from('<d', data, val_off)[0] if val_off + 8 <= len(data) else None
            if r_type in (TEMP, FAN):
                samples.append({
                    "idx": i, "type": "temp" if r_type == TEMP else "fan",
                    "orig": orig, "user": user, "value": value
                })
        return jsonify({
            "status": "ok",
            "hwinfo_version": ver,
            "hwinfo_revision": rev,
            "num_sensors": num_sensors,
            "num_readings": num_readings,
            "size_reading": size_reading,
            "lbl_bytes_used": LBL_BYTES,
            "val_off_base": VAL_OFF_BASE,
            "first_element_hex": first_hex,
            "temp_fan_samples": samples[:40]
        })
    except Exception as e:
        import traceback
        return jsonify({"status": "exception", "error": str(e), "trace": traceback.format_exc()})


# ── System tray + autostart + auto-update (Windows only) ───────────────────
# Goals: end users should not see a terminal window after launch (the agent
# is a background service, not a CLI tool); they should be able to toggle
# "start with Windows" without editing the registry by hand; and they should
# see at a glance whether a newer agent release is available on GitHub. The
# tray icon is the home for all of that. macOS / Linux skip this and use the
# original blocking `app.run` path so we don't ship a half-implemented UI on
# platforms we haven't tested.
TRAY_AVAILABLE = False
if IS_WINDOWS:
    try:
        import pystray
        from PIL import Image, ImageDraw
        import winreg
        TRAY_AVAILABLE = True
    except ImportError as _tray_imp_err:
        # pystray / Pillow may be missing in dev runs from source. The agent
        # still works — just without the tray UI. The PyInstaller build always
        # bundles them, so end-user .exe installs always get the tray.
        print(f"tray UI disabled (missing dependency: {_tray_imp_err}); "
              f"falling back to console mode")

UPDATE_REPO          = "adrianomelnic/pc-monitor-control"
UPDATE_API_URL       = f"https://api.github.com/repos/{UPDATE_REPO}/releases/latest"
UPDATE_RELEASES_URL  = f"https://github.com/{UPDATE_REPO}/releases/latest"
UPDATE_DOWNLOAD_URL  = f"https://github.com/{UPDATE_REPO}/releases/latest/download/pc-agent-windows.exe"
AUTOSTART_REG_PATH   = r"Software\Microsoft\Windows\CurrentVersion\Run"
AUTOSTART_VALUE_NAME = "PCMonitorAgent"
UPDATE_CHECK_INTERVAL_SEC = 60 * 60  # poll GitHub once an hour

# Module-level mutable state shared between the update worker thread and the
# tray menu callbacks. Tray callbacks are pure reads, the worker thread does
# all writes — so no lock is needed (CPython's GIL guarantees atomic word
# writes for these simple types). `_log_path` is set much earlier (at module
# import, see _redirect_stdio_to_logfile) so we don't redeclare it here.
_tray_icon = None                # type: ignore[var-annotated]
_update_status: str = "Checking for updates..."
_update_available_version: "str | None" = None  # parsed tag, e.g. "0.2.0"
_update_in_progress: bool = False

def _version_tuple(v: str):
    """Loose semver parse: ('1', '2', '3-rc1') -> (1, 2, 3). Used only for
    'is GitHub release newer than installed?' comparisons, so tolerating
    odd suffixes by stripping non-digits per part is fine."""
    parts = []
    for p in v.split("."):
        m = re.match(r"(\d+)", p)
        parts.append(int(m.group(1)) if m else 0)
    return tuple(parts)

def _autostart_is_enabled() -> bool:
    """True if our HKCU\\…\\Run value exists. We don't validate the path —
    if it's there, Windows will run it on next login, and that's what the
    user toggle is asking about."""
    if not IS_WINDOWS:
        return False
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTOSTART_REG_PATH) as k:
            winreg.QueryValueEx(k, AUTOSTART_VALUE_NAME)
            return True
    except FileNotFoundError:
        return False
    except OSError:
        return False

def _autostart_target() -> str:
    """The command line we want Windows to execute on login. When running
    as a frozen PyInstaller bundle, sys.executable is the agent .exe.
    When running from source, fall back to `pythonw <script>` so a console
    window doesn't pop up at every login (pythonw == windowed Python)."""
    if IS_FROZEN:
        return f'"{sys.executable}"'
    pythonw = sys.executable.replace("python.exe", "pythonw.exe")
    return f'"{pythonw}" "{os.path.abspath(__file__)}"'

def _set_autostart(enable: bool) -> None:
    if not IS_WINDOWS:
        return
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, AUTOSTART_REG_PATH, 0, winreg.KEY_SET_VALUE
        ) as k:
            if enable:
                winreg.SetValueEx(
                    k, AUTOSTART_VALUE_NAME, 0, winreg.REG_SZ, _autostart_target()
                )
            else:
                try:
                    winreg.DeleteValue(k, AUTOSTART_VALUE_NAME)
                except FileNotFoundError:
                    pass
    except OSError as e:
        print(f"autostart toggle failed: {e}")

def _toggle_autostart(_icon=None, _item=None) -> None:
    _set_autostart(not _autostart_is_enabled())
    if _tray_icon is not None:
        _tray_icon.update_menu()

def _check_for_update_now() -> None:
    """One-shot update check. Writes _update_status / _update_available_version
    and refreshes the tray menu when done. Network errors are caught and
    surfaced as a status string so the user can see the failure instead of
    silent 'no update'."""
    global _update_status, _update_available_version
    try:
        import urllib.request, json
        req = urllib.request.Request(
            UPDATE_API_URL,
            headers={"User-Agent": f"pc-agent/{AGENT_VERSION}"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.load(r)
        latest_tag = (data.get("tag_name") or "").lstrip("v").strip()
        if latest_tag and _version_tuple(latest_tag) > _version_tuple(AGENT_VERSION):
            _update_available_version = latest_tag
            _update_status = f"Update available: v{latest_tag}"
        else:
            _update_available_version = None
            _update_status = f"Up to date (v{AGENT_VERSION})"
    except Exception as e:
        _update_available_version = None
        _update_status = f"Update check failed: {e}"
    if _tray_icon is not None:
        _tray_icon.update_menu()

def _update_worker_loop() -> None:
    """Background daemon: check on startup, then every UPDATE_CHECK_INTERVAL_SEC."""
    while True:
        _check_for_update_now()
        time.sleep(UPDATE_CHECK_INTERVAL_SEC)

def _install_update_async() -> None:
    """Fire-and-forget self-update. Downloads pc-agent-windows.exe to
    `pc-agent.new` next to the running .exe, then writes a small batch
    file that waits for our process to exit, replaces the .exe, relaunches,
    and self-deletes. We then shut down so the batch can do the rename
    without sharing-violation. The re-entry guard is set BEFORE spawning
    the worker thread so a rapid double-click on 'Install update' can't
    spawn two concurrent installer threads (which would both download to
    the same `pc-agent.new` and race the `move /y`)."""
    global _update_in_progress
    if _update_in_progress or not IS_FROZEN or not _update_available_version:
        return
    _update_in_progress = True
    import threading
    threading.Thread(target=_install_update, daemon=True, name="update-install").start()

def _install_update() -> None:
    global _update_status, _update_in_progress
    try:
        _update_status = "Downloading update..."
        if _tray_icon is not None:
            _tray_icon.update_menu()
        import urllib.request
        current_exe = sys.executable
        target_dir = os.path.dirname(current_exe)
        new_exe = os.path.join(target_dir, "pc-agent.new")
        urllib.request.urlretrieve(UPDATE_DOWNLOAD_URL, new_exe)
        # Sanity check — a real Windows agent build is ~13 MB; anything
        # under 1 MB is almost certainly a 404 page or a redirect we didn't
        # follow correctly. Capture the size BEFORE deleting so the error
        # message doesn't have to re-stat a file we just removed.
        size = os.path.getsize(new_exe)
        if size < 1024 * 1024:
            try: os.remove(new_exe)
            except OSError: pass
            raise RuntimeError(f"downloaded file too small ({size} bytes)")

        batch_path = os.path.join(target_dir, "pc-agent-update.bat")
        # `timeout /t 3` lets the current process exit so the .exe is no
        # longer locked. `move /y` overwrites in place (same volume — both
        # paths are in target_dir). `start ""` launches the new .exe
        # detached. `del "%~f0"` deletes the batch itself last.
        with open(batch_path, "w", encoding="utf-8") as f:
            f.write(
                "@echo off\r\n"
                "timeout /t 3 /nobreak >nul\r\n"
                f'move /y "{new_exe}" "{current_exe}" >nul\r\n'
                f'start "" "{current_exe}"\r\n'
                'del "%~f0"\r\n'
            )
        DETACHED_PROCESS = 0x00000008
        CREATE_NEW_PROCESS_GROUP = 0x00000200
        subprocess.Popen(
            ["cmd", "/c", batch_path],
            creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
            close_fds=True,
        )
        _update_status = "Installing update — agent will restart..."
        if _tray_icon is not None:
            _tray_icon.update_menu()
        time.sleep(1)
        if _tray_icon is not None:
            _tray_icon.stop()
        os._exit(0)
    except Exception as e:
        _update_status = f"Update failed: {e}"
        if _tray_icon is not None:
            _tray_icon.update_menu()
    finally:
        _update_in_progress = False

def _open_releases_page(_icon=None, _item=None) -> None:
    import webbrowser
    webbrowser.open(UPDATE_RELEASES_URL)

def _open_dashboard(_icon=None, _item=None) -> None:
    import webbrowser
    webbrowser.open(f"http://localhost:{PORT}/")

def _open_log(_icon=None, _item=None) -> None:
    if _log_path and os.path.isfile(_log_path):
        try:
            os.startfile(_log_path)  # type: ignore[attr-defined]
        except Exception as e:
            print(f"open log failed: {e}")

def _on_update_clicked(_icon=None, _item=None) -> None:
    if _update_available_version:
        # Try in-place self-update first; if that fails, the user can still
        # use "Open releases page" from the menu to download manually.
        _install_update_async()
    else:
        # Re-check on demand so the user gets immediate feedback.
        import threading
        threading.Thread(target=_check_for_update_now, daemon=True,
                         name="update-check-manual").start()

def _make_tray_image() -> "Image.Image":
    """Generate the tray icon programmatically so we don't have to ship a
    PNG asset and worry about PyInstaller bundling the right path. 64×64
    rounded square in the app accent green on a transparent background."""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((4, 4, 60, 60), radius=12, fill=(20, 20, 20, 255))
    d.rounded_rectangle((14, 14, 50, 50), radius=4, outline=(0, 230, 118, 255), width=3)
    d.rectangle((22, 36, 42, 42), fill=(0, 230, 118, 255))
    return img

def _build_tray_menu():
    """The menu is rebuilt by pystray on every right-click, so callable
    text/checked= produces a live status display without us having to
    track when to refresh."""
    return pystray.Menu(
        pystray.MenuItem(f"PC Monitor Agent v{AGENT_VERSION}", None, enabled=False),
        pystray.MenuItem(lambda _: f"Status: listening on port {PORT}", None, enabled=False),
        pystray.MenuItem(lambda _: _update_status, None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Open dashboard", _open_dashboard),
        pystray.MenuItem(
            lambda _: (f"Install update v{_update_available_version}"
                       if _update_available_version else "Check for updates"),
            _on_update_clicked,
        ),
        pystray.MenuItem("Open releases page", _open_releases_page),
        pystray.MenuItem(
            "Start with Windows",
            _toggle_autostart,
            checked=lambda _: _autostart_is_enabled(),
        ),
        pystray.MenuItem("Show log file", _open_log,
                         enabled=lambda _: bool(_log_path)),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", lambda icon, _: icon.stop()),
    )

def _run_tray_mode() -> None:
    """Windows windowed-mode entry point: Flask runs in a daemon thread,
    pystray runs the Win32 message loop on the main thread (it requires
    that — calling Icon.run() from a worker thread silently does nothing)."""
    global _tray_icon
    import threading
    threading.Thread(
        target=lambda: app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False),
        daemon=True, name="flask-server",
    ).start()
    threading.Thread(target=_update_worker_loop, daemon=True, name="update-worker").start()
    _tray_icon = pystray.Icon(
        "pc-monitor-agent",
        _make_tray_image(),
        f"PC Monitor Agent v{AGENT_VERSION}",
        _build_tray_menu(),
    )
    _tray_icon.run()  # blocks until the user picks Quit


if __name__ == "__main__":
    # Note: stdout/stderr are already redirected to the log file at module
    # import time (see _redirect_stdio_to_logfile near the top), so prints
    # below are safe even in PyInstaller windowed mode.
    print(f"PC Agent starting on port {PORT}")
    print(f"API Key: {'set' if API_KEY else 'not set (open access)'}")
    open_firewall_port(PORT)
    if TRAY_AVAILABLE:
        _run_tray_mode()
    else:
        # macOS / Linux / dev-from-source-without-pystray: original behavior.
        app.run(host="0.0.0.0", port=PORT, debug=False)
