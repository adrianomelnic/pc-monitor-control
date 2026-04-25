# PC Monitor Agent — one-line installer for Windows.
# Usage: powershell -c "irm https://raw.githubusercontent.com/adrianomelnic/pc-monitor-control/main/scripts/install.ps1 | iex"

$ErrorActionPreference = 'Stop'

$AgentUrl = 'https://raw.githubusercontent.com/adrianomelnic/pc-monitor-control/main/pc_agent.py'
$Dst      = Join-Path $env:USERPROFILE 'pc_agent.py'

Write-Host ''
Write-Host '== PC Monitor Agent installer ==' -ForegroundColor Cyan
Write-Host ''

# 1. Make sure Python is available.
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host 'Python was not found on PATH.' -ForegroundColor Red
    Write-Host 'Install Python 3.8+ from https://www.python.org/downloads/ and tick "Add Python to PATH",' -ForegroundColor Yellow
    Write-Host 'then re-run this command.' -ForegroundColor Yellow
    exit 1
}

# 2. Download pc_agent.py.
Write-Host "Downloading pc_agent.py to $Dst ..."
Invoke-WebRequest -Uri $AgentUrl -OutFile $Dst -UseBasicParsing

# 3. Install Python dependencies (quiet).
Write-Host 'Installing Python dependencies (psutil, flask, flask-cors) ...'
& python -m pip install --quiet --disable-pip-version-check --upgrade psutil flask flask-cors

# 4. Start the agent. pc_agent.py self-elevates via UAC on Windows.
Write-Host 'Starting PC Agent (Windows will prompt for admin so the firewall port can be opened) ...'
Start-Process -FilePath 'python' -ArgumentList "`"$Dst`""

Write-Host ''
Write-Host 'PC Agent is starting. Open the PC Monitor & Control app on your phone' -ForegroundColor Green
Write-Host 'and go to Add PC -> Step 2 to finish pairing.' -ForegroundColor Green
