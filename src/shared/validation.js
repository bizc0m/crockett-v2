import path from "node:path";

const allowedExternalProtocols = new Set(["http:", "https:", "mailto:"]);
const allowedPermissions = new Set(["ask", "allow", "block"]);

export function normalizePermissionValue(value, fallback = "ask") {
  return allowedPermissions.has(value) ? value : fallback;
}

export function normalizeExternalUrl(value) {
  try {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const parsed = new URL(raw);
    return allowedExternalProtocols.has(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

export function expandHomePath(value, homeDirectory) {
  const target = String(value || "").trim();
  if (!target) return "";
  return target.startsWith("~/") ? path.join(homeDirectory, target.slice(2)) : target;
}

export function safeDownloadFilename(filename) {
  const clean = String(filename || "download")
    .replace(/^(\.\.[/\\])+/, (match) => "_".repeat(match.length + 3))
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/[\u0000-\u001f]/g, "_")
    .trim();
  return clean && clean !== "." && clean !== ".." ? clean : "download";
}
