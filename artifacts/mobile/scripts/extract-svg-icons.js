#!/usr/bin/env node
/**
 * Extracts individual icon groups from the Shutterstock PC hardware SVG sprite.
 * Writes each as a standalone SVG usable with react-native-svg.
 */

const fs = require('fs');
const path = require('path');

const SVG_SRC = path.join(__dirname, '../assets/shutterstock_2130720773 2 (1).svg');
const OUT_DIR = path.join(__dirname, '../assets/icons/custom');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const raw = fs.readFileSync(SVG_SRC, 'utf8');

// ─── 1. CSS class → inline attribute map ─────────────────────────────────────
const styleBlock = raw.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
const cssMap = {};
for (const rule of styleBlock.matchAll(/\.(s\d+)\s*\{([^}]+)\}/g)) {
  const cls = rule[1];
  const attrs = {};
  for (const decl of rule[2].split(';')) {
    const [prop, val] = decl.split(':').map(s => s.trim());
    if (!prop || !val) continue;
    if (prop === 'fill') {
      attrs.fill = (val === '#ffffff' || val === 'white') ? 'none' : 'currentColor';
    } else if (prop === 'stroke') {
      attrs.stroke = val === 'none' ? 'none' : 'currentColor';
    } else if (['stroke-linecap','stroke-linejoin','stroke-miterlimit',
                 'stroke-dasharray','stroke-width'].includes(prop)) {
      attrs[prop] = val;
    }
  }
  cssMap[cls] = attrs;
}

