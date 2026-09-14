#!/usr/bin/env node
import fs from "node:fs";

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) fail(`--${name} requires a value`);
  return value;
}

const manifestPath = arg("manifest");
const expectedVersion = String(arg("version", "")).replace(/^v/, "");
const requireWindows = process.argv.includes("--require-windows");
const requireLinux = process.argv.includes("--require-linux");

if (!manifestPath) fail("--manifest is required");
if (!fs.existsSync(manifestPath)) fail(`Manifest not found: ${manifestPath}`);

const raw = fs.readFileSync(manifestPath, "utf8");

if (raw.charCodeAt(0) === 0xfeff) fail("Manifest contains a UTF-8 BOM");

let manifest;
try {
  manifest = JSON.parse(raw);
} catch (error) {
  fail(`Invalid JSON: ${error.message}`);
}

if (!manifest.version) fail("Manifest version is missing");

if (expectedVersion && String(manifest.version).replace(/^v/, "") !== expectedVersion) {
  fail(`Manifest version mismatch. Expected ${expectedVersion}, got ${manifest.version}`);
}

if (!String(manifest.notes ?? "").trim()) fail("Manifest notes are empty");
if (!manifest.platforms || typeof manifest.platforms !== "object") fail("Manifest platforms object is missing");

function validateEntry(key) {
  const entry = manifest.platforms[key];
  if (!entry) fail(`Missing platforms.${key}`);
  if (!String(entry.signature ?? "").trim()) fail(`Missing signature for ${key}`);
  if (!String(entry.url ?? "").startsWith("https://github.com/")) {
    fail(`Invalid updater URL for ${key}: ${entry.url ?? "(missing)"}`);
  }
}

if (requireWindows) validateEntry("windows-x86_64");

if (requireLinux) {
  validateEntry("linux-x86_64-appimage");
  validateEntry("linux-x86_64");

  const a = manifest.platforms["linux-x86_64-appimage"];
  const b = manifest.platforms["linux-x86_64"];

  if (a.url !== b.url || a.signature !== b.signature) {
    fail("Linux alias entries do not point to the same AppImage/signature");
  }
}

pass(`Updater manifest is valid: ${manifestPath}`);
pass(`Platforms: ${Object.keys(manifest.platforms).join(", ")}`);
