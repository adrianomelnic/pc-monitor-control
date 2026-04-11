export function HomeScreen() {
  const G = "#44D62C";
  const BG = "#000000";
  const CARD = "#0D0D0D";
  const BORDER = "#1A1A1A";
  const TEXT = "#FFFFFF";
  const MUTED = "#666666";

  const MetricRing = ({
    pct,
    label,
    color,
    sub,
  }: {
    pct: number;
    label: string;
    color: string;
    sub?: string;
  }) => {
    const r = 26;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ position: "relative", width: 64, height: 64 }}>
          <svg width={64} height={64} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={32} cy={32} r={r} fill="none" stroke="#1A1A1A" strokeWidth={4} />
            <circle
              cx={32} cy={32} r={r} fill="none"
              stroke={color} strokeWidth={4}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeLinecap="square"
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{pct}%</span>
          </div>
        </div>
        <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
        {sub && <span style={{ fontSize: 9, color: MUTED, marginTop: -2 }}>{sub}</span>}
      </div>
    );
  };

  const PCCard = ({
    name, ip, online, cpu, ram, disk,
  }: {
    name: string; ip: string; online: boolean;
    cpu: number; ram: number; disk: number;
  }) => (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 0,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 6, height: 6, background: online ? G : "#FF4444",
            flexShrink: 0, marginTop: 2,
          }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, letterSpacing: -0.3 }}>{name}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{ip}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: online ? G : "#FF4444", letterSpacing: 0.5 }}>
            {online ? "ONLINE" : "OFFLINE"}
          </div>
          <div style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>Windows 11</div>
        </div>
      </div>

      {online && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <MetricRing pct={cpu} label="CPU" color="#00D4FF" />
          <MetricRing pct={ram} label="RAM" color="#A78BFA" sub="12/32GB" />
          <MetricRing pct={disk} label="Disk" color="#34D399" sub="480/960GB" />
          <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: G }}>↑</span>
              <span style={{ fontSize: 10, color: MUTED }}>2.1M/s</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: "#A78BFA" }}>↓</span>
              <span style={{ fontSize: 10, color: MUTED }}>8.4M/s</span>
            </div>
            <span style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>Up 2d 4h</span>
          </div>
        </div>
      )}

      {!online && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <span style={{ fontSize: 12, color: MUTED }}>⊗  Last seen 3:42 PM</span>
        </div>
      )}

      <div style={{ height: 1, background: BORDER, margin: "0 -2px" }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button style={{
          background: "none", border: "none", display: "flex", alignItems: "center",
          gap: 5, cursor: "pointer", padding: 0,
        }}>
          <span style={{ fontSize: 11, color: G, fontWeight: 600 }}>✎  Edit</span>
        </button>
        <button style={{
          background: "none", border: "none", display: "flex", alignItems: "center",
          gap: 5, cursor: "pointer", padding: 0,
        }}>
          <span style={{ fontSize: 11, color: "#FF4444", fontWeight: 600 }}>⊗  Remove PC</span>
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      width: 390, minHeight: 844, background: BG,
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      {/* Status bar */}
      <div style={{ height: 44, paddingInline: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>9:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: TEXT }}>▐▌▌▌</span>
          <span style={{ fontSize: 12, color: TEXT }}>WiFi</span>
          <span style={{ fontSize: 12, color: TEXT }}>⬜</span>
        </div>
      </div>

      {/* Header */}
      <div style={{
        paddingInline: 20, paddingBlock: 14,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: TEXT, letterSpacing: -0.5 }}>MY PCs</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{
            width: 32, height: 32, background: G, border: "none",
            borderRadius: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 20, color: "#000", fontWeight: 700, lineHeight: 1 }}>+</span>
          </button>
        </div>
      </div>

      {/* Green accent line */}
      <div style={{ height: 2, background: G, opacity: 0.8 }} />

      {/* PC list */}
      <div style={{ flex: 1, padding: "16px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
        <PCCard name="Gaming Rig" ip="192.168.50.215:8765" online={true} cpu={34} ram={62} disk={51} />
        <div style={{ height: 2 }} />
        <PCCard name="Work Desktop" ip="192.168.50.88:8765" online={false} cpu={0} ram={0} disk={0} />
        <div style={{ height: 2 }} />
        <div style={{
          background: CARD,
          border: `1px solid ${G}`,
          borderRadius: 0,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center", justifyContent: "center",
          gap: 8, opacity: 0.6,
        }}>
          <span style={{ fontSize: 22, color: G, fontWeight: 300 }}>+</span>
          <span style={{ fontSize: 13, color: G, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Add PC</span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        height: 83, borderTop: `1px solid ${BORDER}`,
        background: "#050505",
        display: "flex", alignItems: "flex-start", paddingTop: 10,
      }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth={2}>
              <rect x={2} y={3} width={20} height={14} rx={0} />
              <line x1={8} y1={21} x2={16} y2={21} />
              <line x1={12} y1={17} x2={12} y2={21} />
            </svg>
          </div>
          <span style={{ fontSize: 10, color: G, fontWeight: 600, letterSpacing: 0.3 }}>My PCs</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={2}>
              <circle cx={12} cy={12} r={3} />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <span style={{ fontSize: 10, color: MUTED, letterSpacing: 0.3 }}>Agent Setup</span>
        </div>
      </div>
    </div>
  );
}
