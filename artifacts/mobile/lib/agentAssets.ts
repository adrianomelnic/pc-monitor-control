import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

const PC_AGENT_MODULE = require("../assets/agent/pc_agent.py");

let cachedUri: string | null = null;

/**
 * Resolves the bundled pc_agent.py to a local file URI suitable for
 * sharing via the OS share sheet (AirDrop, Mail, Files, etc.).
 *
 * On native platforms the asset is downloaded to the cache directory
 * and copied to a stable filename so the share sheet shows
 * "pc_agent.py" instead of an opaque hash.
 */
export async function getBundledAgentScriptUri(): Promise<string> {
  if (cachedUri) return cachedUri;

  const asset = Asset.fromModule(PC_AGENT_MODULE);
  await asset.downloadAsync();

  const sourceUri = asset.localUri ?? asset.uri;
  if (!sourceUri) {
    throw new Error("Could not resolve pc_agent.py asset URI");
  }

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    cachedUri = sourceUri;
    return cachedUri;
  }

  const targetUri = `${cacheDir}pc_agent.py`;

  try {
    const info = await FileSystem.getInfoAsync(targetUri);
    if (info.exists) {
      await FileSystem.deleteAsync(targetUri, { idempotent: true });
    }
    await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
    cachedUri = targetUri;
  } catch {
    cachedUri = sourceUri;
  }

  return cachedUri;
}
