import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const C = Colors.light;

const PYTHON_AGENT = `#!/usr/bin/env python3
"""
PC Monitor Agent - Run this on each computer you want to monitor.
Requires: python -m pip install psutil flask flask-cors
"""
import json, os, platform, time, socket
import psutil
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

API_KEY = os.environ.get("PC_AGENT_KEY", "")  # Set for security
PORT = int(os.environ.get("PC_AGENT_PORT", 8765))

def check_key():
    if API_KEY and request.headers.get("X-API-Key") != API_KEY:
        return jsonify({"error": "Unauthorized"}), 401

@app.route("/metrics")
def metrics():
    auth = check_key()
    if auth: return auth
    cpu = psutil.cpu_percent(interval=0.5)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    # rough net speed (sample 1s)
    time.sleep(1)
    net2 = psutil.net_io_counters()
    up = (net2.bytes_sent - net.bytes_sent) / 1024
    down = (net2.bytes_recv - net.bytes_recv) / 1024
    temps = {}
    try:
        temps = psutil.sensors_temperatures()
    except: pass
    temp = None
    for k, v in temps.items():
        if v: temp = v[0].current; break
    return jsonify({
        "os": platform.system() + " " + platform.release(),
        "hostname": socket.gethostname(),
        "metrics": {
            "cpuUsage": cpu,
            "ramUsage": round(ram.used / 1024 / 1024),
            "ramTotal": round(ram.total / 1024 / 1024),
            "diskUsage": round(disk.used / 1024 / 1024),
            "diskTotal": round(disk.total / 1024 / 1024),
            "networkUp": round(up, 1),
            "networkDown": round(down, 1),
            "uptime": int(time.time() - psutil.boot_time()),
            "temperature": temp,
            "processes": len(psutil.pids()),
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
        os.system("shutdown /s /t 5" if platform.system()=="Windows" else "sudo shutdown -h +0")
        return jsonify({"success": True, "output": "Shutting down..."})
    elif cmd == "restart":
        os.system("shutdown /r /t 5" if platform.system()=="Windows" else "sudo shutdown -r +0")
        return jsonify({"success": True, "output": "Restarting..."})
    elif cmd == "sleep":
        if platform.system() == "Windows":
            os.system("rundll32.exe powrprof.dll,SetSuspendState 0,1,0")
        elif platform.system() == "Darwin":
            os.system("pmset sleepnow")
        else:
            os.system("systemctl suspend")
        return jsonify({"success": True, "output": "Sleeping..."})
    elif cmd == "lock":
        if platform.system() == "Windows":
            os.system("rundll32.exe user32.dll,LockWorkStation")
        elif platform.system() == "Darwin":
            os.system("pmset displaysleepnow")
        else:
            os.system("loginctl lock-session")
        return jsonify({"success": True, "output": "Locked."})
    elif cmd == "run" and args:
        import subprocess
        try:
            result = subprocess.run(
                args, capture_output=True, text=True, timeout=30, shell=True
            )
            return jsonify({
                "success": result.returncode == 0,
                "output": result.stdout or result.stderr
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)})
    elif cmd == "volume":
        level = args[0] if args else "50"
        if platform.system() == "Windows":
            # Use nircmd or PowerShell
            os.system(f'powershell -command "(New-Object -ComObject WScript.Shell).SendKeys([char]174)"')
        return jsonify({"success": True, "output": f"Volume set"})
    elif cmd == "open":
        import subprocess
        app_name = " ".join(args)
        if platform.system() == "Windows":
            subprocess.Popen(["start", app_name], shell=True)
        elif platform.system() == "Darwin":
            subprocess.Popen(["open", "-a", app_name])
        else:
            subprocess.Popen([app_name])
        return jsonify({"success": True, "output": f"Opened {app_name}"})
    return jsonify({"success": False, "error": f"Unknown command: {cmd}"})

if __name__ == "__main__":
    print(f"PC Agent starting on port {PORT}")
    print(f"API Key: {'set' if API_KEY else 'not set (open access)'}")
    app.run(host="0.0.0.0", port=PORT)
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
    desc: 'Copy the script below and save it as pc_agent.py anywhere on your PC (e.g. your Desktop).',
  },
  {
    step: "4",
    title: "Run the agent",
    desc: "In Command Prompt, navigate to where you saved the file and run:",
    code: "python pc_agent.py",
  },
  {
    step: "5",
    title: "Find your PC's IP address",
    desc: 'On Windows, open Command Prompt and type "ipconfig". Look for your IPv4 Address (e.g. 192.168.1.100). Your phone must be on the same Wi-Fi network.',
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
        <Text style={styles.title}>PC Agent Setup</Text>
        <Text style={styles.subtitle}>
          Run the agent on any PC you want to control
        </Text>
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
              color={copied ? "#000" : "#000"}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 20,
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
    color: "#000",
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
    borderRadius: 8,
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
    borderRadius: 14,
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  copyBtnDone: {
    backgroundColor: C.success,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
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
    borderRadius: 10,
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
    borderRadius: 8,
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
