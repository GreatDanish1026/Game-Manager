const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
const src = path.join(root, "src-tauri", "src");
const libPath = path.join(src, "lib.rs");
const modulePath = path.join(src, "linux_steam.rs");
const sourcePath = path.join(__dirname, "files", "linux_steam.rs");

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
  return fs.readFileSync(file, "utf8");
}

fs.copyFileSync(sourcePath, modulePath);
console.log("[COPY] src-tauri/src/linux_steam.rs");

let lib = read(libPath);

if (!/^\s*mod linux_steam;\s*$/m.test(lib)) {
  const platformAnchor = /^\s*mod platform;\s*$/m;
  if (platformAnchor.test(lib)) {
    lib = lib.replace(platformAnchor, m => `${m}\nmod linux_steam;`);
  } else {
    const installedAnchor = /^\s*mod installed_games;\s*$/m;
    if (!installedAnchor.test(lib)) {
      throw new Error("Could not find module insertion point in lib.rs");
    }
    lib = lib.replace(installedAnchor, m => `${m}\nmod linux_steam;`);
  }
  console.log("[PATCH] lib.rs linux_steam module");
} else {
  console.log("[SKIP] linux_steam module already registered");
}

if (!lib.includes("linux_steam::get_linux_steam_games")) {
  const marker = "platform::get_platform_info,";
  if (lib.includes(marker)) {
    lib = lib.replace(
      marker,
      `${marker}\n                linux_steam::get_linux_steam_games,`
    );
  } else {
    const handler = "tauri::generate_handler![";
    const i = lib.indexOf(handler);
    if (i < 0) throw new Error("Could not find generate_handler! in lib.rs");
    const at = i + handler.length;
    lib =
      lib.slice(0, at) +
      "\n                linux_steam::get_linux_steam_games," +
      lib.slice(at);
  }
  console.log("[PATCH] lib.rs get_linux_steam_games command");
} else {
  console.log("[SKIP] get_linux_steam_games already registered");
}

fs.writeFileSync(libPath, lib, "utf8");
console.log("[PASS] Linux Steam & Proton Discovery backend installed.");
