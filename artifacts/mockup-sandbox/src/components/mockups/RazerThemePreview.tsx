export default function RazerThemePreview() {
  const OLD = {
    background: "#0A0F1E",
    card: "#131C2E",
    cardBorder: "#1E2D42",
    tint: "#00D4FF",
    textSecondary: "#8899AA",
    textMuted: "#556677",
    success: "#00CC88",
    backgroundSecondary: "#111827",
    backgroundTertiary: "#1A2335",
  };

  const NEW = {
    background: "#000000",
    card: "#111111",
    cardBorder: "#222222",
    tint: "#44D62C",
    textSecondary: "#777777",
    textMuted: "#555555",
    success: "#44D62C",
    backgroundSecondary: "#0A0A0A",
    backgroundTertiary: "#181818",
  };

  const ACCENT = {
    CPU: "#00D4FF",
    GPU: "#34D399",
    RAM: "#A78BFA",
    Fans: "#FB923C",
  };

  function PhoneMockup({ theme, label }: { theme: typeof OLD; label: string }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: theme === NEW ? theme.tint : "#8899AA",
          letterSpacing: 2,
          textTransform: "uppercase" as const,
          fontFamily: "system-ui, sans-serif",
        }}>
          {label}
        </div>

        <div style={{
          width: 300,
          height: 620,
          backgroundColor: theme.background,
          borderRadius: 40,
          border: `2px solid ${theme.cardBorder}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, -apple-system, sans-serif",
          boxShadow: theme === NEW ? `0 0 40px ${theme.tint}22` : "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          {/* Status bar */}
          <div style={{
            backgroundColor: theme.backgroundSecondary,
            padding: "10px 20px 6px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>9:41</span>
            <span style={{ color: "#fff", fontSize: 10 }}>●●●</span>
          </div>

          {/* Home screen: PC list */}
          <div style={{
            flex: 1,
            overflowY: "hidden" as const,
            display: "flex",
            flexDirection: "column",
          }}>
            {/* Header */}
            <div style={{
              padding: "16px 16px 8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>My PCs</div>
                <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>2 machines</div>
              </div>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: theme.tint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                color: "#fff",
                fontWeight: 300,
                lineHeight: "32px",
              }}>+</div>
            </div>

            {/* PC Card 1 — Online */}
            <div style={{ padding: "6px 16px" }}>
              <div style={{
                backgroundColor: theme.card,
                borderRadius: 16,
                border: `1px solid ${theme.cardBorder}`,
                padding: 14,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success }} />
                    <div>
                      <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Gaming Rig</div>
                      <div style={{ color: theme.textSecondary, fontSize: 11, marginTop: 1 }}>192.168.1.50:8765</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ color: theme.success, fontSize: 11, fontWeight: 600 }}>Online</div>
                    <div style={{ color: theme.textMuted, fontSize: 10, marginTop: 2 }}>Windows 11</div>
                  </div>
                </div>

                {/* Metrics row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  {[
                    { label: "CPU", pct: 42, color: ACCENT.CPU },
                    { label: "RAM", pct: 67, color: ACCENT.RAM },
                    { label: "Disk", pct: 31, color: ACCENT.GPU },
                  ].map(({ label, pct, color }) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <RingMetric pct={pct} color={color} size={60} theme={theme} />
                      <div style={{ color: theme.textSecondary, fontSize: 9, fontWeight: 600 }}>{label}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ color: theme.tint, fontSize: 9 }}>↑</span>
                      <span style={{ color: theme.textSecondary, fontSize: 9 }}>12.3M/s</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ color: ACCENT.RAM, fontSize: 9 }}>↓</span>
                      <span style={{ color: theme.textSecondary, fontSize: 9 }}>4.1M/s</span>
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: 8, marginTop: 2 }}>Up 2d 5h</div>
                  </div>
                </div>

                <div style={{ height: 1, backgroundColor: theme.cardBorder, margin: "0 -2px 8px" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: theme.tint, fontSize: 11, fontWeight: 600 }}>✏ Edit</span>
                  <span style={{ color: "#FF4444", fontSize: 11, fontWeight: 600 }}>🗑 Remove PC</span>
                </div>
              </div>
            </div>

            {/* PC Card 2 — Offline */}
            <div style={{ padding: "6px 16px" }}>
              <div style={{
                backgroundColor: theme.card,
                borderRadius: 16,
                border: `1px solid ${theme.cardBorder}`,
                padding: 14,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF4444" }} />
                    <div>
                      <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Work Laptop</div>
                      <div style={{ color: theme.textSecondary, fontSize: 11, marginTop: 1 }}>192.168.1.20:8765</div>
                    </div>
                  </div>
                  <div style={{ color: "#FF4444", fontSize: 11, fontWeight: 600 }}>Offline</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <span style={{ color: theme.textMuted, fontSize: 11 }}>⊘</span>
                  <span style={{ color: theme.textMuted, fontSize: 11 }}>Last seen 3:42 PM</span>
                </div>
                <div style={{ height: 1, backgroundColor: theme.cardBorder, margin: "0 -2px 8px" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: theme.tint, fontSize: 11, fontWeight: 600 }}>✏ Edit</span>
                  <span style={{ color: "#FF4444", fontSize: 11, fontWeight: 600 }}>🗑 Remove PC</span>
                </div>
              </div>
            </div>

            {/* Dashboard section label */}
            <div style={{ padding: "12px 16px 6px" }}>
              <span style={{ color: theme.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" as const }}>
                Dashboard Preview
              </span>
            </div>

            {/* CPU Card */}
            <div style={{ padding: "0 16px 6px" }}>
              <div style={{
                backgroundColor: theme.card,
                borderRadius: 16,
                border: `1px solid ${theme.cardBorder}`,
                borderTopWidth: 2,
                borderTopColor: ACCENT.CPU,
                padding: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    backgroundColor: ACCENT.CPU + "22",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}>⚡</div>
                  <div>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>CPU</div>
                    <div style={{ color: theme.textSecondary, fontSize: 10 }}>Intel Core i9-13900K</div>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <div style={{
                      backgroundColor: "#00CC8822",
                      border: "1px solid #00CC8855",
                      borderRadius: 5,
                      padding: "2px 6px",
                      color: "#00CC88",
                      fontSize: 11,
                      fontWeight: 700,
                    }}>42°C</div>
                  </div>
                </div>
                <div style={{ height: 1, backgroundColor: theme.cardBorder, marginBottom: 8 }} />
                {[["Usage", "42%", ACCENT.CPU], ["Cores", "24C / 32T", "#fff"], ["Clock", "5.4 GHz", "#fff"]].map(([label, val, color]) => (
                  <div key={label as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: theme.textSecondary, fontSize: 11 }}>{label as string}</span>
                    <span style={{ color: color as string, fontSize: 11, fontWeight: 700 }}>{val as string}</span>
                  </div>
                ))}
                <div style={{
                  backgroundColor: theme.backgroundTertiary,
                  borderRadius: 3,
                  height: 4,
                  marginTop: 6,
                  overflow: "hidden",
                }}>
                  <div style={{ width: "42%", height: 4, backgroundColor: ACCENT.CPU, borderRadius: 3 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{
            backgroundColor: theme.backgroundSecondary,
            borderTop: `1px solid ${theme.cardBorder}`,
            padding: "8px 0 12px",
            display: "flex",
            justifyContent: "space-around",
          }}>
            {[
              { icon: "⊞", label: "My PCs", active: true },
              { icon: "⌘", label: "Agent Setup", active: false },
            ].map(({ icon, label, active }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 18, color: active ? theme.tint : theme.textMuted }}>{icon}</span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, color: active ? theme.tint : theme.textMuted }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function RingMetric({ pct, color, size, theme }: { pct: number; color: string; size: number; theme: typeof OLD }) {
    const r = (size / 2) - 6;
    const circ = 2 * Math.PI * r;
    const stroke = circ * (1 - pct / 100);
    return (
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.backgroundTertiary} strokeWidth={5} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeDasharray={circ}
            strokeDashoffset={stroke}
            strokeLinecap="round"
          />
        </svg>
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}>
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>{pct}%</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#050505",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      gap: 32,
    }}>
      <div style={{
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
        marginBottom: 8,
      }}>
        <div style={{ color: "#44D62C", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, marginBottom: 8 }}>
          Theme Preview
        </div>
        <div style={{ color: "#ffffff", fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
          Current vs Razer/Moonlight
        </div>
        <div style={{ color: "#555555", fontSize: 13, marginTop: 6 }}>
          Layout, components, icons, and card accent colors are unchanged — only base colors shift
        </div>
      </div>

      <div style={{ display: "flex", gap: 40, alignItems: "flex-start", flexWrap: "wrap" as const, justifyContent: "center" }}>
        <PhoneMockup theme={OLD} label="Current (Navy Blue)" />
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 620,
          marginTop: 32,
          gap: 16,
        }}>
          <div style={{ color: "#44D62C", fontSize: 28 }}>→</div>
          <div style={{
            backgroundColor: "#111",
            border: "1px solid #222",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 140,
          }}>
            {[
              ["Background", "#0A0F1E", "#000000"],
              ["Card", "#131C2E", "#111111"],
              ["Border", "#1E2D42", "#222222"],
              ["Accent", "#00D4FF", "#44D62C"],
              ["Online", "#00CC88", "#44D62C"],
              ["Muted", "#8899AA", "#777777"],
            ].map(([label, from, to]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ color: "#555", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, fontFamily: "system-ui" }}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: from, border: "1px solid #333" }} />
                  <span style={{ color: "#555", fontSize: 9, fontFamily: "monospace" }}>{from}</span>
                  <span style={{ color: "#44D62C", fontSize: 9 }}>→</span>
                  <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: to, border: "1px solid #333" }} />
                  <span style={{ color: "#44D62C", fontSize: 9, fontFamily: "monospace" }}>{to}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <PhoneMockup theme={NEW} label="Razer/Moonlight (New)" />
      </div>

      <div style={{
        color: "#333",
        fontSize: 11,
        fontFamily: "system-ui",
        textAlign: "center",
        letterSpacing: 0.5,
        maxWidth: 500,
      }}>
        Card accent colors (CPU cyan, GPU green, RAM purple, Fans orange, etc.) stay unchanged • Font stays Inter • All layout unchanged
      </div>
    </div>
  );
}
