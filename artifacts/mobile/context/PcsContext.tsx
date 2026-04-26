import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { DEMO_PC_HOST, DEMO_PC_ID, DEMO_PC_META, generateDemoMetrics } from "@/lib/demoData";

// ─── Sensor reading from the PC agent (LibreHardwareMonitor or HWiNFO64) ──────
export interface SensorReading {
  label: string;
  value: number;
  unit: string;
  type: 'temperature' | 'voltage' | 'fan' | 'current' | 'power' | 'clock' | 'usage' | 'other';
  component?: string; // hardware component name (e.g. "CPU", "GPU [#0]")
}

// ─── Detailed component types ─────────────────────────────────────────────────

export interface CPUInfo {
  name: string;
  coresPhysical: number;
  coresLogical: number;
  freqCurrent: number;
  freqMax: number;
  usageTotal: number;
  usagePerCore: number[];
  temperature?: number;
  voltage?: number | null;
  power?: number | null;
}

export interface GPUInfo {
  name: string;
  usage: number | null;
  vramUsed: number | null;
  vramTotal: number | null;
  temperature?: number | null;
  clockGpu?: number | null;
  clockMem?: number | null;
  voltage?: number | null;
  power?: number | null;
}

export interface RAMInfo {
  used: number;
  total: number;
  available: number;
  percent: number;
  swapUsed: number;
  swapTotal: number;
  temperature?: number | null;
}

export interface FanInfo {
  label: string;
  rpm: number;
}

export interface DiskInfo {
  device: string;
  mountpoint: string;
  fstype: string;
  total: number;
  used: number;
  free: number;
  percent: number;
  readSpeed: number;
  writeSpeed: number;
  temperature?: number | null;
}

export interface NetworkInterface {
  name: string;
  speedUp: number;
  speedDown: number;
  totalSent: number;
  totalRecv: number;
  isUp: boolean;
  speedMax?: number | null;
}

export interface PCMetrics {
  // Flat fields (home card)
  cpuUsage: number;
  ramUsage: number;
  ramTotal: number;
  diskUsage: number;
  diskTotal: number;
  networkUp: number;
  networkDown: number;
  uptime: number;
  temperature?: number;
  processes?: number;
  // Detailed per-component
  cpu?: CPUInfo;
  gpu?: GPUInfo[];
  ram?: RAMInfo;
  fans?: FanInfo[];
  disks?: DiskInfo[];
  network?: NetworkInterface[];
  // All sensor readings the agent could enumerate (for custom sensor cards)
  sensors?: SensorReading[];
}

export interface PC {
  id: string;
  name: string;
  host: string;
  port: number;
  apiKey?: string;
  status: "online" | "offline" | "connecting";
  metrics?: PCMetrics;
  os?: string;
  // Version string reported by the running pc-agent (e.g. "0.1.0"). Mobile
  // shows this on the PC detail header so users can sanity-check that their
  // PC is on the latest release. Undefined for older agents that pre-date
  // the /version endpoint.
  agentVersion?: string;
  lastSeen?: Date;
  // Last failure reason from /metrics polling. Surfaced under the PC name
  // when the card is offline so users can tell the difference between
  // "agent not reachable on the LAN", "agent rejected our API key",
  // "agent returned malformed JSON", and "request timed out". Cleared on
  // every successful poll. Not persisted to AsyncStorage.
  lastError?: string;
}

export { DEMO_PC_HOST, DEMO_PC_ID };

