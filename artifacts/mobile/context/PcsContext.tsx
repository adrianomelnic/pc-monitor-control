import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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

interface PcsContextType {
  pcs: PC[];
  addPc: (pc: Omit<PC, "id" | "status">) => void;
  removePc: (id: string) => void;
  updatePc: (id: string, updates: Partial<PC>) => void;
  refreshPc: (id: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  sendCommand: (
    id: string,
    command: string,
    args?: string[]
  ) => Promise<{ success: boolean; output?: string; error?: string }>;
}

const PcsContext = createContext<PcsContextType>({} as PcsContextType);
const STORAGE_KEY = "pcs_v1";

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
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
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (pc.apiKey) headers["X-API-Key"] = pc.apiKey;

      const res = await fetchWithTimeout(
        buildUrl(pc, "/metrics"),
        { headers },
        12000
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
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
    pollingRef.current = setInterval(pollAll, 12000);
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

  const sendCommand = useCallback(
    async (
      id: string,
      command: string,
      args: string[] = []
    ): Promise<{ success: boolean; output?: string; error?: string }> => {
      const pc = pcs.find((p) => p.id === id);
      if (!pc) return { success: false, error: "PC not found" };
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (pc.apiKey) headers["X-API-Key"] = pc.apiKey;
        const res = await fetchWithTimeout(
          buildUrl(pc, "/command"),
          { method: "POST", headers, body: JSON.stringify({ command, args }) },
          20000
        );
        return await res.json();
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
      }, refreshAll, sendCommand }}
    >
      {children}
    </PcsContext.Provider>
  );
}

export const usePcs = () => useContext(PcsContext);
