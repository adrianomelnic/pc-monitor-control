export function DashboardCards() {
  const G = "#44D62C";
  const BG = "#000000";
  const CARD = "#0D0D0D";
  const BORDER = "#1A1A1A";
  const TEXT = "#FFFFFF";
  const MUTED = "#666666";
  const TEXT2 = "#999999";

  const StatBar = ({ value, color }: { value: number; color: string }) => (
    <div style={{ height: 3, background: BORDER, flex: 1, borderRadius: 0 }}>
      <div style={{ height: 3, width: `${value}%`, background: color, borderRadius: 0 }} />
    </div>
  );

  const StatRow = ({ label, value, pct, color }: { label: string; value: string; pct?: number; color?: string }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: MUTED, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 12, color: TEXT2, fontWeight: 500 }}>{value}</span>
      </div>
      {pct !== undefined && color && <StatBar value={pct} color={color} />}
    </div>
  );

  const Card = ({
    title, icon, accent, children,
  }: {
    title: string; icon: string; accent: string; children: React.ReactNode;
  }) => (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 0,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{
          width: 28, height: 28,
          background: `${accent}18`,
          border: `1px solid ${accent}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, borderRadius: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: 0.5 }}>{title}</span>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );

  const BigMetric = ({ value, unit, label, color }: { value: string; unit: string; label: string; color: string }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div>
        <span style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: -1 }}>{value}</span>
        <span style={{ fontSize: 13, color, marginLeft: 2 }}>{unit}</span>
      </div>
      <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
    </div>
  );

  const CtrlBtn = ({
    icon, label, color, danger,
  }: {
    icon: string; label: string; color: string; danger?: boolean;
  }) => (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    }}>
      <div style={{
        width: 48, height: 48, background: G, border: "none", borderRadius: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, color: "#000",
      }}>{icon}</div>
      <span style={{ fontSize: 10, color: G, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>
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
        <span style={{ fontSize: 12, color: TEXT }}>▐▌▌▌  WiFi  ⬜</span>
      </div>

      {/* Header */}
      <div style={{
        paddingInline: 16, paddingBlock: 12,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={{
            width: 32, height: 32, background: G, border: "none",
            borderRadius: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#000", fontSize: 18, fontWeight: 700 }}>←</span>
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Gaming Rig</div>
            <div style={{ fontSize: 10, color: G, letterSpacing: 0.5 }}>● ONLINE</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{
            width: 32, height: 32, background: G, border: "none",
            borderRadius: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#000", fontSize: 14, fontWeight: 700 }}>⌨</span>
          </button>
          <button style={{
            width: 32, height: 32, background: G, border: "none",
            borderRadius: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#000", fontSize: 14, fontWeight: 700 }}>✎</span>
          </button>
          {/* Power button — active (panel expanded) */}
          <button style={{
            width: 32, height: 32, background: G, border: "none",
            borderRadius: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#000", fontSize: 14, fontWeight: 700 }}>⏻</span>
          </button>
        </div>
      </div>

      {/* Green accent line */}
      <div style={{ height: 2, background: G }} />

      {/* ── Expandable controls panel (shown expanded) ── */}
      <div style={{
        background: "#0A0A0A",
        borderBottom: `1px solid ${BORDER}`,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <div style={{ height: 1, flex: 1, background: BORDER }} />
          <span style={{ fontSize: 9, color: MUTED, letterSpacing: 1, textTransform: "uppercase" }}>PC Controls</span>
          <div style={{ height: 1, flex: 1, background: BORDER }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          <CtrlBtn icon="🌙" label="Sleep" color={G} />
          <CtrlBtn icon="🔒" label="Lock" color="#A78BFA" />
          <CtrlBtn icon="↺" label="Restart" color="#FB923C" danger />
          <CtrlBtn icon="⏻" label="Shutdown" color="#FF4444" danger />
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, padding: "12px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>

        {/* CPU Card */}
        <Card title="CPU" icon="⬡" accent="#00D4FF">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <BigMetric value="34" unit="%" label="Load" color="#00D4FF" />
            <BigMetric value="1.24" unit="V" label="VCore" color="#00D4FF" />
            <BigMetric value="65" unit="W" label="Power" color="#00D4FF" />
          </div>
          <div style={{ height: 1, background: BORDER }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textTransform: "uppercase" }}>Per-Core Usage</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 3 }}>
              {[34, 12, 67, 23, 45, 11, 78, 29].map((v, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ width: "100%", height: 32, background: BORDER, position: "relative" }}>
                    <div style={{
                      position: "absolute", bottom: 0, width: "100%", height: `${v}%`,
                      background: `#00D4FF${Math.round(40 + v * 1.5).toString(16)}`,
                    }} />
                  </div>
                  <span style={{ fontSize: 8, color: MUTED }}>{i}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div style={{ height: 2 }} />

        {/* GPU Card */}
        <Card title="GPU" icon="⬡" accent="#34D399">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <BigMetric value="72" unit="%" label="Load" color="#34D399" />
            <BigMetric value="8.1" unit="GB" label="VRAM" color="#34D399" />
            <BigMetric value="142" unit="W" label="Power" color="#34D399" />
          </div>
          <div style={{ height: 1, background: BORDER }} />
          <StatRow label="GPU Clock" value="1980 MHz" pct={72} color="#34D399" />
          <StatRow label="Mem Clock" value="9800 MHz" pct={58} color="#34D399" />
          <StatRow label="Fan Speed" value="1820 RPM" pct={45} color="#34D399" />
        </Card>

        <div style={{ height: 2 }} />

        {/* RAM Card */}
        <Card title="RAM" icon="⬡" accent="#A78BFA">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <BigMetric value="62" unit="%" label="Used" color="#A78BFA" />
            <BigMetric value="19.8" unit="GB" label="Used/32GB" color="#A78BFA" />
          </div>
          <div style={{ height: 1, background: BORDER }} />
          <StatRow label="Physical" value="19.8 / 32 GB" pct={62} color="#A78BFA" />
          <StatRow label="Available" value="12.2 GB" />
          <StatRow label="Swap" value="0 / 0 GB" pct={0} color="#A78BFA" />
        </Card>

      </div>
    </div>
  );
}
