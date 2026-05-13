import path from "node:path";

const allowedExternalProtocols = new Set(["http:", "https:", "mailto:"]);
const allowedPermissions = new Set(["ask", "allow", "block"]);

export function normalizePermissionValue(value, fallback = "ask") {
  return allowedPermissions.has(value) ? value : fallback;
}

export function normalizeExternalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("URL externe vide.");
  const parsed = new URL(raw);
  if (!allowedExternalProtocols.has(parsed.protocol)) {
    throw new Error(`Protocole externe interdit: ${parsed.protocol}`);
  }
  return parsed.href;
}

export function expandHomePath(value, homeDirectory) {
  const target = String(value || "").trim();
  if (!target) return "";
  return target.startsWith("~/") ? path.join(homeDirectory, target.slice(2)) : target;
}

export function safeDownloadFilename(filename) {
  const clean = path.basename(String(filename || "download"));
  return clean && clean !== "." && clean !== ".." ? clean : "download";
}
