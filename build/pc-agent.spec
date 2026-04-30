# PyInstaller spec for the PC Monitor Agent.
#
# Builds a single-file executable that bundles Python + psutil + Flask so the
# end user does NOT need to install anything. On Windows we additionally bundle
# LibreHardwareMonitorLib.dll (and its HidSharp dependency) so sensor data
# works out of the box without HWiNFO64. Runs on the same OS it was built on
# (PyInstaller is not a cross-compiler), so we rely on a CI matrix with
# windows-latest and macos-latest runners — see
# .github/workflows/build-agent.yml.
#
# Build locally:
#   pip install pyinstaller psutil flask flask-cors
#   pip install pythonnet                 # Windows only, for the LHM bridge
#   pyinstaller build/pc-agent.spec --clean --noconfirm
#
# Output:
#   dist/pc-agent.exe   (Windows)
#   dist/pc-agent       (macOS / Linux)

import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# pc_agent.py lives at the repo root. The spec file is run from the repo root
# (CI does `pyinstaller build/pc-agent.spec`), so `Path.cwd()` is the repo root.
ROOT = Path.cwd()
ENTRY_SCRIPT = str(ROOT / "pc_agent.py")

# Hidden imports that PyInstaller's static analysis does not always catch.
# psutil pulls in platform-specific submodules at runtime; flask_cors pulls in
# a few helpers via decorator metaclasses.
HIDDEN_IMPORTS = [
    "psutil",
    "psutil._common",
    "psutil._compat",
    "flask",
    "flask_cors",
    "werkzeug",
    "werkzeug.serving",
    "jinja2",
    "click",
    "itsdangerous",
]

# Windows-only: pythonnet powers the LibreHardwareMonitor integration.
# pyinstaller-hooks-contrib ships hook-pythonnet / hook-clr that bundle the
# Python.Runtime.dll bridge automatically — we just need to keep them visible.
DATAS = []
if sys.platform == "win32":
    HIDDEN_IMPORTS += [
        "winreg",
        "psutil._pswindows",
        "psutil._psutil_windows",
        "pythonnet",
        "clr",
        "clr_loader",
        "clr_loader.netfx",
        # System-tray UI: pystray uses Win32 APIs directly (no Tk), Pillow
        # generates the icon image programmatically.  We use collect_submodules
        # (evaluated at PyInstaller analysis time against the installed package)
        # so every pystray submodule is bundled regardless of version layout.
        *collect_submodules("pystray"),
        "PIL",
        "PIL.Image",
        "PIL.ImageDraw",
    ]
    # Bundle the LibreHardwareMonitor DLLs if vendor/ exists. The CI workflow
    # downloads them; in dev they're optional (the agent silently falls back
    # to HWiNFO64 if they're absent).
    vendor_dir = ROOT / "vendor"
    if vendor_dir.is_dir():
        for dll in vendor_dir.glob("*.dll"):
            DATAS.append((str(dll), "vendor"))
        print(f"[pc-agent.spec] bundling {len(DATAS)} DLL(s) from {vendor_dir}")
    else:
        print(f"[pc-agent.spec] WARNING: {vendor_dir} not found — LHM will be "
              f"unavailable in this build (HWiNFO64 fallback only)")
elif sys.platform == "darwin":
    HIDDEN_IMPORTS += ["psutil._psosx", "psutil._psutil_osx"]
else:
    HIDDEN_IMPORTS += ["psutil._pslinux", "psutil._psutil_linux"]


a = Analysis(
    [ENTRY_SCRIPT],
    pathex=[str(ROOT)],
    binaries=[],
    datas=DATAS,
    hiddenimports=HIDDEN_IMPORTS,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Trim some hefty stdlib bits we never use to keep the binary small.
        "tkinter",
        "unittest",
        "test",
        "pydoc_data",
    ],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="pc-agent",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    # Extract the bundled archive next to the exe instead of %TEMP%.
    # %TEMP% extractions are re-done on every launch AND get scanned by
    # Windows Defender each time — this is what causes the intermittent
    # "Failed to load Python DLL" error after an in-place self-update.
    # With runtime_tmpdir='.', PyInstaller creates _MEI<hash> in the same
    # directory as pc-agent.exe, keeps the files across restarts (no
    # re-extract when the hash matches), and avoids the AV-scan race.
    # '.' means the directory containing the exe, not the CWD.
    runtime_tmpdir="." if sys.platform == "win32" else None,
    # Windowed (no console) on Windows: the agent is a background service
    # whose UI surface is the tray icon, not a CLI tool — having a black
    # terminal window stay open after the user double-clicks pc-agent.exe
    # confused users into killing it (closing the window stops the agent).
    # Startup messages and errors are no longer dropped: pc_agent.py's
    # _setup_file_logging() redirects stdout/stderr to
    #   %LOCALAPPDATA%\PCMonitorAgent\agent.log
    # which the tray's "Show log file" menu item opens. macOS keeps the
    # console window for now (no tray UI yet on that platform).
    console=(sys.platform != "win32"),
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
