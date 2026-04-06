#!/usr/bin/env node
/**
 * Writes network_security_config.xml into the Android res/xml directory
 * so that plain HTTP (cleartext) traffic is allowed on Android.
 *
 * This script runs after `expo prebuild` has generated the android/ directory.
 * It also patches AndroidManifest.xml to reference the security config file
 * and ensures android:usesCleartextTraffic="true" is set.
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const androidRoot = path.join(projectRoot, "android");

// ─── 1. Write network_security_config.xml ───────────────────────────────────
const xmlDir = path.join(
  androidRoot,
  "app",
  "src",
  "main",
  "res",
  "xml"
);
fs.mkdirSync(xmlDir, { recursive: true });

const xml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

const xmlPath = path.join(xmlDir, "network_security_config.xml");
fs.writeFileSync(xmlPath, xml, "utf8");
console.log("[inject-network-security] Wrote", xmlPath);

// ─── 2. Patch AndroidManifest.xml ───────────────────────────────────────────
const manifestPath = path.join(
  androidRoot,
  "app",
  "src",
  "main",
  "AndroidManifest.xml"
);

let manifest = fs.readFileSync(manifestPath, "utf8");

// Ensure usesCleartextTraffic="true"
if (!manifest.includes('android:usesCleartextTraffic="true"')) {
  manifest = manifest.replace(
    /<application /,
    '<application android:usesCleartextTraffic="true" '
  );
  console.log("[inject-network-security] Added usesCleartextTraffic");
}

// Ensure networkSecurityConfig is set
if (!manifest.includes("android:networkSecurityConfig")) {
  manifest = manifest.replace(
    /<application /,
    '<application android:networkSecurityConfig="@xml/network_security_config" '
  );
  console.log("[inject-network-security] Added networkSecurityConfig");
}

fs.writeFileSync(manifestPath, manifest, "utf8");
console.log("[inject-network-security] Patched", manifestPath);
console.log("[inject-network-security] Done.");
