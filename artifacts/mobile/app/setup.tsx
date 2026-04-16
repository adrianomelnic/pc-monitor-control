import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme } from "@/constants/themes";
import { useTheme } from "@/context/ThemeContext";

const PYTHON_AGENT = `#!/usr/bin/env python3
"""
PC Monitor Agent v2 - Full hardware monitoring.
Install: python -m pip install psutil flask flask-cors
Run: python pc_agent.py  (auto-elevates to admin on Windows via UAC)
"""
import os, platform, subprocess, time, socket, re, ctypes, sys
import psutil
from flask import Flask, jsonify, request
from flask_cors import CORS

IS_WINDOWS = platform.system() == "Windows"
IS_MAC = platform.system() == "Darwin"

# ── Auto-elevate to admin on Windows ────────────────────────────────────────
def _ensure_admin():
    if not IS_WINDOWS:
        return
    try:
        already_admin = ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        already_admin = False
    if not already_admin:
        # Re-launch this script with UAC elevation and exit the current process
        params = " ".join(f'"{a}"' for a in sys.argv)
        ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, params, None, 1)
        sys.exit(0)

_ensure_admin()
# ── End admin elevation ──────────────────────────────────────────────────────

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
                r"HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0")
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
                capture_output=True, text=True, timeout=8)
            name = r.stdout.strip()
            if name:
                return name
        except Exception:
            pass
        # 3) wmic legacy fallback
        try:
            r = subprocess.run(["wmic", "cpu", "get", "name"],
                               capture_output=True, text=True, timeout=5)
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
            capture_output=True, text=True, timeout=8
        )
        if r.returncode == 0:
            return [l.strip() for l in r.stdout.strip().splitlines() if l.strip()]
    except Exception:
        pass
    if IS_WINDOWS:
        try:
            r = subprocess.run(
                ["wmic", "path", "win32_videocontroller", "get", "name"],
                capture_output=True, text=True, timeout=5
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
            capture_output=True, check=False
        )
        print(f"Firewall rule added for port {port} (or already exists)")
    except Exception as e:
        print(f"Could not add firewall rule: {e}")

def read_hwinfo64():
    """Read sensor data from HWiNFO64 shared memory (Windows only).
    HWiNFO64 must be running with 'Shared Memory Support' enabled:
    HWiNFO64 -> Settings -> HWiNFO64 -> check 'Shared Memory Support'.
    Returns dict with 'temps' and 'fans', or None if unavailable.
    """
    if not IS_WINDOWS:
        return None
    try:
        import ctypes, struct
        HWINFO_SM2_KEY = "Global\\\\HWiNFO_SENS_SM2"
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
                cut = s.find('\\x00')
                return (s[:cut] if cut >= 0 else s).strip()
            # Non-null second byte → ASCII / Latin-1 (new HWiNFO v7+ format)
            cut = raw.find(b'\\x00')
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
            capture_output=True, text=True, timeout=5
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
                dev_key = part.device.replace("\\\\\\\\.\\\\", "").rstrip("\\\\").rstrip(":")
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

    hwinfo_data = read_hwinfo64()
    cpu_info = get_cpu_info(hwinfo_data)
    gpu_info = get_gpu_info()
    ram_info = get_ram_info()
    ram_info["temperature"] = get_memory_temp_hwinfo(hwinfo_data)
    fans = get_fans(hwinfo_data)
    disks, new_disk_io = get_disks(_prev_disk_io, elapsed)
    network, new_net_io = get_network(_prev_net_io, elapsed)

    _prev_disk_io = new_disk_io
    _prev_net_io = new_net_io
    _prev_time = now

    # Flat fields for backward compat
    primary_disk = disks[0] if disks else None
    net_up = sum(i["speedUp"] for i in network)
    net_down = sum(i["speedDown"] for i in network)

    return jsonify({
        "os": platform.system() + " " + platform.release(),
        "hostname": socket.gethostname(),
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
            "sensors": hwinfo_data.get("sensors", []) if hwinfo_data else [],
        }
    })

@app.route("/command", methods=["POST"])
def command():
    auth = check_key()
    if auth: return auth
    data = request.json or {}
    cmd = data.get("command", "")
    args = data.get("args", [])

    if cmd == "shutdown":
        if IS_WINDOWS:
            subprocess.Popen("shutdown /s /t 5", shell=True)
        elif IS_MAC:
            subprocess.Popen("sudo shutdown -h +0", shell=True)
        else:
            subprocess.Popen("sudo shutdown -h +0", shell=True)
        return jsonify({"success": True, "output": "Shutting down in 5 seconds..."})

    elif cmd == "restart":
        if IS_WINDOWS:
            subprocess.Popen("shutdown /r /t 5", shell=True)
        else:
            subprocess.Popen("sudo shutdown -r +0", shell=True)
        return jsonify({"success": True, "output": "Restarting in 5 seconds..."})

    elif cmd == "sleep":
        if IS_WINDOWS:
            subprocess.Popen("rundll32.exe powrprof.dll,SetSuspendState 0,1,0", shell=True)
        elif IS_MAC:
            subprocess.Popen("pmset sleepnow", shell=True)
        else:
            subprocess.Popen("systemctl suspend", shell=True)
        return jsonify({"success": True, "output": "Going to sleep..."})

    elif cmd == "lock":
        if IS_WINDOWS:
            subprocess.Popen("rundll32.exe user32.dll,LockWorkStation", shell=True)
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
                timeout=30, shell=True
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

@app.route("/hwinfo_debug")
def hwinfo_debug():
    """Diagnostic endpoint — call from a browser on the PC to check HWiNFO64 shared memory."""
    if not IS_WINDOWS:
        return jsonify({"status": "not_windows", "detail": "HWiNFO64 is Windows-only."})
    try:
        import ctypes, struct
        HWINFO_SM2_KEY = "Global\\\\HWiNFO_SENS_SM2"
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
                cut = s.find('\\x00')
                return (s[:cut] if cut >= 0 else s).strip()
            cut = raw.find(b'\\x00')
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


if __name__ == "__main__":
    print(f"PC Agent starting on port {PORT}")
    print(f"API Key: {'set' if API_KEY else 'not set (open access)'}")
    open_firewall_port(PORT)
    app.run(host="0.0.0.0", port=PORT, debug=False)
`;

