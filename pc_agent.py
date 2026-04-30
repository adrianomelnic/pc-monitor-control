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
import os, platform, subprocess, time, socket, re, ctypes, sys, math, threading as _threading
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
# Guards _prev_net_io / _prev_disk_io / _prev_time against concurrent /metrics
# requests racing each other: Flask runs with threaded=True so two requests can
# arrive simultaneously, leading to one seeing a fresh _prev_time but the stale
# _prev_net_io from before the other request updated it — causing elapsed ≈ 0
# and therefore speed ≈ 0 on the next render.
_io_state_lock = _threading.Lock()

# ── CPU usage background sampler ─────────────────────────────────────────────
# psutil.cpu_percent(interval=None) returns the delta since the LAST call. A
# single warmup at startup means the first real request returns the average over
# the entire lifetime of the agent (often many hours of mostly-idle time) which
# can read near-zero even when the CPU is currently under load.
#
# Keeping a background thread that samples every 2 s ensures the window is
# always ≤ 2 s, so the values the app reads are real-time and match what
# Windows Task Manager shows.  The per-core array from psutil uses
# NtQuerySystemInformation which reads \Processor Information\% Processor Utility
# — the same counter Task Manager uses — rather than LHM's frequency-normalised
# "CPU Total" sensor which often under-reports on P+E core Intel CPUs.
_cpu_sampler_lock = _threading.Lock()
_cpu_total_cached: float = 0.0
_cpu_per_core_cached: list = []

def _cpu_sampler():
    global _cpu_total_cached, _cpu_per_core_cached
    # Prime the counter so the first real delta window starts now, not at import time
    psutil.cpu_percent(percpu=True)
    import time as _time
    while True:
        _time.sleep(2)
        try:
            per_core = psutil.cpu_percent(percpu=True)
            total    = round(sum(per_core) / len(per_core), 1) if per_core else 0.0
            with _cpu_sampler_lock:
                _cpu_per_core_cached = [round(v, 1) for v in per_core]
                _cpu_total_cached    = total
        except Exception:
            pass

_threading.Thread(target=_cpu_sampler, daemon=True, name="cpu-sampler").start()

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

