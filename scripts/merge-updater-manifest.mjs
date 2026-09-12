#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) fail(`--${name} requires a value`);
  return value;
}

function readSignature(file) {
  if (!file || !fs.existsSync(file)) return null;
  const value = fs.readFileSync(file, "utf8").trim();
  return value || null;
}

const version = arg("version");
const repo = arg("repo", "GreatDanish1026/Game-Manager");
const out = arg("out", "latest.json");

const windowsAsset = arg("windows-asset");
const windowsSigFile = arg("windows-sig");
const linuxAsset = arg("linux-asset");
const linuxSigFile = arg("linux-sig");

if (!version) fail("--version is required");

const platforms = {};

if (windowsAsset || windowsSigFile) {
  if (!windowsAsset || !windowsSigFile) {
    fail("Windows updater requires both --windows-asset and --windows-sig");
  }
  const sig = readSignature(windowsSigFile);
  if (!sig) fail(`Windows signature is missing/empty: ${windowsSigFile}`);
  platforms["windows-x86_64"] = {
    signature: sig,
    url: `https://github.com/${repo}/releases/download/v${version}/${path.basename(windowsAsset)}`
  };
}

if (linuxAsset || linuxSigFile) {
  if (!linuxAsset || !linuxSigFile) {
    fail("Linux updater requires both --linux-asset and --linux-sig");
  }
  const sig = readSignature(linuxSigFile);
  if (!sig) fail(`Linux signature is missing/empty: ${linuxSigFile}`);

  const entry = {
    signature: sig,
    url: `https://github.com/${repo}/releases/download/v${version}/${path.basename(linuxAsset)}`
  };

  // linux-x86_64 is Tauri's documented default key.
  platforms["linux-x86_64"] = entry;

  // GameAtlas/Tauri may request the AppImage-specific fallback target first.
  // Keeping the alias makes the static manifest work with either target string.
  platforms["linux-x86_64-appimage"] = { ...entry };
}

if (Object.keys(platforms).length === 0) {
  fail("No platform assets were provided");
}

const manifest = {
  version,
  notes: `GameAtlas v${version}`,
  pub_date: new Date().toISOString(),
  platforms
};

fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`[PASS] Wrote ${out}`);
console.log(`[PASS] Platforms: ${Object.keys(platforms).join(", ")}`);
