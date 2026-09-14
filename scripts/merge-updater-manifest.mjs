#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

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

function normalizeVersion(value) {
  const cleaned = String(value ?? "").trim().replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+([\-+][0-9A-Za-z.-]+)?$/.test(cleaned)) {
    fail(`Invalid version: ${value}`);
  }
  return cleaned;
}

function requireFile(file, label) {
  if (!file || !fs.existsSync(file)) fail(`${label} not found: ${file ?? "(not supplied)"}`);
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size <= 0) fail(`${label} is empty or not a file: ${file}`);
}

function readSignature(file, label) {
  requireFile(file, label);
  const value = fs.readFileSync(file, "utf8").trim();
  if (!value) fail(`${label} is empty: ${file}`);
  return value;
}

const version = normalizeVersion(arg("version"));
const repo = arg("repo", "GreatDanish1026/Game-Manager");
const out = arg("out", "latest.json");
const notesFile = arg("notes-file");

const windowsAsset = arg("windows-asset");
const windowsSigFile = arg("windows-sig");
const linuxAsset = arg("linux-asset");
const linuxSigFile = arg("linux-sig");

const requireWindows = process.argv.includes("--require-windows");
const requireLinux = process.argv.includes("--require-linux");

const platforms = {};

if (windowsAsset || windowsSigFile) {
  if (!windowsAsset || !windowsSigFile) fail("Windows updater requires both --windows-asset and --windows-sig");
  requireFile(windowsAsset, "Windows updater asset");
  const signature = readSignature(windowsSigFile, "Windows updater signature");

  platforms["windows-x86_64"] = {
    signature,
    url: `https://github.com/${repo}/releases/download/v${version}/${path.basename(windowsAsset)}`
  };
}

if (linuxAsset || linuxSigFile) {
  if (!linuxAsset || !linuxSigFile) fail("Linux updater requires both --linux-asset and --linux-sig");
  requireFile(linuxAsset, "Linux AppImage updater asset");
  const signature = readSignature(linuxSigFile, "Linux AppImage updater signature");

  const entry = {
    signature,
    url: `https://github.com/${repo}/releases/download/v${version}/${path.basename(linuxAsset)}`
  };

  platforms["linux-x86_64-appimage"] = { ...entry };
  platforms["linux-x86_64"] = { ...entry };
}

if (requireWindows && !platforms["windows-x86_64"]) {
  fail("Combined updater manifest requires platforms.windows-x86_64");
}

if (requireLinux && (!platforms["linux-x86_64-appimage"] || !platforms["linux-x86_64"])) {
  fail("Combined updater manifest requires both Linux keys: linux-x86_64-appimage and linux-x86_64");
}

if (Object.keys(platforms).length === 0) fail("No updater platform assets were provided");

let notes = `GameAtlas v${version}`;

if (notesFile) {
  requireFile(notesFile, "Release notes file");
  const supplied = fs.readFileSync(notesFile, "utf8").trim();
  if (supplied) notes = supplied;
}

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms
};

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n", "utf8");

pass(`Wrote ${out}`);
pass(`Platforms: ${Object.keys(platforms).join(", ")}`);