def read_sensors(source="auto"):
    """Return sensor data from the requested source.

    source:
      "auto"     — try LHM first, fall back to HWiNFO64 (original behaviour).
      "lhm"      — LHM only; returns None if LHM is unavailable.
      "hwinfo64" — HWiNFO64 only (must be running with shared memory enabled).

    Returns {temps, fans, sensors} or None if the chosen source is unavailable.
    """
    if source == "hwinfo64":
        return read_hwinfo64()
    if source == "lhm":
        return read_lhm()   # may be None if LHM failed/unavailable
    # "auto": LHM first, HWiNFO64 fallback
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

        # Use the background-sampler cache so the measurement window is always
        # ≤ 2 s (matches Task Manager) rather than the full lifetime of the agent.
        with _cpu_sampler_lock:
            per_core   = list(_cpu_per_core_cached) if _cpu_per_core_cached else psutil.cpu_percent(percpu=True)
            usage_total = _cpu_total_cached if _cpu_per_core_cached else round(sum(per_core) / max(len(per_core), 1), 1)

        # LHM / HWiNFO64 per-core load sensors — useful for per-core breakdown
        # but we do NOT override usage_total from LHM: LHM's "CPU Total" sensor
        # on Intel P+E core CPUs uses a frequency-normalised metric that reads
        # much lower than what Task Manager shows (% Processor Utility).
        # psutil uses NtQuerySystemInformation → same counter as Task Manager.
        if hwinfo_data:
            load_sensors = [s for s in (hwinfo_data.get("sensors") or []) if s.get("type") == "usage"]
            # Per-core: "CPU Core #1", "CPU Core #2", … sorted numerically.
            core_load_sensors = sorted(
                [s for s in load_sensors
                 if re.search(r"^cpu\s+core\s+#\d+$", s.get("label", ""), re.I)
                 and s.get("value") is not None],
                key=lambda s: int(re.search(r"\d+", s["label"]).group())
            )
            if core_load_sensors:
                lhm_per_core = [round(float(s["value"]), 1) for s in core_load_sensors]
                # Use LHM per-core ONLY if psutil shows all zeros (sampler not
                # ready yet on first boot) AND LHM covers most logical cores.
                # Prefer psutil because it reads % Processor Utility per logical
                # processor, matching Task Manager. LHM reads MSR MPERF/TSC which
                # can give lower values on P+E core Intel CPUs.
                psutil_all_zero = all(v == 0.0 for v in per_core)
                lhm_covers_cores = len(lhm_per_core) >= max(cores_logical // 2, 1)
                if psutil_all_zero and lhm_covers_cores:
                    per_core = lhm_per_core
                # else: keep psutil's per_core array (accurate, matches Task Manager)

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
        # Try LHM / HWiNFO64 clock sensors for real-time current frequency.
        # psutil.cpu_freq().current is static on Windows (always shows rated base clock).
        freq_current_mhz = None
        hw_sensors = (hwinfo_data.get("sensors") or []) if hwinfo_data else []
        clock_sensors = [s for s in hw_sensors if s.get("type") == "clock"]
        # 1. Best: average of P-core effective clocks only (excludes slower E-cores)
        p_eff_clocks = [
            s["value"] for s in clock_sensors
            if re.search(r"p-core.*effective", s.get("label", ""), re.I)
            and s.get("value", 0) > 100
        ]
        if p_eff_clocks:
            freq_current_mhz = round(sum(p_eff_clocks) / len(p_eff_clocks))
        else:
            # 2. Average of all effective clocks (includes E-cores, but better than static)
            eff_clocks = [
                s["value"] for s in clock_sensors
                if re.search(r"effective\s+clock", s.get("label", ""), re.I)
                and s.get("value", 0) > 100
            ]
            if eff_clocks:
                freq_current_mhz = round(sum(eff_clocks) / len(eff_clocks))
            else:
                # 3. Average all core clocks: "P-core X Clock", "E-core X Clock", "CPU Core #X Clock"
                core_clocks = [
                    s["value"] for s in clock_sensors
                    if re.search(r"[pe]-core.*clock|cpu.*core.*clock", s.get("label", ""), re.I)
                    and not re.search(r"effective|bus|ring|llc", s.get("label", ""), re.I)
                    and s.get("value", 0) > 100
                ]
                if core_clocks:
                    freq_current_mhz = round(sum(core_clocks) / len(core_clocks))
        # 4. PowerShell Win32_Processor.CurrentClockSpeed — real-time value that
        #    Windows reads from the hardware on each WMI query (unlike psutil which
        #    reads the static rated frequency from the registry).
        if freq_current_mhz is None and IS_WINDOWS:
            try:
                r = subprocess.run(
                    ["powershell", "-NoProfile", "-Command",
                     "(Get-CimInstance Win32_Processor).CurrentClockSpeed"],
                    capture_output=True, text=True, timeout=3, **_NO_WINDOW_KW)
                ps_clock = r.stdout.strip()
                if ps_clock.isdigit():
                    freq_current_mhz = int(ps_clock)
            except Exception:
                pass
        # Final fallback: psutil (static base clock on Windows)
        if freq_current_mhz is None:
            freq_current_mhz = round(freq.current) if freq else 0

        # freqMax: highest single-core clock from LHM/HWiNFO64 (real boost), fallback to psutil
        max_core_clocks = [
            s["value"] for s in clock_sensors
            if re.search(r"[pe]-core.*clock|cpu.*core.*clock", s.get("label", ""), re.I)
            and not re.search(r"effective|bus|ring|llc", s.get("label", ""), re.I)
            and s.get("value", 0) > 100
        ]
        if max_core_clocks:
            freq_max_mhz = round(max(max_core_clocks))
        else:
            eff_vals = [s["value"] for s in clock_sensors if re.search(r"effective\s+clock", s.get("label", ""), re.I) and s.get("value", 0) > 100]
            freq_max_mhz = round(max(eff_vals)) if eff_vals else (round(freq.max) if freq and freq.max else freq_current_mhz)

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

# ── PhysicalDriveN → drive-letter mapping (Windows) ────────────────────────
# psutil on Windows 11 / modern psutil builds returns keys like "PhysicalDrive0"
# instead of drive letters ("C:", "D:").  We query the OS once (via wmic or
# PowerShell) to build the physical-disk-number → volume-letter map and cache
# it for 5 minutes — drives rarely change while the agent is running.
_physdrive_vol_map_cache: "dict[str, list[str]]" = {}
_physdrive_vol_map_ts: float = 0.0

def _win_physdrive_to_vol_map() -> "dict[str, list[str]]":
    """Return {"PhysicalDrive0": ["D:"], "PhysicalDrive1": ["C:"]} etc.
    Tries wmic first (available Windows 7–11), then falls back to
    PowerShell Get-CimInstance (Windows 10+).  Cached 5 minutes."""
    global _physdrive_vol_map_cache, _physdrive_vol_map_ts
    if not IS_WINDOWS:
        return {}
    now = time.time()
    if now - _physdrive_vol_map_ts < 300.0 and _physdrive_vol_map_cache:
        return _physdrive_vol_map_cache

    m: "dict[str, list[str]]" = {}
    import subprocess
    NO_WIN = 0x08000000  # CREATE_NO_WINDOW — suppresses any console flash

    def _parse_assoc(text: str) -> None:
        # Handles both wmic and PowerShell output.
        # wmic line:  ...Win32_DiskPartition.DeviceID="Disk #0, Partition #0" ... DeviceID="C:"
        # PS line:    Antecedent : ... Disk #0, Partition #0 ...  / Dependent: DeviceID="C:"
        for line in text.splitlines():
            m_disk = re.search(r'Disk\s*#\s*(\d+)', line, re.I)
            m_vol  = re.search(r'DeviceID="([A-Za-z]:)"', line)
            if not m_vol:
                # PowerShell may quote differently: DeviceID = C:
                m_vol = re.search(r'DeviceID\s*[=:]\s*"?([A-Za-z]:)"?', line, re.I)
            if m_disk and m_vol:
                key = f"PhysicalDrive{m_disk.group(1)}"
                vol = m_vol.group(1).upper() + (":" if ":" not in m_vol.group(1) else "")
                m.setdefault(key, [])
                if vol not in m[key]:
                    m[key].append(vol)

    # Try wmic (deprecated but present on most Windows installs)
    try:
        r = subprocess.run(
            ["wmic", "path", "Win32_LogicalDiskToPartition",
             "get", "Antecedent,Dependent"],
            capture_output=True, text=True, timeout=8,
            creationflags=NO_WIN,
        )
        if r.returncode == 0 and "DeviceID" in r.stdout:
            _parse_assoc(r.stdout)
    except Exception:
        pass

    # Fallback: PowerShell Get-CimInstance (works even if wmic is removed)
    if not m:
        try:
            ps_cmd = (
                "Get-CimInstance Win32_LogicalDiskToPartition | "
                "ForEach-Object { $_.Antecedent.ToString() + ' -> ' + $_.Dependent.ToString() }"
            )
            r = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive",
                 "-Command", ps_cmd],
                capture_output=True, text=True, timeout=12,
                creationflags=NO_WIN,
            )
            if r.returncode == 0:
                _parse_assoc(r.stdout)
        except Exception:
            pass

    _physdrive_vol_map_cache = m
    _physdrive_vol_map_ts    = now
    return m