interface PcsContextType {
  pcs: PC[];
  addPc: (pc: Omit<PC, "id" | "status">) => void;
  removePc: (id: string) => void;
  updatePc: (id: string, updates: Partial<PC>) => void;
  refreshPc: (id: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  addDemoMode: () => void;
  sendCommand: (
    id: string,
    command: string,
    args?: string[]
  ) => Promise<{ success: boolean; output?: string; error?: string }>;
}

const PcsContext = createContext<PcsContextType>({} as PcsContextType);
const STORAGE_KEY = "pcs_v1";

// Standard JSON does not allow NaN, Infinity, or -Infinity tokens, but
// Python's `json.dumps()` (which Flask's `jsonify` uses) emits them by
// default. The pc-agent's /metrics output can contain these whenever a
// hardware sensor is unreadable (LibreHardwareMonitor returns float NaN
// for failed channels). When that happens, JS `JSON.parse` throws — and
// without this fallback a single broken sensor reading would make the
// whole PC appear offline. Try a sanitized re-parse before giving up.
//
// Walks the response character-by-character so the rewrite is restricted
// to *value* positions; tokens inside string literals (e.g. a sensor
// label like "Infinity Fabric Clock") are copied through verbatim. A
// naive `\b(?:-?Infinity|NaN)\b` regex would corrupt those strings.
function sanitizeNonFiniteJsonTokens(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text.charCodeAt(i);
    // Copy a JSON string literal (including escapes) verbatim.
    if (ch === 0x22 /* " */) {
      out += '"';
      i++;
      while (i < n) {
        const cc = text.charCodeAt(i);
        if (cc === 0x5c /* \ */ && i + 1 < n) {
          out += text[i] + text[i + 1];
          i += 2;
          continue;
        }
        out += text[i];
        i++;
        if (cc === 0x22 /* " */) break;
      }
      continue;
    }
    // Outside a string, look for the three non-finite tokens.
    if (ch === 0x4e /* N */ && text.startsWith("NaN", i)) {
      out += "null";
      i += 3;
      continue;
    }
    if (ch === 0x49 /* I */ && text.startsWith("Infinity", i)) {
      out += "null";
      i += 8;
      continue;
    }
    if (ch === 0x2d /* - */ && text.startsWith("-Infinity", i)) {
      out += "null";
      i += 9;
      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(sanitizeNonFiniteJsonTokens(text));
  }
}

function xhrGet(url: string, headers: Record<string, string>, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timer = setTimeout(() => { xhr.abort(); reject(new Error("Timeout")); }, timeoutMs);
    xhr.onload = () => {
      clearTimeout(timer);
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(safeJsonParse(xhr.responseText)); }
        catch { reject(new Error(`Parse error`)); }
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => { clearTimeout(timer); reject(new Error("Network error")); };
    xhr.onabort = () => { clearTimeout(timer); reject(new Error("Timeout")); };
    xhr.open("GET", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send();
  });
}

function xhrPost(url: string, headers: Record<string, string>, body: string, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timer = setTimeout(() => { xhr.abort(); reject(new Error("Timeout")); }, timeoutMs);
    xhr.onload = () => {
      clearTimeout(timer);
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error(`Parse error`)); }
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => { clearTimeout(timer); reject(new Error("Network error")); };
    xhr.onabort = () => { clearTimeout(timer); reject(new Error("Timeout")); };
    xhr.open("POST", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(body);
  });
}

