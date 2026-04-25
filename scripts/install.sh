#!/usr/bin/env bash
# PC Monitor Agent — one-line installer for macOS / Linux.
# Usage: curl -fsSL https://raw.githubusercontent.com/adrianomelnic/pc-monitor-control/main/scripts/install.sh | bash

set -e

AGENT_URL='https://raw.githubusercontent.com/adrianomelnic/pc-monitor-control/main/pc_agent.py'
DST="$HOME/pc_agent.py"

echo
echo '== PC Monitor Agent installer =='
echo

# 1. Make sure python3 is available.
if ! command -v python3 >/dev/null 2>&1; then
  echo 'python3 was not found on PATH.' >&2
  echo 'Install Python 3.8+ from https://www.python.org/downloads/ and re-run this command.' >&2
  exit 1
fi

# 2. Download pc_agent.py.
echo "Downloading pc_agent.py to $DST ..."
curl -fsSL "$AGENT_URL" -o "$DST"

# 3. Install Python dependencies (quiet).
echo 'Installing Python dependencies (psutil, flask, flask-cors) ...'
python3 -m pip install --quiet --disable-pip-version-check --upgrade psutil flask flask-cors

# 4. Start the agent in the background and write logs somewhere predictable.
case "$(uname -s)" in
  Darwin) LOGDIR="$HOME/Library/Logs" ;;
  *)      LOGDIR="$HOME/.local/state" ;;
esac
mkdir -p "$LOGDIR"
LOGFILE="$LOGDIR/pc_agent.log"

echo "Starting PC Agent in background ..."
nohup python3 "$DST" >"$LOGFILE" 2>&1 &
disown >/dev/null 2>&1 || true

echo
echo "PC Agent is running. Logs: $LOGFILE"
echo 'Open the PC Monitor & Control app on your phone and go to Add PC -> Step 2 to finish pairing.'
