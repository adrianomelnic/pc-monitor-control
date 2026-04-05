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
      attrs.fill = 'none'; // outline-only rendering — no filled areas
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
  // ── Cases ──────────────────────────────────────────────────────────────────
  'case-tower-v3': 'Case-icon-v3',
  'case-tower-v2': 'Case-icon-v2',
  'case-tower-v1': 'Case-icon-v1',
  // ── Motherboards ───────────────────────────────────────────────────────────
  'motherboard-z690-atx-v3': 'Z690-ATX-Motherboard-icon-v3',
  'motherboard-z690-atx-v2': 'Z690-ATX-Motherboard-icon-v2',
  'motherboard-z690-atx-v1': 'Z690-ATX-Motherboard-icon-v1',
  'motherboard-z690-mini-itx': 'Z690-Motherboard-Mini-ITX-icon-v1',
  'motherboard-mini-itx': 'Motherboard-Mini-ITX-icon-v1',
  'motherboard-micro-atx': 'Motherboard-Micro-ATX-icon',
  'motherboard-water-cooled': 'Water-Cooled-Motherboard-icon',
  // ── CPU ────────────────────────────────────────────────────────────────────
  'cpu-generic-v2': 'CPU-generic-icon-v2',
  'cpu-generic-v1': 'CPU-generic-icon-v1',
  'cpu-ryzen-v2': 'CPU-Ryzen-icon-v2 00000032606588611442899670000007189341809974596249 ',
  'cpu-ryzen-v1': 'CPU-Ryzen-icon-v1',
  'cpu-threadripper': 'CPU-threadripper-icon-v1 00000035493474734739530330000003854583534835856817 ',
  // ── CPU Water Blocks ───────────────────────────────────────────────────────
  'cpu-block-intel-v2': 'CPU-Block-Intel-icon-v2',
  'cpu-block-intel-v1': 'CPU-Block-Intel-icon-v1',
  'cpu-block-generic': 'CPU-Block-icon-v1',
  'cpu-block-amd-v3': 'CPU-Block-AMD-icon-v3',
  'cpu-block-amd-v2': 'CPU-Block-AMD-icon-v2',
  'cpu-block-amd-v1': 'CPU-Block-AMD-icon-v1',
  'cpu-block-threadripper-v2': 'CPU-Block-Threadripper-icon-v2',
  'cpu-block-threadripper-v1': 'CPU-Block-Threadripper-icon-v1',
  // ── GPU ────────────────────────────────────────────────────────────────────
  'gpu-reference-v4': 'Graphics-Card-reference-icon-v4 00000070088818441933883940000006964392781705457563 ',
  'gpu-reference-v3': 'Graphics-Card-reference-icon-v3',
  'gpu-reference-v2': 'Graphics-Card-reference-icon-v2 00000077303646994644706080000013003664284054694803 ',
  'gpu-reference-v1': 'Graphics-Card-reference-icon-v1',
  'gpu-amd-v2': 'Graphics-Card-AMD-icon-v2',
  'gpu-amd-v1': 'Graphics-Card-AMD-icon-v1',
  'gpu-founders-v4': 'Graphics-Card-founders-edition-icon-v4 00000127724710819999974930000014625291855223746202 ',
  'gpu-founders-v3': 'Graphics-Card-founders-edition-icon-v3 00000057832348935037242570000000387180575090036377 ',
  'gpu-founders-v2': 'Graphics-Card-founders-edition-icon-v2 00000080904427565778282690000006335104738263662257 ',
  'gpu-founders-v1': 'Graphics-Card-founders-edition-icon-v1 00000098900748477409931300000010171967279315300540 ',
  'gpu-quadro': 'Graphics-Card-quadro-icon-v1 00000084500171390005758120000007210477971515661729 ',
  'gpu-wx-series': 'Graphics-Card-WX-series-icon-v1 00000181068318748590111750000003068591167061329561 ',
  // ── GPU Water Blocks ───────────────────────────────────────────────────────
  'gpu-block-reference-v3': 'Graphics-Block-reference-icon-v3',
  'gpu-block-reference-v2': 'Graphics-Block-reference-icon-v2 00000103981221081778540910000007709684191935000738 ',
  'gpu-block-reference-v1': 'Graphics-Block-reference-icon-v1',
  'gpu-block-founders-v2': 'Graphics-Block-founders-edition-icon-v1 00000046302777869840343280000008173462337763218332 ',
  'gpu-block-founders-v1': 'Graphics-Block-founders-edition-icon-v1',
  'gpu-block-active-backplate-v4': 'GPU-Block-Active-Backplate-icon-v4',
  'gpu-block-active-backplate-v3': 'GPU-Block-Active-Backplate-icon-v3',
  'gpu-block-active-backplate-v2': 'GPU-Block-Active-Backplate-icon-v2 00000116236396252210361420000006561922187434753413 ',
  'gpu-block-active-backplate-v1': 'GPU-Block-Active-Backplate-icon-v1 00000122680607216038389420000008951411956726376102 ',
  // ── GPU Backplates ─────────────────────────────────────────────────────────
  'gpu-backplate-passive-v2': 'Passive-Backplate-icon-v2',
  'gpu-backplate-passive-v1': 'Passive-Backplate-icon-v1',
  'gpu-backplate-active-v2': 'Active-Backplate-icon-v2',
  'gpu-backplate-active-v1': 'Active-Backplate-icon-v1 00000054266966612174649530000000551850756441053348 ',
  // ── Liquid Cooled GPU ──────────────────────────────────────────────────────
  'gpu-liquid-cooled-v4': 'Liquid-Cooled-Graphics-Card-icon-v4',
  'gpu-liquid-cooled-v3': 'Liquid-Cooled-Graphics-Card-icon-v3 00000033367049083064860350000006545728350050395565 ',
  'gpu-liquid-cooled-v2': 'Liquid-Cooled-Graphics-Card-icon-v2',
  'gpu-liquid-cooled-v1': 'Liquid-Cooled-Graphics-Card-icon-v1 00000052809137759131215610000004821927491579799707 ',
  // ── RAM ────────────────────────────────────────────────────────────────────
  'ram-v8': 'RAM-icon-v8',
  'ram-v7': 'RAM-icon-v7',
  'ram-v6': 'RAM-icon-v6',
  'ram-v5': 'RAM-icon-v5',
  'ram-v4': 'RAM-icon-v4',
  'ram-v3': 'RAM-icon-v3',
  'ram-v2': 'RAM-icon-v2',
  'ram-v1': 'RAM-icon-v1',
  // ── Storage ────────────────────────────────────────────────────────────────
  'ssd-v2': 'SSD-icon-v2 00000138551466423112047610000017256528103686382480 ',
  'ssd-v1': 'SSD-icon-v1',
  'm2-pcie-v2': 'PCIe-M.2-icon-v2',
  'm2-pcie-v1': 'PCIe-M.2-icon-v1 00000002362889225110553290000008534267351192818844 ',
  'hdd-external-v2': 'External-Hard-Drive-icon-v2 00000023265259327432659770000007194192774413273774 ',
  'hdd-external-v1': 'External-Hard-Drive-icon-v1',
  'hdd-internal-v2': 'Hard-Drive-icon-v2 00000066513941232544837480000000476459101834468996 ',
  'hdd-internal-v1': 'Hard-Drive-icon-v1 00000102523326775431270670000012785817120360993160 ',
  // ── Power Supply ───────────────────────────────────────────────────────────
  'psu-v4': 'Power-Supply-icon-v4',
  'psu-v3': 'Power-Supply-icon-v3 00000129918614100775232030000010156680841884681893 ',
  'psu-v2': 'Power-Supply-icon-v2 00000026869716720731187430000004881741696401637045 ',
  'psu-v1': 'Power-Supply-icon-v1 00000176035903580600603260000017403947867013167503 ',
  // ── CPU Coolers (air) ──────────────────────────────────────────────────────
  'cpu-cooler-tower-v4': 'CPU-Cooler-icon-v4',
  'cpu-cooler-tower-v3': 'CPU-Cooler-icon-v3',
  'cpu-cooler-tower-v2': 'CPU-Cooler-icon-v2',
  'cpu-cooler-tower-v1': 'CPU-Cooler-icon-v1',
  // ── AIO CPU Coolers ────────────────────────────────────────────────────────
  'aio-cooler-v4': 'AIO-Cooler-icon-v4',
  'aio-cooler-v3': 'AIO-Cooler-icon-v3 00000137815604462770089430000018116080495045669801 ',
  'aio-cooler-v2': 'AIO-Cooler-icon-v2 00000044139116962107009030000008862181965395195017 ',
  'aio-cooler-v1': 'AIO-Cooler-icon-v1 00000083772643118144592470000007776732865446294457 ',
  // ── Case Fans ──────────────────────────────────────────────────────────────
  'fan-120mm-v4': '120mm-Cooling-Fan-icon-v4',
  'fan-120mm-v3': '120mm-Cooling-Fan-icon-v3',
  'fan-120mm-v2': '120mm-Cooling-Fan-icon-v2',
  'fan-120mm-v1': '120mm-Cooling-Fan-icon-v1',
  'fan-140mm-v4': '140mm-Cooling-Fan-icon-v4',
  'fan-140mm-v3': '140mm-Cooling-Fan-icon-v3',
  'fan-140mm-v2': '140mm-Cooling-Fan-icon-v2',
  'fan-140mm-v1': '140mm-Cooling-Fan-icon-v1 00000157284286854529377610000005733699578682457775 ',
  // ── Radiators ──────────────────────────────────────────────────────────────
  'radiator-120mm-v4': '120mm-Radiator-icon-v4 00000082338875057620823690000010898260981896814258 ',
  'radiator-120mm-v3': '120mm-Radiator-icon-v3 00000147921086750226260420000004248632172640320682 ',
  'radiator-120mm-v2': '120mm-Radiator-icon-v2 00000079475228738539956820000000545734152321846420 ',
  'radiator-120mm-v1': '120mm-Radiator-icon-v1 00000090285589842144906460000007851514488178288052 ',
  'radiator-240mm-v4': '240mm-Radiator-icon-v4 00000116237035301386361290000010385544297829236403 ',
  'radiator-240mm-v3': '240mm-Radiator-icon-v3 00000045606818325004217860000018347219969342765446 ',
  'radiator-240mm-v2': '240mm-Radiator-icon-v2 00000001638881270087596880000012892033702646850961 ',
  'radiator-240mm-v1': '240mm-Radiator-icon-v1 00000159457885514465862380000010304414615552102044 ',
  'radiator-360mm-v4': '360mm-Radiator-icon-v4 00000095327142692169949130000003568021331310257321 ',
  'radiator-360mm-v3': '360mm-Radiator-icon-v3 00000049917132383308878930000004498661289024767417 ',
  'radiator-360mm-v2': '360mm-Radiator-icon-v2 00000021833827184554074060000004638216503544589477 ',
  'radiator-360mm-v1': '360mm-Radiator-icon-v1 00000116222765120883923970000017637457731194082963 ',
  // ── Distro Plates ──────────────────────────────────────────────────────────
  'distro-plate-v4': 'Distro-Plate-icon-v4',
  'distro-plate-v3': 'Distro-Plate-icon-v3',
  'distro-plate-v2': 'Distro-Plate-icon-v2',
  'distro-plate-v1': 'Distro-Plate-icon-v1',
  // ── Pump & Reservoir ───────────────────────────────────────────────────────
  'pump-reservoir-v4': 'Pump-Reservoir-Combo-icon-v4 00000170972435201407178490000007731532976269501834 ',
  'pump-reservoir-v3': 'Pump-Reservoir-Combo-icon-v3 00000147900442648543903710000007892295179283488135 ',
  'pump-reservoir-v2': 'Pump-Reservoir-Combo-icon-v2 00000029739590792663162980000003125229404429044385 ',
  'pump-reservoir-v1': 'Pump-Reservoir-Combo-icon-v1 00000115510775780657461880000017919842849040212886 ',
  // ── Water Cooling Accessories ──────────────────────────────────────────────
  'coolant-bottle': 'Coolant-icon 00000054963113160504401480000011937758105900433050 ',
  'distilled-water': 'Distilled-Water-icon',
  'filling-bottle': 'Filling-Bottle-icon',
  'hard-line-tubing': 'Hard-Line-Tubing-icon 00000119081246572198318380000007332137026454188692 ',
  'thermal-pads': 'Thermal-Pads-icon 00000112616787144738727630000008559336226014978708 ',
  'bending-jigs': 'Bending-Jigs-icon',
  'leak-tester': 'Leak-Tester-icon',
  'temp-flow-monitor-v2': 'Temperature-flow-monitor-icon-v2',
  'temp-flow-monitor-v1': 'Temperature-flow-monitor-icon-v1 00000004529647018178512240000014504591178449930657 ',
  'flow-indicator-v2': 'Flow-Indicator-icon-v2',
  'flow-indicator-v1': 'Flow-Indicator-icon-v1',
  // ── Fittings & Tools ───────────────────────────────────────────────────────
  'fitting-straight': 'Straight-Fittings-icon',
  'fitting-90deg': '90-Degree-Fitting-icon',
  'fitting-45deg': '45-Degree-Fitting-icon',
  'fitting-offset': 'Offset-Fittings-icon',
  'soft-tube-cutter': 'Soft-Tube-Cutters-icon',
  'hard-line-cutter': 'Hard-Line-Cutting-Tool-icon',
  'thermal-paste': 'Thermal-Paste-icon-v2 00000142897505320441555760000009138709755182826904 ',
  // ── USB Hubs ───────────────────────────────────────────────────────────────
  'hub-v4': 'Hub-icon-v4 00000052095261486393988270000001355746402418790077 ',
  'hub-v3': 'Hub-icon-v3 00000021118638482889022520000003215153500479900847 ',
  'hub-v2': 'Hub-icon-v2 00000124128657813305248540000016890981534823766665 ',
  // ── WiFi / Networking ──────────────────────────────────────────────────────
  'wifi-extender-v2': 'WiFi-USB-Extender-icon-v2',
  'wifi-extender-v1': 'WiFi-USB-Extender-icon-v1',
  'wifi-card-v2': 'WiFi-Card-icon-v2 00000061437885819339048210000017320732549234378937 ',
  'wifi-card-v1': 'WiFi-Card-icon-v1 00000031205660721310494020000017162815200232560049 ',
  // ── Peripherals — Keyboards ────────────────────────────────────────────────
  'keyboard-full': 'Keyboard-icon-v4 00000106129206924142899090000017848376705280693183 ',
  'keyboard-tkl': 'Keyboard-icon-v3',
  'keyboard-compact': 'Keyboard-icon-v2',
  'keyboard-basic': 'Keyboard-icon-v1',
  // ── Peripherals — Microphones ──────────────────────────────────────────────
  'mic-condenser-arm': 'Mic-icon-v4',
  'mic-desk-v3': 'Mic-icon-v3',
  'mic-desk-v2': 'Mic-icon-v2 00000005945414079900381870000016517469265455887794 ',
  'mic-basic': 'Mic-icon-v1',
  // ── Peripherals — Headsets ─────────────────────────────────────────────────
  'headset-gaming-v2': 'Gaming-Headset-icon-v2',
  'headset-gaming-v1': 'Gaming-Headset-icon-v1',
  'earbuds-v2': 'Earbuds-icon-v2',
  'earbuds-v1': 'Earbuds-icon-v1',
  // ── Peripherals — Mice ─────────────────────────────────────────────────────
  'mouse-gaming': 'Mouse-icon-v2',
  'mouse-basic': 'Mouse-icon-v1 00000145756168053207908910000015572000431098693546 ',
  'trackball': 'Trackball-icon 00000010306438384767325940000006610972744443263372 ',
  'graphics-tablet': 'Graphics-Tablet-icon 00000031186282232852528960000017782793016670641080 ',
  // ── Peripherals — Webcams ──────────────────────────────────────────────────
  'webcam-v4': 'Webcam-icon-v4',
  'webcam-v3': 'Webcam-icon-v3',
  'webcam-v2': 'Webcam-icon-v2',
  'webcam-v1': 'Webcam-icon-v1',
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
  // Use a 0-origin viewBox and shift all content via translate.
  // This avoids iOS/Android rendering bugs with large absolute coordinates (2000-4500 range).
  const W = bbox.w.toFixed(2);
  const H = bbox.h.toFixed(2);
  const tx = (-bbox.x).toFixed(2);
  const ty = (-bbox.y).toFixed(2);
  // stroke-width: target ~1.5px visual at any render size.
  // User units = 1/viewBoxSize fraction of render size, so:
  //   stroke-width = 1.5 × max(W,H) / 26 ≈ max(W,H) / 17
  const SW = (Math.max(bbox.w, bbox.h) / 17).toFixed(2);
  const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">\n<g transform="translate(${tx},${ty})" stroke-width="${SW}">\n${inlined}\n</g>\n</svg>`;
  fs.writeFileSync(path.join(OUT_DIR, `${filename}.svg`), svgOut, 'utf8');
  console.log(`✓  ${filename}.svg  [${Math.round(bbox.w)}×${Math.round(bbox.h)}]`);
  written++;
}

console.log(`\nDone: ${written} written, ${failed} failed.`);
