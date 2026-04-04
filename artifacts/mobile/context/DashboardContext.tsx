import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BuiltinCardKind = "thermals" | "cpu" | "gpu" | "ram" | "fans" | "disks" | "network";

export interface BuiltinCardConfig {
  id: BuiltinCardKind;
  kind: BuiltinCardKind;
  visible: boolean;
  customTitle?: string;
  extraSensors?: string[];
  hiddenFields?: string[];
  fieldOrder?: string[];
  fieldAliases?: Record<string, string>;
  sensorIcons?: Record<string, string>;
}

export interface CustomCardConfig {
  id: string;
  kind: "custom";
  visible: boolean;
  title: string;
  sensorLabels: string[];
  accentColor: string;
  icon: string;
  sensorAliases?: Record<string, string>;
}

export type CardConfig = BuiltinCardConfig | CustomCardConfig;

export const BUILTIN_DEFAULTS: BuiltinCardConfig[] = [
  { id: "thermals", kind: "thermals", visible: true },
  { id: "cpu",      kind: "cpu",      visible: true },
  { id: "gpu",      kind: "gpu",      visible: true },
  { id: "ram",      kind: "ram",      visible: true },
  { id: "fans",     kind: "fans",     visible: false },
  { id: "disks",    kind: "disks",    visible: true },
  { id: "network",  kind: "network",  visible: true },
];

export const ACCENT_COLORS = [
  "#00D4FF", "#34D399", "#A78BFA", "#FB923C",
  "#F472B6", "#FBBF24", "#60A5FA", "#2DD4BF",
];

// ─── Context ──────────────────────────────────────────────────────────────────

interface DashboardContextType {
  getCards: (pcId: string) => CardConfig[];
  toggleCard: (pcId: string, cardId: string) => void;
  moveCard: (pcId: string, cardId: string, direction: "up" | "down") => void;
  addCustomCard: (pcId: string, title: string, sensorLabels: string[], accentColor: string, icon: string) => void;
  removeCard: (pcId: string, cardId: string) => void;
  updateCustomCard: (
    pcId: string,
    cardId: string,
    updates: Partial<Pick<CustomCardConfig, "title" | "sensorLabels" | "accentColor" | "icon" | "sensorAliases">>
  ) => void;
  updateBuiltinCard: (pcId: string, cardId: BuiltinCardKind, updates: { customTitle?: string; extraSensors?: string[]; hiddenFields?: string[]; fieldOrder?: string[]; fieldAliases?: Record<string, string>; sensorIcons?: Record<string, string> }) => void;
}

const DashboardContext = createContext<DashboardContextType>({} as DashboardContextType);