// ─── 2. Target icons ──────────────────────────────────────────────────────────
const ICONS = {
  // Cases
  'case-tower-v3': 'Case-icon-v3',
  'case-tower-v2': 'Case-icon-v2',
  'case-tower-v1': 'Case-icon-v1',
  // Motherboards
  'motherboard-atx-v3': 'Z690-ATX-Motherboard-icon-v3',
  'motherboard-atx-v1': 'Z690-ATX-Motherboard-icon-v1',
  'motherboard-mini-itx': 'Motherboard-Mini-ITX-icon-v1',
  'motherboard-micro-atx': 'Motherboard-Micro-ATX-icon',
  'motherboard-water-cooled': 'Water-Cooled-Motherboard-icon',
  // CPU
  'cpu-generic-v2': 'CPU-generic-icon-v2',
  'cpu-generic-v1': 'CPU-generic-icon-v1',
  'cpu-ryzen': 'CPU-Ryzen-icon-v1',
  // CPU Water Blocks
  'cpu-block-intel-v2': 'CPU-Block-Intel-icon-v2',
  'cpu-block-intel-v1': 'CPU-Block-Intel-icon-v1',
  'cpu-block-amd-v3': 'CPU-Block-AMD-icon-v3',
  'cpu-block-amd-v1': 'CPU-Block-AMD-icon-v1',
  'cpu-block-threadripper': 'CPU-Block-Threadripper-icon-v1',
  // GPU
  'gpu-reference-v3': 'Graphics-Card-reference-icon-v3',
  'gpu-reference-v1': 'Graphics-Card-reference-icon-v1',
  'gpu-amd-v2': 'Graphics-Card-AMD-icon-v2',
  'gpu-amd-v1': 'Graphics-Card-AMD-icon-v1',
  // GPU Water Blocks
  'gpu-block-reference-v3': 'Graphics-Block-reference-icon-v3',
  'gpu-block-reference-v1': 'Graphics-Block-reference-icon-v1',
  'gpu-block-founders': 'Graphics-Block-founders-edition-icon-v1',
  'gpu-block-active-backplate-v4': 'GPU-Block-Active-Backplate-icon-v4',
  // GPU Backplates
  'gpu-backplate-passive-v1': 'Passive-Backplate-icon-v1',
  'gpu-backplate-active-v2': 'Active-Backplate-icon-v2',
  // Liquid Cooled GPU
  'gpu-liquid-cooled-v4': 'Liquid-Cooled-Graphics-Card-icon-v4',
  'gpu-liquid-cooled-v2': 'Liquid-Cooled-Graphics-Card-icon-v2',
  // RAM
  'ram-v8': 'RAM-icon-v8',
  'ram-v4': 'RAM-icon-v4',
  'ram-v1': 'RAM-icon-v1',
  // Storage
  'ssd': 'SSD-icon-v1',
  'm2-pcie': 'PCIe-M.2-icon-v2',
  'hdd-external': 'External-Hard-Drive-icon-v1',
  // Power Supply
  'psu-v4': 'Power-Supply-icon-v4',
  // CPU Coolers (air)
  'cpu-cooler-tower-v4': 'CPU-Cooler-icon-v4',
  'cpu-cooler-tower-v3': 'CPU-Cooler-icon-v3',
  'cpu-cooler-tower-v1': 'CPU-Cooler-icon-v1',
  // AIO Cooler
  'aio-cooler-v4': 'AIO-Cooler-icon-v4',
  // Case Fans
  'fan-120mm-v4': '120mm-Cooling-Fan-icon-v4',
  'fan-120mm-v3': '120mm-Cooling-Fan-icon-v3',
  'fan-120mm-v1': '120mm-Cooling-Fan-icon-v1',
  'fan-140mm-v4': '140mm-Cooling-Fan-icon-v4',
  'fan-140mm-v2': '140mm-Cooling-Fan-icon-v2',
  // Distro Plate
  'distro-plate-v4': 'Distro-Plate-icon-v4',
  'distro-plate-v3': 'Distro-Plate-icon-v3',
  'distro-plate-v1': 'Distro-Plate-icon-v1',
  // Water Cooling Accessories
  'pump-reservoir-v4': 'Pump-Reservoir-Combo-icon-v4 00000170972435201407178490000007731532976269501834 ',
  'pump-reservoir-v1': 'Pump-Reservoir-Combo-icon-v1 00000115510775780657461880000017919842849040212886 ',
  'radiator-120mm': '120mm-Radiator-icon-v1 00000090285589842144906460000007851514488178288052 ',
  'radiator-240mm': '240mm-Radiator-icon-v1 00000159457885514465862380000010304414615552102044 ',
  'radiator-360mm': '360mm-Radiator-icon-v1 00000116222765120883923970000017637457731194082963 ',
  'aio-cooler-v1': 'AIO-Cooler-icon-v1 00000083772643118144592470000007776732865446294457 ',
  'aio-cooler-v2': 'AIO-Cooler-icon-v2 00000044139116962107009030000008862181965395195017 ',
  'aio-cooler-v3': 'AIO-Cooler-icon-v3 00000137815604462770089430000018116080495045669801 ',
  'coolant-bottle': 'Coolant-icon 00000054963113160504401480000011937758105900433050 ',
  'distilled-water': 'Distilled-Water-icon',
  'filling-bottle': 'Filling-Bottle-icon',
  'temp-flow-monitor': 'Temperature-flow-monitor-icon-v2',
  'flow-indicator-v2': 'Flow-Indicator-icon-v2',
  'flow-indicator-v1': 'Flow-Indicator-icon-v1',
  'fitting-straight': 'Straight-Fittings-icon',
  'fitting-90deg': '90-Degree-Fitting-icon',
  'fitting-45deg': '45-Degree-Fitting-icon',
  'fitting-offset': 'Offset-Fittings-icon',
  'soft-tube-cutter': 'Soft-Tube-Cutters-icon',
  'hard-line-cutter': 'Hard-Line-Cutting-Tool-icon',
  'thermal-paste': 'Thermal-Paste-icon-v2 00000142897505320441555760000009138709755182826904 ',
  // Peripherals
  'keyboard-full': 'Keyboard-icon-v4 00000106129206924142899090000017848376705280693183 ',
  'keyboard-tkl': 'Keyboard-icon-v3',
  'keyboard-compact': 'Keyboard-icon-v2',
  'keyboard-basic': 'Keyboard-icon-v1',
  'mic-condenser-arm': 'Mic-icon-v4',
  'mic-desk-v3': 'Mic-icon-v3',
  'mic-basic': 'Mic-icon-v1',
  'headset-gaming-v2': 'Gaming-Headset-icon-v2',
  'headset-gaming-v1': 'Gaming-Headset-icon-v1',
  'earbuds-v2': 'Earbuds-icon-v2',
  'earbuds-v1': 'Earbuds-icon-v1',
  'mouse-gaming': 'Mouse-icon-v2',
  'mouse-basic': 'Mouse-icon-v1 00000145756168053207908910000015572000431098693546 ',
  'trackball': 'Trackball-icon 00000010306438384767325940000006610972744443263372 ',
  'graphics-tablet': 'Graphics-Tablet-icon 00000031186282232852528960000017782793016670641080 ',
  'webcam-v4': 'Webcam-icon-v4',
  'webcam-v3': 'Webcam-icon-v3',
  'webcam-v2': 'Webcam-icon-v2',
  'webcam-v1': 'Webcam-icon-v1',
  // Networking
  'wifi-extender-v2': 'WiFi-USB-Extender-icon-v2',
  'wifi-extender-v1': 'WiFi-USB-Extender-icon-v1',
};

// ─── 3. Extract group XML ─────────────────────────────────────────────────────
function extractGroup(id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const openRe = new RegExp(`<g[^>]+id="${escapedId}"[^>]*>`);
  const openMatch = raw.match(openRe);
  if (!openMatch) return null;
  const start = raw.indexOf(openMatch[0]);
  if (start === -1) return null;
  let depth = 0, i = start;
  while (i < raw.length) {
    if (raw[i] === '<') {
      if (raw.startsWith('<g', i)) depth++;
      else if (raw.startsWith('</g', i)) {
        depth--;
        if (depth === 0) {
          const end = raw.indexOf('>', i) + 1;
          return raw.slice(start, end);
        }
      }
    }
    i++;
  }
  return null;
}

