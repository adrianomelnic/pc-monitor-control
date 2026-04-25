# Building the PC Agent binary

The agent is shipped to end users as a single executable so they never have
to install Python. PyInstaller does the bundling. CI builds the binaries on
real Windows and macOS runners — see `.github/workflows/build-agent.yml`.

## Releasing

Push a `v*` tag to the repo. CI will:

1. Build `pc-agent.exe` on `windows-latest` and `pc-agent` on `macos-latest`.
2. Create a GitHub Release for the tag.
3. Upload the binaries as release assets named `pc-agent-windows.exe` and
   `pc-agent-macos`.

Those names are hard-coded into the mobile app's pairing UI:

```
https://github.com/adrianomelnic/pc-monitor-control/releases/latest/download/pc-agent-windows.exe
https://github.com/adrianomelnic/pc-monitor-control/releases/latest/download/pc-agent-macos
```

So bump them with care.

## Building locally (smoke test)

```bash
pip install pyinstaller psutil flask flask-cors
pyinstaller build/pc-agent.spec --clean --noconfirm
./dist/pc-agent           # macOS / Linux
.\dist\pc-agent.exe       # Windows
```

The binary should print `PC Agent starting on port 8765` and start serving
HTTP. On Windows you will see a UAC prompt because the agent self-elevates to
add a firewall rule.

## Code signing

Neither binary is signed. End users will see scary warnings:

- **Windows**: SmartScreen "Windows protected your PC" → click "More info" →
  "Run anyway".
- **macOS**: Gatekeeper "cannot be opened because the developer cannot be
  verified" → right-click the binary → "Open" → confirm.

Adding a signing certificate is a separate task.
