# PyInstaller spec for the PC Monitor Agent.
#
# Builds a single-file executable that bundles Python + psutil + Flask so the
# end user does NOT need to install anything. Runs on the same OS it was
# built on (PyInstaller is not a cross-compiler), so we rely on a CI matrix
# with windows-latest and macos-latest runners — see
# .github/workflows/build-agent.yml.
#
# Build locally:
#   pip install pyinstaller psutil flask flask-cors
#   pyinstaller build/pc-agent.spec --clean --noconfirm
#
# Output:
#   dist/pc-agent.exe   (Windows)
#   dist/pc-agent       (macOS / Linux)

import sys
from pathlib import Path

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

if sys.platform == "win32":
    HIDDEN_IMPORTS += ["winreg", "psutil._pswindows", "psutil._psutil_windows"]
elif sys.platform == "darwin":
    HIDDEN_IMPORTS += ["psutil._psosx", "psutil._psutil_osx"]
else:
    HIDDEN_IMPORTS += ["psutil._pslinux", "psutil._psutil_linux"]


a = Analysis(
    [ENTRY_SCRIPT],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[],
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
    runtime_tmpdir=None,
    # Console mode: keeps a terminal window open so the user can see startup
    # logs ("PC Agent starting on port 8765 ...") and any errors. Critical
    # for a tool whose whole job is to be reachable from the phone — silent
    # failures are the worst possible outcome.
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
