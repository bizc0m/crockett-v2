export function normalizeExternalUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  const lc = trimmed.toLowerCase();
  if (lc.startsWith("http://") || lc.startsWith("https://") || lc.startsWith("mailto:")) {
    return trimmed;
  }
  return "";
}

export function normalizePermissionValue(val, defaultVal) {
  return ["ask", "allow", "block"].includes(val) ? val : defaultVal;
}

export function expandHomePath(path, homeDir) {
  if (!path || typeof path !== "string") return "";
  if (path.startsWith("~/")) return homeDir + path.slice(1);
  return path;
}

export function safeDownloadFilename(name) {
  if (!name) return "download";
  return String(name).replace(/[\/\\:*?"<>|]/g, "_").slice(0, 200);
}