def _build_vol_to_key(io_dict):
    """Build a normalised map from drive-letter tokens → actual psutil key.

    psutil.disk_io_counters(perdisk=True) key formats by platform / version:
      Windows 11 / modern psutil (confirmed):
        "PhysicalDrive0", "PhysicalDrive1"   ← NO drive letters; need WMI map
      Windows Physical Disk counter (older psutil):
        "0 C:"        – single-partition physical disk 0 → C:
        "0 C: D:"     – physical disk 0 with two volumes
      Windows Logical Disk counter:
        "C:", "D:"
      Windows even older:
        "C", "D"
      Linux / macOS:
        "sda1", "nvme0n1p1"   (no /dev/ prefix)

    The resulting map lets us look up any plausible candidate string and find
    the real key so the speed delta can be computed correctly.
    """
    m = {}

    # Pre-fetch the PhysicalDriveN → vol-letters map if any key needs it.
    has_physdrive = any(k.startswith("PhysicalDrive") for k in io_dict)
    physdrive_map = _win_physdrive_to_vol_map() if has_physdrive else {}

    for raw in io_dict:
        m[raw] = raw                          # exact match always works
        m[raw.upper()] = raw                  # case-insensitive exact

        # Windows 11: "PhysicalDrive0" → look up drive letters via WMI
        if raw.startswith("PhysicalDrive") and physdrive_map:
            for vol in physdrive_map.get(raw, []):
                vol_up = vol.upper()
                if vol_up not in m:
                    m[vol_up] = raw               # "D:" -> "PhysicalDrive0"
                bare = vol_up.rstrip(":")
                if bare not in m:
                    m[bare] = raw                 # "D"  -> "PhysicalDrive0"

        # Windows compound key like "0 C:" or "0 C: D:" — split on whitespace
        # and extract every token that looks like a drive letter or "X:".
        for tok in raw.split():
            tok_up = tok.upper()
            if len(tok_up) == 2 and tok_up[1] == ":" and tok_up[0].isalpha():
                # "C:" style token
                if tok_up not in m:
                    m[tok_up] = raw
                if tok_up.rstrip(":") not in m:
                    m[tok_up.rstrip(":")] = raw   # bare "C" fallback
            elif len(tok_up) == 1 and tok_up.isalpha():
                # bare letter token
                if tok_up + ":" not in m:
                    m[tok_up + ":"] = raw
                if tok_up not in m:
                    m[tok_up] = raw

        # POSIX: strip /dev/ prefix so "sda1" matches "/dev/sda1"
        if raw.startswith("/dev/"):
            base = raw[5:]
            if base not in m:
                m[base] = raw
    return m