export function PcsProvider({ children }: { children: React.ReactNode }) {
  const [pcs, setPcs] = useState<PC[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Per-PC single-flight lock for /metrics polling. The pc-agent's
  // LibreHardwareMonitor reader uses a shared .NET `Computer` object that
  // is NOT thread-safe — two simultaneous `_LHM_COMPUTER.Accept(...)`
  // calls from concurrent Flask request threads will race and hang both,
  // and the mobile-side timeout fires for every poll thereafter. The
  // initial burst from `addPc` + the `[pcs.length]` `useEffect` (further
  // doubled by React StrictMode in dev) easily fires 3–5 simultaneous
  // requests, which triggers exactly that scenario. Skipping a poll when
  // one is already in flight for the same PC keeps the agent at one
  // concurrent reader and unblocks the home card on the user's next
  // app reload — no PC-side re-install required.
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as PC[];
          setPcs(saved.map((p) => ({ ...p, status: "connecting" as const })));
        } catch {}
      }
    });
  }, []);

  const savePcs = useCallback((updated: PC[]) => {
    // Strip volatile fields — `metrics` and `status` are recomputed on every
    // poll and `lastError` is only meaningful for the current session.
    const toSave = updated.map(
      ({ metrics, status, lastError, ...rest }) => rest
    );
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, []);

  // Merge a fetchMetrics result into the PC list. Persists only on
  // *meaningful* transitions — not on every poll — so AsyncStorage
  // doesn't take a write every 2s per online PC. The triggers:
  //   - First successful poll for a PC (lastSeen previously undefined).
  //     Without this, a phone restart wipes lastSeen and the card falls
  //     back to "Never connected" even though the agent is responding.
  //   - Status change (e.g. online → offline). Captures the latest
  //     lastSeen at the moment we lose connectivity, so the offline view
  //     after app restart shows "Last seen 2:34 PM" rather than the
  //     timestamp from when the PC was first added hours ago.
  //   - os or agentVersion changes (rare — Windows version bump, agent
  //     auto-update, etc.).
  const applyUpdate = useCallback(
    (id: string, updates: Partial<PC>) => {
      setPcs((cur) => {
        const prev = cur.find((p) => p.id === id);
        const next = cur.map((p) => (p.id === id ? { ...p, ...updates } : p));
        if (!prev) return next;

        const firstConnection =
          prev.lastSeen === undefined && updates.lastSeen !== undefined;
        const statusChanged =
          updates.status !== undefined && updates.status !== prev.status;
        const osChanged =
          updates.os !== undefined && updates.os !== prev.os;
        const versionChanged =
          updates.agentVersion !== undefined &&
          updates.agentVersion !== prev.agentVersion;

        if (firstConnection || statusChanged || osChanged || versionChanged) {
          savePcs(next);
        }
        return next;
      });
    },
    [savePcs]
  );

  const buildUrl = (pc: PC, path: string) =>
    `http://${pc.host}:${pc.port}${path}`;

  const fetchMetrics = useCallback(async (pc: PC): Promise<Partial<PC>> => {
    // Demo mode: generate data locally, no network call
    if (pc.host === DEMO_PC_HOST) {
      return {
        status: "online",
        metrics: generateDemoMetrics(),
        os: "Windows 11 Pro",
        agentVersion: "demo",
        lastSeen: new Date(),
      };
    }
    try {
      const headers: Record<string, string> = {};
      if (pc.apiKey) headers["X-API-Key"] = pc.apiKey;
      const data = await xhrGet(buildUrl(pc, "/metrics"), headers, 12000);
      const updates: Partial<PC> = {
        status: "online",
        metrics: data.metrics,
        os: data.os,
        lastSeen: new Date(),
        // Clear any stale failure reason now that we've succeeded.
        lastError: undefined,
      };
      // Older agents (pre-/version) don't include agentVersion in /metrics —
      // when the field is missing we leave the previous value untouched
      // rather than spreading `undefined` over it.
      if (typeof data.agentVersion === "string") {
        updates.agentVersion = data.agentVersion;
      }
      return updates;
    } catch (err) {
      // Surface the actual reason in dev logs so a "stuck on Offline" report
      // (network unreachable vs. parse error vs. HTTP 401) is diagnosable
      // without needing to attach a debugger.
      if (__DEV__) {
        console.warn(
          `[PcsContext] /metrics ${pc.host}:${pc.port} failed:`,
          err
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      return { status: "offline", lastError: message };
    }
  }, []);

  // Fire one /metrics fetch for a PC, but only if none is in flight for
  // that PC yet. Returns immediately when a poll is already pending so
  // the burst that fires after `addPc` (StrictMode + addPc + useEffect)
  // does not stack 3+ concurrent requests against the agent's
  // single-threaded LHM reader.
  const pollOne = useCallback(
    (pc: PC) => {
      if (inFlight.current.has(pc.id)) return;
      inFlight.current.add(pc.id);
      fetchMetrics(pc)
        .then((updates) => applyUpdate(pc.id, updates))
        .finally(() => {
          inFlight.current.delete(pc.id);
        });
    },
    [fetchMetrics, applyUpdate]
  );

  const pollAll = useCallback(() => {
    setPcs((prev) => {
      prev.forEach((pc) => pollOne(pc));
      return prev;
    });
  }, [pollOne]);

  const refreshAll = useCallback(async () => {
    setPcs((prev) => {
      prev.forEach((pc) => pollOne(pc));
      return prev.map((p) => ({ ...p, status: "connecting" as const }));
    });
  }, [pollOne]);

  useEffect(() => {
    if (pcs.length === 0) return;
    pollAll();
    pollingRef.current = setInterval(pollAll, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pcs.length]);

  const addPc = useCallback(
    (pc: Omit<PC, "id" | "status">) => {
      const newPc: PC = {
        ...pc,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        status: "connecting",
      };
      setPcs((prev) => {
        const updated = [...prev, newPc];
        savePcs(updated);
        return updated;
      });
      // Trigger the first poll OUTSIDE the setState updater. React StrictMode
      // (and React 18 in general) intentionally invokes setState updaters
      // twice in dev to surface impure code; firing fetchMetrics inside the
      // updater therefore stacks two simultaneous /metrics requests, which
      // races the agent's shared LHM .NET object. pollOne's single-flight
      // guards us further against the [pcs.length] useEffect that pollAll's
      // right after this call.
      pollOne(newPc);
    },
    [savePcs, pollOne]
  );

  const removePc = useCallback(
    (id: string) => {
      setPcs((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        savePcs(updated);
        return updated;
      });
    },
    [savePcs]
  );

  const updatePc = useCallback(
    (id: string, updates: Partial<PC>) => {
      setPcs((prev) => {
        const updated = prev.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        );
        savePcs(updated);
        return updated;
      });
    },
    [savePcs]
  );

  const addDemoMode = useCallback(() => {
    setPcs((prev) => {
      if (prev.some((p) => p.host === DEMO_PC_HOST)) return prev; // already added
      const demoPc: PC = {
        ...DEMO_PC_META,
        id: DEMO_PC_ID,
        status: "connecting",
      };
      const updated = [...prev, demoPc];
      savePcs(updated);
      return updated;
    });
    pollOne({ ...DEMO_PC_META, id: DEMO_PC_ID, status: "connecting" });
  }, [savePcs, pollOne]);

  const sendCommand = useCallback(
    async (
      id: string,
      command: string,
      args: string[] = []
    ): Promise<{ success: boolean; output?: string; error?: string }> => {
      const pc = pcs.find((p) => p.id === id);
      if (!pc) return { success: false, error: "PC not found" };
      // Demo mode: simulate command responses
      if (pc.host === DEMO_PC_HOST) {
        await new Promise((r) => setTimeout(r, 600));
        if (command === "lock") return { success: true, output: "[Demo] Screen locked" };
        if (command === "sleep") return { success: true, output: "[Demo] PC going to sleep" };
        if (command === "shutdown") return { success: true, output: "[Demo] Shutdown initiated" };
        if (command === "restart") return { success: true, output: "[Demo] Restarting..." };
        return { success: true, output: `[Demo] Command '${command}' executed` };
      }
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (pc.apiKey) headers["X-API-Key"] = pc.apiKey;
        const data = await xhrPost(
          buildUrl(pc, "/command"),
          headers,
          JSON.stringify({ command, args }),
          20000
        );
        return data;
      } catch (e: any) {
        return { success: false, error: e?.message || "Connection failed" };
      }
    },
    [pcs]
  );

  return (
    <PcsContext.Provider
      value={{ pcs, addPc, removePc, updatePc, refreshPc: async (id) => {
        const pc = pcs.find((p) => p.id === id);
        if (!pc) return;
        setPcs((prev) => prev.map((p) => p.id === id ? { ...p, status: "connecting" } : p));
        pollOne(pc);
      }, refreshAll, addDemoMode, sendCommand }}
    >
      {children}
    </PcsContext.Provider>
  );
}

export const usePcs = () => useContext(PcsContext);
