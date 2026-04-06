const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

function withCleartextHttp(config) {
  config = withDangerousMod(config, [
    "android",
    (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml"
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, "network_security_config.xml"),
        NETWORK_SECURITY_CONFIG
      );
      return cfg;
    },
  ]);

  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    app.$["android:usesCleartextTraffic"] = "true";
    app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    return cfg;
  });

  return config;
}

/** @type {import('@expo/config').ExpoConfig} */
const baseConfig = {
  name: "PC Monitor & Control",
  slug: "pc-monitor-control",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/images/icon.png",
  scheme: "pcmonitorcontrol",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.adrianomelnic.pcmonitorcontrol",
  },
  android: {
    package: "com.adrianomelnic.pcmonitorcontrol",
    usesCleartextTraffic: true,
    permissions: [
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.ACCESS_WIFI_STATE",
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/images/icon.png",
      backgroundColor: "#000000",
    },
  },
  web: {
    favicon: "./assets/images/icon.png",
  },
  plugins: [
    ["expo-router", { origin: "https://replit.com/" }],
    "expo-font",
    "expo-web-browser",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: "8274b5fe-3bcf-4757-a64a-fcec0349ac17",
    },
  },
};

module.exports = withCleartextHttp(baseConfig);
