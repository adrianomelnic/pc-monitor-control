import { PCMetrics, SensorReading } from "@/context/PcsContext";

export const DEMO_PC_HOST = "__demo__";
export const DEMO_PC_ID   = "__demo_pc__";

// ─── Smooth fluctuation helpers ───────────────────────────────────────────────
function wave(t: number, period: number, min: number, max: number, phase = 0): number {
  const mid = (max + min) / 2;
  const amp = (max - min) / 2;
  return mid + amp * Math.sin((t / period) * 2 * Math.PI + phase);
}

function jitter(t: number, scale: number, seed: number): number {
  return scale * Math.sin(t * 7.3 + seed) * Math.cos(t * 3.7 + seed * 1.3);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Demo PC static metadata ─────────────────────────────────────────────────
export const DEMO_PC_META = {
  name: "Demo Gaming PC",
  host: DEMO_PC_HOST,
  port: 0,
  os: "Windows 11 Pro",
};

// ─── Main data generator ─────────────────────────────────────────────────────
export function generateDemoMetrics(): PCMetrics {
  const t = Date.now() / 1000; // seconds

  // ── CPU ───────────────────────────────────────────────────────────────────
  const cpuTotal = clamp(wave(t, 14, 22, 65, 0) + jitter(t, 6, 1), 5, 95);
  const cpuTemp  = clamp(wave(t, 20, 48, 78, 1.2) + jitter(t, 3, 2), 35, 100);
  const cpuFreq  = clamp(wave(t, 18, 3200, 5400, 0.8) + jitter(t, 150, 3), 800, 5800);
  const cpuVolt  = clamp(wave(t, 25, 1.18, 1.38, 2.1) + jitter(t, 0.02, 4), 0.9, 1.5);

  const coresLogical = 32;
  const perCore: number[] = Array.from({ length: coresLogical }, (_, i) => {
    const base = cpuTotal + wave(t, 8, -15, 15, i * 0.4) + jitter(t, 5, i + 10);
    return clamp(Math.round(base * 10) / 10, 0, 100);
  });

  const coreTemps = Array.from({ length: 16 }, (_, i) =>
    clamp(cpuTemp + wave(t, 10, -4, 4, i * 0.5) + jitter(t, 2, i + 30), 30, 105)
  );
  const coreClocks = perCore.slice(0, 16).map((u, i) =>
    clamp(800 + u / 100 * (cpuFreq - 800) + jitter(t, 80, i + 50), 800, 5800)
  );

  // ── GPU ───────────────────────────────────────────────────────────────────
  const gpuUsage  = clamp(wave(t, 11, 30, 88, 2.5) + jitter(t, 8, 20), 0, 100);
  const gpuTemp   = clamp(wave(t, 16, 55, 82, 3.0) + jitter(t, 2, 21), 30, 95);
  const gpuClock  = clamp(wave(t, 12, 1800, 2520, 1.7) + jitter(t, 60, 22), 200, 2800);
  const gpuMemClk = clamp(wave(t, 30, 9800, 10250, 0.3) + jitter(t, 30, 23), 5000, 12000);
  const gpuVramUsed = clamp(Math.round(wave(t, 25, 4200, 9800, 1.1) + jitter(t, 200, 24)), 2000, 24576);
  const gpuPower  = clamp(wave(t, 13, 180, 420, 2.3) + jitter(t, 15, 25), 50, 480);
  const gpuVolt   = clamp(wave(t, 20, 0.82, 1.06, 1.8) + jitter(t, 0.02, 26), 0.6, 1.2);

  // ── RAM ───────────────────────────────────────────────────────────────────
  const ramTotal    = 65536;
  const ramUsed     = clamp(Math.round(wave(t, 40, 18000, 28000, 0.5) + jitter(t, 500, 40)), 4096, 62000);
  const ramPercent  = clamp((ramUsed / ramTotal) * 100, 5, 97);
  const swapUsed    = clamp(Math.round(wave(t, 60, 0, 3000, 1.4) + jitter(t, 100, 41)), 0, 8192);
  const dimmTemp    = clamp(wave(t, 35, 38, 54, 2.9) + jitter(t, 1.5, 42), 30, 70);

  // ── Fans ──────────────────────────────────────────────────────────────────
  const fanCpuPump = Math.round(clamp(wave(t, 18, 2100, 2800, 0) + jitter(t, 80, 60), 500, 3500));
  const fanCpuFan1 = Math.round(clamp(wave(t, 20, 900, 1600, 0.7) + jitter(t, 50, 61), 0, 3000));
  const fanCpuFan2 = Math.round(clamp(wave(t, 20, 880, 1580, 0.9) + jitter(t, 50, 62), 0, 3000));
  const fanChassis1 = Math.round(clamp(wave(t, 22, 700, 1200, 1.1) + jitter(t, 40, 63), 0, 2500));
  const fanChassis2 = Math.round(clamp(wave(t, 22, 680, 1180, 1.3) + jitter(t, 40, 64), 0, 2500));
  const fanChassis3 = Math.round(clamp(wave(t, 22, 700, 1220, 1.5) + jitter(t, 40, 65), 0, 2500));
  const fanGpu      = Math.round(clamp(wave(t, 15, 1400, 2800, 2.1) + jitter(t, 100, 66), 0, 4500));

  // ── Disks ─────────────────────────────────────────────────────────────────
  const diskReadNVMe  = clamp(wave(t, 8, 0, 2800, 0.3) + jitter(t, 200, 70), 0, 7000);
  const diskWriteNVMe = clamp(wave(t, 9, 0, 1200, 1.2) + jitter(t, 150, 71), 0, 5000);
  const diskReadHDD   = clamp(wave(t, 12, 0, 180, 2.1) + jitter(t, 20, 72), 0, 250);
  const diskWriteHDD  = clamp(wave(t, 11, 0, 80, 0.8) + jitter(t, 10, 73), 0, 200);
  const nvmeTemp      = clamp(wave(t, 30, 38, 55, 1.5) + jitter(t, 1.5, 74), 30, 80);

  // ── Network ───────────────────────────────────────────────────────────────
  const netUp   = clamp(wave(t, 7, 0, 850, 3.1) + jitter(t, 80, 80), 0, 1250000);
  const netDown = clamp(wave(t, 9, 0, 45000, 0.4) + jitter(t, 5000, 81), 0, 125000000);
  const netTotalSent = 1024 + t / 10;
  const netTotalRecv = 8192 + t / 2;

  // ── Uptime ────────────────────────────────────────────────────────────────
  const uptime = 86400 * 2 + 3600 * 4 + 1800 + Math.floor(t % 86400);

  // ── Build sensors array ────────────────────────────────────────────────────
  const sensors: SensorReading[] = [
    // CPU temperatures
    { label: "CPU Package",         value: round1(cpuTemp),         unit: "°C",  type: "temperature", component: "Intel Core i9-14900K" },
    { label: "CPU Package Power",   value: round1(cpuTemp * 1.4 + 10), unit: "°C", type: "temperature", component: "Intel Core i9-14900K" },
    ...coreTemps.map((v, i) => ({
      label: `CPU Core #${i + 1}`,
      value: round1(v),
      unit: "°C",
      type: "temperature" as const,
      component: "Intel Core i9-14900K",
    })),
    // CPU clocks
    ...coreClocks.map((v, i) => ({
      label: `P-Core #${i + 1} Effective Clock`,
      value: round0(v),
      unit: "MHz",
      type: "clock" as const,
      component: "Intel Core i9-14900K",
    })),
    // CPU voltages
    { label: "CPU Core Voltage",    value: round3(cpuVolt),         unit: "V",   type: "voltage",     component: "Intel Core i9-14900K" },
    { label: "CPU VID",             value: round3(cpuVolt + 0.02),  unit: "V",   type: "voltage",     component: "Intel Core i9-14900K" },
    // CPU power
    { label: "CPU Package Power",   value: round1(clamp(cpuTotal * 2.1 + 18, 10, 253)), unit: "W", type: "power", component: "Intel Core i9-14900K" },
    { label: "CPU Core Power",      value: round1(clamp(cpuTotal * 1.8 + 10, 8, 215)),  unit: "W", type: "power", component: "Intel Core i9-14900K" },
    // CPU usage
    { label: "Total CPU Usage",     value: round1(cpuTotal),        unit: "%",   type: "usage",       component: "Intel Core i9-14900K" },
    ...perCore.map((v, i) => ({
      label: `CPU Core #${i + 1} T0 Usage`,
      value: round1(v),
      unit: "%",
      type: "usage" as const,
      component: "Intel Core i9-14900K",
    })),

    // GPU temperatures
    { label: "GPU Temperature",     value: round1(gpuTemp),         unit: "°C",  type: "temperature", component: "NVIDIA GeForce RTX 4090" },
    { label: "GPU Hot Spot",        value: round1(gpuTemp + clamp(wave(t, 8, 5, 18, 1.4) + jitter(t, 2, 90), 3, 25)), unit: "°C", type: "temperature", component: "NVIDIA GeForce RTX 4090" },
    { label: "GPU Memory Temperature", value: round1(clamp(gpuTemp - 5 + wave(t, 12, -3, 3, 0.7), 30, 110)), unit: "°C", type: "temperature", component: "NVIDIA GeForce RTX 4090" },
    // GPU clocks
    { label: "GPU Core Clock",      value: round0(gpuClock),        unit: "MHz", type: "clock",       component: "NVIDIA GeForce RTX 4090" },
    { label: "GPU Memory Clock",    value: round0(gpuMemClk),       unit: "MHz", type: "clock",       component: "NVIDIA GeForce RTX 4090" },
    { label: "GPU Video Clock",     value: round0(gpuClock * 0.62), unit: "MHz", type: "clock",       component: "NVIDIA GeForce RTX 4090" },
    // GPU voltage
    { label: "GPU Core Voltage",    value: round3(gpuVolt),         unit: "V",   type: "voltage",     component: "NVIDIA GeForce RTX 4090" },
    // GPU power
    { label: "GPU Power",           value: round1(gpuPower),        unit: "W",   type: "power",       component: "NVIDIA GeForce RTX 4090" },
    { label: "GPU Board Power",     value: round1(gpuPower * 0.92), unit: "W",   type: "power",       component: "NVIDIA GeForce RTX 4090" },
    // GPU usage
    { label: "GPU Core Load",       value: round1(gpuUsage),        unit: "%",   type: "usage",       component: "NVIDIA GeForce RTX 4090" },
    { label: "GPU Memory Controller Load", value: round1(clamp(gpuUsage * 0.7 + jitter(t, 5, 92), 0, 100)), unit: "%", type: "usage", component: "NVIDIA GeForce RTX 4090" },
    { label: "GPU Video Engine Load", value: round1(clamp(wave(t, 6, 0, 30, 1.5) + jitter(t, 3, 93), 0, 100)), unit: "%", type: "usage", component: "NVIDIA GeForce RTX 4090" },

    // RAM
    { label: "RAM Usage",           value: round1(ramPercent),      unit: "%",   type: "usage",       component: "Kingston FURY Beast DDR5" },
    { label: "DIMM1 Temperature",   value: round1(dimmTemp),        unit: "°C",  type: "temperature", component: "Kingston FURY Beast DDR5" },
    { label: "DIMM2 Temperature",   value: round1(dimmTemp + jitter(t, 1.5, 44)), unit: "°C", type: "temperature", component: "Kingston FURY Beast DDR5" },
    { label: "DIMM3 Temperature",   value: round1(dimmTemp - jitter(t, 1.0, 45)), unit: "°C", type: "temperature", component: "Kingston FURY Beast DDR5" },
    { label: "DIMM4 Temperature",   value: round1(dimmTemp + jitter(t, 1.2, 46)), unit: "°C", type: "temperature", component: "Kingston FURY Beast DDR5" },

    // Motherboard
    { label: "Motherboard",         value: round1(clamp(wave(t, 60, 32, 42, 0.6) + jitter(t, 1, 100), 25, 55)), unit: "°C", type: "temperature", component: "ASUS ROG Maximus Z790 Hero" },
    { label: "VRM Temperature",     value: round1(clamp(cpuTemp * 0.7 + 10 + jitter(t, 2, 101), 30, 90)), unit: "°C", type: "temperature", component: "ASUS ROG Maximus Z790 Hero" },
    { label: "Chipset",             value: round1(clamp(wave(t, 45, 38, 56, 1.8) + jitter(t, 1.5, 102), 30, 70)), unit: "°C", type: "temperature", component: "ASUS ROG Maximus Z790 Hero" },

    // Storage
    { label: "SSD Temperature",     value: round1(nvmeTemp),        unit: "°C",  type: "temperature", component: "Samsung 990 Pro 2TB NVMe" },
    { label: "SSD Read Rate",       value: round1(diskReadNVMe),    unit: "KB/s", type: "other",      component: "Samsung 990 Pro 2TB NVMe" },
    { label: "SSD Write Rate",      value: round1(diskWriteNVMe),   unit: "KB/s", type: "other",      component: "Samsung 990 Pro 2TB NVMe" },

    // Fans
    { label: "AIO Pump",            value: fanCpuPump,              unit: "RPM", type: "fan",         component: "Corsair iCUE H150i" },
    { label: "AIO Fan 1",           value: fanCpuFan1,              unit: "RPM", type: "fan",         component: "Corsair iCUE H150i" },
    { label: "AIO Fan 2",           value: fanCpuFan2,              unit: "RPM", type: "fan",         component: "Corsair iCUE H150i" },
    { label: "Chassis Fan 1",       value: fanChassis1,             unit: "RPM", type: "fan",         component: "ASUS ROG Maximus Z790 Hero" },
    { label: "Chassis Fan 2",       value: fanChassis2,             unit: "RPM", type: "fan",         component: "ASUS ROG Maximus Z790 Hero" },
    { label: "Chassis Fan 3",       value: fanChassis3,             unit: "RPM", type: "fan",         component: "ASUS ROG Maximus Z790 Hero" },
    { label: "GPU Fan",             value: fanGpu,                  unit: "RPM", type: "fan",         component: "NVIDIA GeForce RTX 4090" },

    // Network
    { label: "Upload Speed",        value: round1(netUp / 1024),    unit: "KB/s", type: "other",     component: "Intel Ethernet Controller I226-V" },
    { label: "Download Speed",      value: round1(netDown / 1024),  unit: "KB/s", type: "other",     component: "Intel Ethernet Controller I226-V" },
  ];

  // ── Assemble PCMetrics ─────────────────────────────────────────────────────
  return {
    cpuUsage:    round1(cpuTotal),
    ramUsage:    ramUsed,
    ramTotal,
    diskUsage:   716800,
    diskTotal:   2097152,
    networkUp:   round1(netUp / 1024),
    networkDown: round1(netDown / 1024),
    uptime,
    temperature: round1(cpuTemp),
    processes:   Math.round(wave(t, 60, 210, 280, 0) + jitter(t, 5, 200)),

    cpu: {
      name:          "Intel Core i9-14900K",
      coresPhysical: 24,
      coresLogical,
      freqCurrent:   round0(cpuFreq),
      freqMax:       5800,
      usageTotal:    round1(cpuTotal),
      usagePerCore:  perCore,
      temperature:   round1(cpuTemp),
      voltage:       round3(cpuVolt),
      power:         round1(clamp(cpuTotal * 2.1 + 18, 10, 253)),
    },

    gpu: [{
      name:        "NVIDIA GeForce RTX 4090",
      usage:       round1(gpuUsage),
      vramUsed:    gpuVramUsed,
      vramTotal:   24576,
      temperature: round1(gpuTemp),
      clockGpu:    round0(gpuClock),
      clockMem:    round0(gpuMemClk),
      voltage:     round3(gpuVolt),
      power:       round1(gpuPower),
    }],

    ram: {
      used:      ramUsed,
      total:     ramTotal,
      available: ramTotal - ramUsed,
      percent:   round1(ramPercent),
      swapUsed,
      swapTotal: 16384,
      temperature: round1(dimmTemp),
    },

    fans: [
      { label: "AIO Pump",     rpm: fanCpuPump },
      { label: "AIO Fan 1",    rpm: fanCpuFan1 },
      { label: "AIO Fan 2",    rpm: fanCpuFan2 },
      { label: "Chassis Fan 1", rpm: fanChassis1 },
      { label: "Chassis Fan 2", rpm: fanChassis2 },
      { label: "Chassis Fan 3", rpm: fanChassis3 },
      { label: "GPU Fan",      rpm: fanGpu },
    ],

    disks: [
      {
        device:      "\\\\.\\PhysicalDrive0",
        mountpoint:  "C:\\",
        fstype:      "NTFS",
        total:       2097152,
        used:        716800,
        free:        1380352,
        percent:     34.2,
        readSpeed:   round1(diskReadNVMe),
        writeSpeed:  round1(diskWriteNVMe),
        temperature: round1(nvmeTemp),
      },
      {
        device:      "\\\\.\\PhysicalDrive1",
        mountpoint:  "D:\\",
        fstype:      "NTFS",
        total:       8388608,
        used:        4301824,
        free:        4086784,
        percent:     51.3,
        readSpeed:   round1(diskReadHDD),
        writeSpeed:  round1(diskWriteHDD),
        temperature: null,
      },
    ],

    network: [
      {
        name:       "Ethernet",
        speedUp:    round1(netUp / 1024),
        speedDown:  round1(netDown / 1024),
        totalSent:  round1(netTotalSent),
        totalRecv:  round1(netTotalRecv),
        isUp:       true,
        speedMax:   1000,
      },
    ],

    sensors,
  };
}

function round0(v: number): number { return Math.round(v); }
function round1(v: number): number { return Math.round(v * 10) / 10; }
function round3(v: number): number { return Math.round(v * 1000) / 1000; }
