import test from "node:test";
import assert from "node:assert";
import { normalizeExternalUrl, normalizePermissionValue, expandHomePath, safeDownloadFilename } from "../src/shared/validation.js";

test("normalizeExternalUrl accepts browser share targets", () => {
  assert.equal(normalizeExternalUrl("https://example.com"), "https://example.com/");
  assert.equal(normalizeExternalUrl("http://example.com"), "http://example.com/");
  assert.equal(normalizeExternalUrl("mailto:test@example.com"), "mailto:test@example.com");
});

test("normalizeExternalUrl rejects unsafe protocols", () => {
  assert.equal(normalizeExternalUrl("javascript:alert('xss')"), "");
  assert.equal(normalizeExternalUrl("data:text/html,..."), "");
  assert.equal(normalizeExternalUrl("file:///etc/passwd"), "");
});

test("normalizePermissionValue only keeps supported values", () => {
  assert.equal(normalizePermissionValue("ask", "block"), "ask");
  assert.equal(normalizePermissionValue("allow", "block"), "allow");
  assert.equal(normalizePermissionValue("invalid", "block"), "block");
});

test("expandHomePath expands only home-prefixed paths", () => {
  assert.equal(expandHomePath("~/Documents", "/home/user"), "/home/user/Documents");
  assert.equal(expandHomePath("/etc/passwd", "/home/user"), "/etc/passwd");
});

test("safeDownloadFilename strips path traversal", () => {
  assert.equal(safeDownloadFilename("../../etc/passwd"), "_________etc_passwd");
  assert.equal(safeDownloadFilename("file:name.txt"), "file_name.txt");
});