// ─── 4. Inline CSS classes ────────────────────────────────────────────────────
function inlineClasses(xml) {
  return xml.replace(/class="([^"]+)"/g, (_, cls) => {
    const attrs = cssMap[cls];
    if (!attrs) return '';
    return Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
  });
}

// ─── 5. Proper bounding box from SVG paths ────────────────────────────────────
// Walks through SVG path command tokens, tracking the current absolute position.
// Only records absolute coordinates (uppercase commands).
function computeBBox(xml) {
  const xs = [], ys = [];

  function walk(d) {
    const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
    if (!tokens) return;
    let cmd = 'M';
    let cx = 0, cy = 0; // current point
    let sx = 0, sy = 0; // subpath start
    let i = 0;

    const num = () => parseFloat(tokens[i++]);

    while (i < tokens.length) {
      const t = tokens[i];
      if (/[a-zA-Z]/.test(t)) { cmd = tokens[i++]; continue; }

      switch (cmd) {
        case 'M': cx = num(); cy = num(); sx = cx; sy = cy; xs.push(cx); ys.push(cy); cmd = 'L'; break;
        case 'm': cx += num(); cy += num(); sx = cx; sy = cy; xs.push(cx); ys.push(cy); cmd = 'l'; break;
        case 'L': cx = num(); cy = num(); xs.push(cx); ys.push(cy); break;
        case 'l': cx += num(); cy += num(); xs.push(cx); ys.push(cy); break;
        case 'H': cx = num(); xs.push(cx); break;
        case 'h': cx += num(); xs.push(cx); break;
        case 'V': cy = num(); ys.push(cy); break;
        case 'v': cy += num(); ys.push(cy); break;
        case 'C': { const x1=num(),y1=num(),x2=num(),y2=num(); cx=num(); cy=num(); xs.push(cx); ys.push(cy); break; }
        case 'c': { const dx1=num(),dy1=num(),dx2=num(),dy2=num(); cx+=num(); cy+=num(); xs.push(cx); ys.push(cy); break; }
        case 'S': { const x2=num(),y2=num(); cx=num(); cy=num(); xs.push(cx); ys.push(cy); break; }
        case 's': { const dx2=num(),dy2=num(); cx+=num(); cy+=num(); xs.push(cx); ys.push(cy); break; }
        case 'Q': { const x1=num(),y1=num(); cx=num(); cy=num(); xs.push(cx); ys.push(cy); break; }
        case 'q': { const dx1=num(),dy1=num(); cx+=num(); cy+=num(); xs.push(cx); ys.push(cy); break; }
        case 'T': cx=num(); cy=num(); xs.push(cx); ys.push(cy); break;
        case 't': cx+=num(); cy+=num(); xs.push(cx); ys.push(cy); break;
        case 'A': { const rx=num(),ry=num(),rot=num(),laf=num(),sf=num(); cx=num(); cy=num(); xs.push(cx); ys.push(cy); break; }
        case 'a': { const rx=num(),ry=num(),rot=num(),laf=num(),sf=num(); cx+=num(); cy+=num(); xs.push(cx); ys.push(cy); break; }
        case 'Z': case 'z': cx=sx; cy=sy; i++; break;
        default: i++; break;
      }
    }
  }

  for (const m of xml.matchAll(/\sd="([^"]+)"/g)) walk(m[1]);
  for (const m of xml.matchAll(/\s(?:x|x1|x2)="(-?\d+(?:\.\d+)?)"/g)) xs.push(parseFloat(m[1]));
  for (const m of xml.matchAll(/\s(?:y|y1|y2)="(-?\d+(?:\.\d+)?)"/g)) ys.push(parseFloat(m[1]));
  for (const m of xml.matchAll(/\scx="(-?\d+(?:\.\d+)?)"/g)) xs.push(parseFloat(m[1]));
  for (const m of xml.matchAll(/\scy="(-?\d+(?:\.\d+)?)"/g)) ys.push(parseFloat(m[1]));

  if (!xs.length || !ys.length) return null;
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 15;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

// ─── 6. Write files ───────────────────────────────────────────────────────────
let written = 0, failed = 0;

for (const [filename, groupId] of Object.entries(ICONS)) {
  const groupXml = extractGroup(groupId);
  if (!groupXml) {
    console.warn(`⚠  Not found: ${groupId}`);
    failed++;
    continue;
  }
  const inlined = inlineClasses(groupXml);
  const bbox = computeBBox(inlined);
  if (!bbox || bbox.w < 5 || bbox.h < 5) {
    console.warn(`⚠  No bbox: ${groupId}`);
    failed++;
    continue;
  }
  const vb = `${bbox.x.toFixed(1)} ${bbox.y.toFixed(1)} ${bbox.w.toFixed(1)} ${bbox.h.toFixed(1)}`;
  const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">\n${inlined}\n</svg>`;
  fs.writeFileSync(path.join(OUT_DIR, `${filename}.svg`), svgOut, 'utf8');
  console.log(`✓  ${filename}.svg  [${Math.round(bbox.w)}×${Math.round(bbox.h)}]`);
  written++;
}

console.log(`\nDone: ${written} written, ${failed} failed.`);