const STEPS = [
  {
    step: "1",
    title: "Install Python",
    desc: 'Download Python 3.8+ from python.org. On Windows, check "Add Python to PATH" during install.',
    code: "python --version",
  },
  {
    step: "2",
    title: "Install dependencies",
    desc: "Open Command Prompt (Windows) or Terminal (Mac/Linux) and run:",
    code: "python -m pip install psutil flask flask-cors",
    note: 'Use "python -m pip" — plain "pip" may not be recognized on Windows.',
  },
  {
    step: "3",
    title: "Save the agent script",
    desc: "Copy the script below and save it as pc_agent.py on your Desktop or Documents folder.",
  },
  {
    step: "4",
    title: "Run as Administrator (Windows)",
    desc: "Right-click Command Prompt → Run as administrator. Navigate to the file and run:",
    code: "python pc_agent.py",
    note: "Running as Admin lets the agent automatically open the firewall port so your phone can connect.",
  },
  {
    step: "5",
    title: "Find your PC's IP address",
    desc: 'Run ipconfig in Command Prompt and look for your IPv4 Address (e.g. 192.168.1.100). Your phone must be on the same Wi-Fi network.',
    code: "ipconfig",
  },
  {
    step: "6",
    title: "Add your PC in the app",
    desc: "Go to the My PCs tab, tap +, enter the name, IP address, and port 8765.",
  },
];


export default function AgentScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const C = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [copied, setCopied] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const copyAgent = async () => {
    await Clipboard.setStringAsync(PYTHON_AGENT);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <ScrollView
      style={[styles.root, { paddingTop: topPad }]}
      contentContainerStyle={{ paddingBottom: 100 + bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>PC Agent Setup</Text>
          <Text style={styles.subtitle}>
            Run the agent on any PC you want to control
          </Text>
        </View>
      </View>

      {STEPS.map((s) => (
        <View key={s.step} style={styles.step}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>{s.step}</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepDesc}>{s.desc}</Text>
            {s.code && (
              <View style={styles.codeBlock}>
                <Text style={styles.codeText}>{s.code}</Text>
              </View>
            )}
            {s.note && (
              <View style={styles.noteBox}>
                <Feather name="info" size={12} color={C.warning} />
                <Text style={styles.noteText}>{s.note}</Text>
              </View>
            )}
          </View>
        </View>
      ))}

      <View style={styles.agentSection}>
        <View style={styles.agentHeader}>
          <View>
            <Text style={styles.agentTitle}>pc_agent.py</Text>
            <Text style={styles.agentSub}>Copy this to your PC</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.copyBtn,
              copied && styles.copyBtnDone,
              pressed && { opacity: 0.8 },
            ]}
            onPress={copyAgent}
          >
            <Feather
              name={copied ? "check" : "copy"}
              size={14}
              color="#fff"
            />
            <Text style={styles.copyBtnText}>{copied ? "Copied!" : "Copy"}</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.codeScroll}
        >
          <Text style={styles.agentCode}>{PYTHON_AGENT}</Text>
        </ScrollView>
      </View>

      <View style={styles.tipBox}>
        <Feather name="shield" size={14} color={C.tint} />
        <Text style={styles.tipText}>
          Set <Text style={styles.tipCode}>PC_AGENT_KEY=yourkey</Text> env var and enter it in the app for secure access.
        </Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: Theme) => {
  const C = theme.colors;
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.buttonRadius,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: C.textSecondary,
    marginTop: 4,
  },
  step: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 20,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  stepNumText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
  },
  stepDesc: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 19,
  },
  codeBlock: {
    backgroundColor: C.card,
    borderRadius: 4,
    padding: 10,
    marginTop: 4,
  },
  codeText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    color: C.tint,
  },
  agentSection: {
    backgroundColor: C.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: "hidden",
    marginBottom: 16,
  },
  agentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  agentTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  agentSub: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.tint,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  copyBtnDone: {
    backgroundColor: C.success,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  codeScroll: {
    maxHeight: 300,
  },
  agentCode: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    color: C.textSecondary,
    padding: 14,
    lineHeight: 18,
  },
  tipBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(0, 212, 255, 0.07)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 212, 255, 0.2)",
    padding: 14,
    alignItems: "flex-start",
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
  },
  tipCode: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: C.tint,
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "rgba(255, 184, 0, 0.08)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.25)",
    padding: 10,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: C.warning,
    lineHeight: 17,
  },
  });
};