function storageKey(pcId: string) {
  return `dashboard_v2_${pcId}`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  // layouts[pcId] = CardConfig[]
  const [layouts, setLayouts] = useState<Record<string, CardConfig[]>>({});

  const loadLayout = useCallback(async (pcId: string): Promise<CardConfig[]> => {
    try {
      const raw = await AsyncStorage.getItem(storageKey(pcId));
      if (raw) {
        let saved = JSON.parse(raw) as CardConfig[];
        // Migration: fans card replaced by Thermals & Fans — hide it
        saved = saved.map((c) => c.id === "fans" ? { ...c, visible: false } : c);
        // Merge: ensure all builtins exist (user may have added cards to the agent)
        const builtinIds = BUILTIN_DEFAULTS.map((b) => b.id);
        const savedBuiltinIds = saved.filter((c) => c.kind !== "custom").map((c) => c.id);
        const missing = BUILTIN_DEFAULTS.filter((b) => !savedBuiltinIds.includes(b.id as BuiltinCardKind));
        return [...saved, ...missing];
      }
    } catch {}
    return [...BUILTIN_DEFAULTS];
  }, []);

  const getCards = useCallback((pcId: string): CardConfig[] => {
    if (layouts[pcId]) return layouts[pcId];
    // Kick off async load and return defaults for now
    loadLayout(pcId).then((cards) => {
      setLayouts((prev) => ({ ...prev, [pcId]: cards }));
    });
    return [...BUILTIN_DEFAULTS];
  }, [layouts, loadLayout]);

  const saveLayout = useCallback((pcId: string, cards: CardConfig[]) => {
    AsyncStorage.setItem(storageKey(pcId), JSON.stringify(cards));
    setLayouts((prev) => ({ ...prev, [pcId]: cards }));
  }, []);

  const toggleCard = useCallback((pcId: string, cardId: string) => {
    setLayouts((prev) => {
      const cards = prev[pcId] ?? [...BUILTIN_DEFAULTS];
      const updated = cards.map((c) =>
        c.id === cardId ? { ...c, visible: !c.visible } : c
      );
      AsyncStorage.setItem(storageKey(pcId), JSON.stringify(updated));
      return { ...prev, [pcId]: updated };
    });
  }, []);

  const moveCard = useCallback((pcId: string, cardId: string, direction: "up" | "down") => {
    setLayouts((prev) => {
      const cards = [...(prev[pcId] ?? [...BUILTIN_DEFAULTS])];
      const idx = cards.findIndex((c) => c.id === cardId);
      if (idx === -1) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= cards.length) return prev;
      [cards[idx], cards[swapIdx]] = [cards[swapIdx], cards[idx]];
      AsyncStorage.setItem(storageKey(pcId), JSON.stringify(cards));
      return { ...prev, [pcId]: cards };
    });
  }, []);

  const addCustomCard = useCallback((pcId: string, title: string, sensorLabels: string[], accentColor: string, icon: string) => {
    setLayouts((prev) => {
      const cards = [...(prev[pcId] ?? [...BUILTIN_DEFAULTS])];
      const newCard: CustomCardConfig = {
        id: `custom_${Date.now()}`,
        kind: "custom",
        visible: true,
        title,
        sensorLabels,
        accentColor,
        icon,
      };
      const updated = [...cards, newCard];
      AsyncStorage.setItem(storageKey(pcId), JSON.stringify(updated));
      return { ...prev, [pcId]: updated };
    });
  }, []);

  const removeCard = useCallback((pcId: string, cardId: string) => {
    setLayouts((prev) => {
      const cards = (prev[pcId] ?? [...BUILTIN_DEFAULTS]).filter((c) => c.id !== cardId);
      AsyncStorage.setItem(storageKey(pcId), JSON.stringify(cards));
      return { ...prev, [pcId]: cards };
    });
  }, []);

  const updateCustomCard = useCallback((
    pcId: string,
    cardId: string,
    updates: Partial<Pick<CustomCardConfig, "title" | "sensorLabels" | "accentColor">>
  ) => {
    setLayouts((prev) => {
      const cards = (prev[pcId] ?? [...BUILTIN_DEFAULTS]).map((c) =>
        c.id === cardId && c.kind === "custom" ? { ...c, ...updates } : c
      );
      AsyncStorage.setItem(storageKey(pcId), JSON.stringify(cards));
      return { ...prev, [pcId]: cards };
    });
  }, []);

  const updateBuiltinCard = useCallback((pcId: string, cardId: BuiltinCardKind, updates: { customTitle?: string; extraSensors?: string[]; hiddenFields?: string[]; fieldOrder?: string[]; fieldAliases?: Record<string, string>; sensorIcons?: Record<string, string> }) => {
    setLayouts((prev) => {
      const cards = (prev[pcId] ?? [...BUILTIN_DEFAULTS]).map((c) =>
        c.id === cardId && c.kind !== "custom" ? { ...c, ...updates } : c
      );
      AsyncStorage.setItem(storageKey(pcId), JSON.stringify(cards));
      return { ...prev, [pcId]: cards };
    });
  }, []);

  return (
    <DashboardContext.Provider value={{ getCards, toggleCard, moveCard, addCustomCard, removeCard, updateCustomCard, updateBuiltinCard }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  return useContext(DashboardContext);
}