def get_disks(prev_io, elapsed):
    disks = []
    try:
        curr_io = psutil.disk_io_counters(perdisk=True) or {}
        vol_map = _build_vol_to_key(curr_io)   # normalised lookup
        prev_vol_map = _build_vol_to_key(prev_io) if prev_io else {}

        # Aggregate fallback: if per-disk key matching fails (unknown key format,
        # insufficient permissions, or empty perdisk dict) we fall back to the
        # system-wide totals split evenly across unmatched disks.
        # Stored under the special key "__agg__" so the prev snapshot is tracked.
        try:
            agg_curr = psutil.disk_io_counters(perdisk=False)
        except Exception:
            agg_curr = None
        agg_prev = prev_io.get("__agg__") if prev_io else None

        # Pass 1: collect partitions and per-disk match results.
        raw_parts = []
        for part in psutil.disk_partitions(all=False):
            if IS_WINDOWS and "cdrom" in part.opts:
                continue
            try:
                usage = psutil.disk_usage(part.mountpoint)
            except Exception:
                continue

            win_base = part.device.replace("\\\\.\\", "").rstrip("\\")  # "C:"
            posix_base = part.device.split("/")[-1] if "/" in part.device else ""
            candidates = [
                win_base,                           # "C:"
                win_base.upper(),
                win_base.rstrip(":"),               # "C"
                win_base.rstrip(":").upper(),
                posix_base,                         # "sda1"
                part.device,                        # "C:\\" or "/dev/sda1"
                part.mountpoint,                    # "C:\\" or "/mnt/data"
                part.mountpoint.rstrip("/\\"),
            ]

            read_spd = write_spd = 0.0
            matched = False
            for cand in candidates:
                if not cand:
                    continue
                curr_key = vol_map.get(cand) or vol_map.get(cand.upper())
                prev_key = prev_vol_map.get(cand) or prev_vol_map.get(cand.upper())
                if curr_key and prev_key and curr_key in curr_io and prev_key in prev_io:
                    read_spd = max(0, (curr_io[curr_key].read_bytes
                                      - prev_io[prev_key].read_bytes) / elapsed / 1024)
                    write_spd = max(0, (curr_io[curr_key].write_bytes
                                       - prev_io[prev_key].write_bytes) / elapsed / 1024)
                    matched = True
                    break

            raw_parts.append({
                "device": part.device, "mountpoint": part.mountpoint,
                "fstype": part.fstype, "usage": usage,
                "read_spd": read_spd, "write_spd": write_spd, "matched": matched,
            })

        # Pass 2: apply aggregate fallback to unmatched partitions.
        unmatched = [p for p in raw_parts if not p["matched"]]
        if unmatched and agg_curr and agg_prev and elapsed > 0:
            n = max(len(unmatched), 1)
            agg_read = max(0, (agg_curr.read_bytes  - agg_prev.read_bytes)  / elapsed / 1024) / n
            agg_write = max(0, (agg_curr.write_bytes - agg_prev.write_bytes) / elapsed / 1024) / n
            for p in unmatched:
                p["read_spd"]  = agg_read
                p["write_spd"] = agg_write

        for p in raw_parts:
            u = p["usage"]
            disks.append({
                "device": p["device"],
                "mountpoint": p["mountpoint"],
                "fstype": p["fstype"],
                "total": round(u.total / 1024 / 1024),
                "used":  round(u.used  / 1024 / 1024),
                "free":  round(u.free  / 1024 / 1024),
                "percent": round(u.percent, 1),
                "readSpeed":  round(p["read_spd"],  1),
                "writeSpeed": round(p["write_spd"], 1),
            })

        # Persist curr_io + aggregate so next call can compute deltas.
        new_io = dict(curr_io)
        if agg_curr:
            new_io["__agg__"] = agg_curr
        return disks, new_io
    except Exception:
        return [], {}

