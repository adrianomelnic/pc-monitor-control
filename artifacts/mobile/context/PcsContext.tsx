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

// ─── Sensor reading from HWiNFO64 (all types) ─────────────────────────────────
export interface SensorReading {
  label: string;
  value: number;
  unit: string;
  type: 'temperature' | 'voltage' | 'fan' | 'current' | 'power' | 'clock' | 'usage' | 'other';
  component?: string; // hardware component name from HWiNFO64 (e.g. "CPU [#0]", "GPU [#0]")
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
  // All HWiNFO64 readings (for custom sensor cards)
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
  lastSeen?: Date;
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

function xhrGet(url: string, headers: Record<string, string>, timeoutMs: number): Promise<any> {
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
    const toSave = updated.map(({ metrics, status, ...rest }) => rest);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, []);

  const buildUrl = (pc: PC, path: string) =>
    `http://${pc.host}:${pc.port}${path}`;

  const fetchMetrics = useCallback(async (pc: PC): Promise<Partial<PC>> => {
    // Demo mode: generate data locally, no network call
    if (pc.host === DEMO_PC_HOST) {
      return {
        status: "online",
        metrics: generateDemoMetrics(),
        os: "Windows 11 Pro",
        lastSeen: new Date(),
      };
    }
    try {
      const headers: Record<string, string> = {};
      if (pc.apiKey) headers["X-API-Key"] = pc.apiKey;
      const data = await xhrGet(buildUrl(pc, "/metrics"), headers, 12000);
      return {
        status: "online",
        metrics: data.metrics,
        os: data.os,
        lastSeen: new Date(),
      };
    } catch {
      return { status: "offline" };
    }
  }, []);

  const pollAll = useCallback(() => {
    setPcs((prev) => {
      prev.forEach((pc) => {
        fetchMetrics(pc).then((updates) => {
          setPcs((cur) =>
            cur.map((p) => (p.id === pc.id ? { ...p, ...updates } : p))
          );
        });
      });
      return prev;
    });
  }, [fetchMetrics]);

  const refreshAll = useCallback(async () => {
    setPcs((prev) => {
      prev.forEach((pc) => {
        fetchMetrics(pc).then((updates) => {
          setPcs((cur) =>
            cur.map((p) => (p.id === pc.id ? { ...p, ...updates } : p))
          );
        });
      });
      return prev.map((p) => ({ ...p, status: "connecting" as const }));
    });
  }, [fetchMetrics]);

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
        fetchMetrics(newPc).then((updates) => {
          setPcs((cur) =>
            cur.map((p) => (p.id === newPc.id ? { ...p, ...updates } : p))
          );
        });
        return updated;
      });
    },
    [savePcs, fetchMetrics]
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
      fetchMetrics(demoPc).then((upd) => {
        setPcs((cur) => cur.map((p) => (p.id === DEMO_PC_ID ? { ...p, ...upd } : p)));
      });
      return updated;
    });
  }, [savePcs, fetchMetrics]);

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
        setPcs((prev) => {
          const pc = prev.find((p) => p.id === id);
          if (!pc) return prev;
          fetchMetrics(pc).then((updates) => {
            setPcs((cur) => cur.map((p) => (p.id === id ? { ...p, ...updates } : p)));
          });
          return prev.map((p) => p.id === id ? { ...p, status: "connecting" } : p);
        });
      }, refreshAll, addDemoMode, sendCommand }}
    >
      {children}
    </PcsContext.Provider>
  );
}

export const usePcs = () => useContext(PcsContext);