def _is_virtual_iface(name: str) -> bool:
    """Return True for loopback, pseudo-interfaces, and well-known virtual
    adapters that should be excluded from the network speed display.
    Mirrors the isVirtualIface() filter in the mobile NetworkCard component."""
    n = name.lower()
    return (
        n == "lo" or
        "loopback" in n or
        "pseudo" in n or
        n.startswith("tun") or
        n.startswith("tap") or
        n.startswith("veth") or
        "docker" in n or
        "vmware" in n or
        "vethernet" in n or
        "tailscale" in n or
        "tunnel" in n or
        "teredo" in n or
        "isatap" in n or
        "6to4" in n or
        "virtual" in n
    )


def get_network(prev_io, elapsed):
    interfaces = []
    try:
        curr_io = psutil.net_io_counters(pernic=True) or {}
        stats = psutil.net_if_stats() or {}
        for name, s in curr_io.items():
            if_stat = stats.get(name)
            if not if_stat or not if_stat.isup:
                continue
            if _is_virtual_iface(name):
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

@app.route("/")
def index():
    """Minimal status page — what 'Open dashboard' in the tray opens."""
    html = f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PC Monitor Agent</title>
<style>
  body{{font-family:system-ui,sans-serif;background:#111;color:#eee;
        margin:0;display:flex;align-items:center;justify-content:center;
        min-height:100vh;}}
  .card{{background:#1a1a1a;border:1px solid #333;border-radius:12px;
         padding:32px 40px;max-width:420px;width:100%;}}
  h1{{margin:0 0 6px;font-size:1.3rem;color:#22c55e;}}
  p{{margin:4px 0;color:#aaa;font-size:.9rem;}}
  .dot{{display:inline-block;width:8px;height:8px;border-radius:50%;
        background:#22c55e;margin-right:6px;}}
  a{{color:#22c55e;text-decoration:none;}}
  a:hover{{text-decoration:underline;}}
  ul{{margin:16px 0 0;padding:0 0 0 18px;color:#aaa;font-size:.85rem;line-height:1.9;}}
</style>
</head>
<body>
<div class="card">
  <h1><span class="dot"></span>PC Monitor Agent v{AGENT_VERSION}</h1>
  <p>Running on port {PORT}</p>
  <p style="margin-top:12px;color:#666;font-size:.8rem;">API endpoints:</p>
  <ul>
    <li><a href="/metrics">/metrics</a> — full sensor snapshot</li>
    <li><a href="/version">/version</a> — version info</li>
    <li><a href="/sensor_debug">/sensor_debug</a> — sensor source</li>
    <li><a href="/disk_io_debug">/disk_io_debug</a> — disk I/O keys</li>
  </ul>
</div>
</body>
</html>"""
    from flask import Response
    return Response(html, mimetype="text/html")


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
    # ?source=auto|lhm|hwinfo64 — lets the mobile app choose which sensor
    # backend to use per-PC (e.g. switch to HWiNFO64 when LHM doesn't expose
    # GPU voltage/power for a particular NVIDIA card).
    source = request.args.get("source", "auto")
    if source not in ("auto", "lhm", "hwinfo64"):
        source = "auto"
    try:
        return _collect_metrics(source)
    except Exception as exc:
        import traceback
        print(f"[ERROR] /metrics failed: {exc}")
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500

def _collect_metrics(source="auto"):
    global _prev_net_io, _prev_disk_io, _prev_time

    # Atomically snapshot the current I/O baseline so two concurrent Flask
    # threads don't see a stale _prev_time paired with an already-updated
    # _prev_net_io (which would yield elapsed ≈ 0 → speed ≈ 0 on one thread).
    with _io_state_lock:
        snap_disk_io = _prev_disk_io
        snap_net_io  = _prev_net_io
        snap_time    = _prev_time

    now = time.time()
    elapsed = max(now - snap_time, 0.1)

    sensor_data = read_sensors(source)
    cpu_info = get_cpu_info(sensor_data)
    gpu_info = get_gpu_info()
    ram_info = get_ram_info()
    ram_info["temperature"] = get_memory_temp_hwinfo(sensor_data)
    fans = get_fans(sensor_data)
    disks, new_disk_io = get_disks(snap_disk_io, elapsed)
    network, new_net_io = get_network(snap_net_io, elapsed)

    # Write back only if our timestamp is strictly newer — a slow concurrent
    # request that finishes late should not overwrite a fresher result.
    with _io_state_lock:
        if now > _prev_time:
            _prev_disk_io = new_disk_io
            _prev_net_io  = new_net_io
            _prev_time    = now

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


@app.route("/disk_io_debug")
def disk_io_debug():
    """Diagnostic endpoint: returns the raw psutil disk I/O keys so we can
    see exactly what format this OS/psutil version uses and debug why
    per-disk speed matching might fail.  No API-key check — it contains
    no sensitive data (just key names and byte counters)."""
    result = {}
    try:
        perdisk = psutil.disk_io_counters(perdisk=True) or {}
        result["perdisk_keys"] = list(perdisk.keys())
        result["perdisk_sample"] = {
            k: {"read_bytes": v.read_bytes, "write_bytes": v.write_bytes}
            for k, v in list(perdisk.items())[:8]
        }
    except Exception as e:
        result["perdisk_error"] = str(e)
        perdisk = {}

    if IS_WINDOWS and any(k.startswith("PhysicalDrive") for k in perdisk):
        result["physdrive_vol_map"] = _win_physdrive_to_vol_map()

    try:
        agg = psutil.disk_io_counters(perdisk=False)
        result["aggregate"] = {"read_bytes": agg.read_bytes, "write_bytes": agg.write_bytes} if agg else None
    except Exception as e:
        result["aggregate_error"] = str(e)

    parts = []
    try:
        vol_map = _build_vol_to_key(perdisk) if "perdisk_keys" in result else {}
        for part in psutil.disk_partitions(all=False):
            if IS_WINDOWS and "cdrom" in (part.opts or ""):
                continue
            win_base = part.device.replace("\\\\.\\", "").rstrip("\\")
            candidates = [win_base, win_base.upper(), win_base.rstrip(":"),
                          part.device, part.mountpoint]
            matched = None
            for c in candidates:
                k = vol_map.get(c) or vol_map.get(c.upper() if c else c)
                if k:
                    matched = k
                    break
            parts.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "win_base_derived": win_base,
                "candidates_tried": [c for c in candidates if c],
                "matched_perdisk_key": matched,
            })
    except Exception as e:
        result["partitions_error"] = str(e)
    result["partitions"] = parts
    return jsonify(result)


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
    except Exception as _tray_imp_err:
        # pystray / Pillow may be missing in dev runs from source. The agent
        # still works — just without the tray UI. The PyInstaller build always
        # bundles them, so end-user .exe installs always get the tray.
        print(f"tray UI disabled ({type(_tray_imp_err).__name__}: {_tray_imp_err}); "
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
# Set to True only inside the explicit "Quit" menu callback so _run_tray_mode
# can distinguish "user intentionally quit" from "pystray silently returned
# without ever showing the icon" (the latter has no exception but should keep
# Flask alive).
_quit_requested: bool = False

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
        # We use PowerShell Start-Process to launch the replacement exe so it
        # starts in a completely fresh environment — inheriting nothing from this
        # process tree.  This prevents PyInstaller's _MEIPASS / _MEIPASS2RTHLPTH
        # env-vars (pointing to THIS exe's now-deleted extraction dir) from being
        # visible to the new exe's bootloader, which was causing the intermittent
        # "Failed to load Python DLL …\_MEI…\python311.dll" error on first launch
        # after an in-place self-update.
        #
        # The 5-second wait is intentionally conservative: os._exit(0) below is
        # nearly instant, but Windows file-system caches and antivirus may hold a
        # handle on the exe for a second or two after the process exits.
        # `move /y` (same volume) is an atomic rename; `Start-Process` creates a
        # new top-level process with no console/env inheritance.
        ps_launcher = os.path.join(target_dir, "pc-agent-start.ps1")
        safe_exe = current_exe.replace("'", "''")  # escape single-quotes for PS
        with open(ps_launcher, "w", encoding="utf-8") as f:
            f.write(f"Start-Process '{safe_exe}'\r\n")
        with open(batch_path, "w", encoding="utf-8") as f:
            f.write(
                "@echo off\r\n"
                "timeout /t 5 /nobreak >nul\r\n"
                f'move /y "{new_exe}" "{current_exe}" >nul\r\n'
                f'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass'
                f' -File "{ps_launcher}"\r\n'
                f'del "{ps_launcher}" >nul 2>&1\r\n'
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

def _on_quit_clicked(icon=None, _item=None) -> None:
    """Explicit quit from the tray menu.  Sets the flag BEFORE stopping the
    icon so _run_tray_mode can distinguish an intentional quit (process should
    exit) from a silent early return of icon.run() (we should stay alive and
    keep Flask running)."""
    global _quit_requested
    _quit_requested = True
    if icon is not None:
        icon.stop()

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
        pystray.MenuItem("Quit", _on_quit_clicked),
    )

def _run_tray_mode() -> bool:
    """Windows windowed-mode entry point: Flask runs in a daemon thread,
    pystray runs the Win32 message loop on the main thread (it requires
    that — calling Icon.run() from a worker thread silently does nothing).

    Returns True if the tray ran and exited normally (user clicked Quit),
    False if pystray failed to initialise so the caller can fall back to
    blocking app.run() instead.  Flask is started as a daemon thread first
    so the HTTP server is always up regardless of tray outcome."""
    global _tray_icon
    import threading

    # Start Flask in the background FIRST so the HTTP server is reachable
    # even if the tray initialisation subsequently fails.
    flask_thread = threading.Thread(
        target=lambda: app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False),
        daemon=True, name="flask-server",
    )
    flask_thread.start()
    threading.Thread(target=_update_worker_loop, daemon=True, name="update-worker").start()

    try:
        _tray_icon = pystray.Icon(
            "pc-monitor-agent",
            _make_tray_image(),
            f"PC Monitor Agent v{AGENT_VERSION}",
            _build_tray_menu(),
        )
        _tray_icon.run()  # blocks until icon.stop() is called
        # run() returned — was it an explicit Quit or a silent early return?
        if _quit_requested:
            print("User clicked Quit from tray menu — exiting.")
            return True   # caller should let the process exit
        # pystray returned without exception but without an explicit Quit
        # (e.g. Win32 message loop failed to create a window). Fall through
        # to headless mode.
        print("pystray.run() returned unexpectedly (no icon shown?); "
              "keeping Flask alive in headless mode")
        return False
    except Exception as e:
        print(f"pystray tray failed ({type(e).__name__}: {e}); "
              f"agent will keep running without a tray icon")
        return False


if __name__ == "__main__":
    # Note: stdout/stderr are already redirected to the log file at module
    # import time (see _redirect_stdio_to_logfile near the top), so prints
    # below are safe even in PyInstaller windowed mode.
    print(f"PC Agent starting on port {PORT}")
    print(f"API Key: {'set' if API_KEY else 'not set (open access)'}")
    print(f"TRAY_AVAILABLE={TRAY_AVAILABLE}")
    open_firewall_port(PORT)
    if TRAY_AVAILABLE:
        tray_ok = _run_tray_mode()
        if not tray_ok:
            # Tray failed but Flask daemon is already running in the
            # background (started inside _run_tray_mode before the tray
            # attempt).  Block the main thread so the process doesn't exit
            # and take down those daemon threads with it.
            print("Tray unavailable — agent running headless, HTTP only.")
            import threading
            threading.Event().wait()   # sleep forever; Ctrl+C / task-kill to stop
    else:
        # macOS / Linux / dev-from-source-without-pystray: original behavior.
        app.run(host="0.0.0.0", port=PORT, debug=False)
