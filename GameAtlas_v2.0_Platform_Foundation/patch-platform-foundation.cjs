const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
const sourceDir = path.join(root, "src-tauri", "src");

const libPath = path.join(sourceDir, "lib.rs");
const hardwarePath = path.join(sourceDir, "system_hardware.rs");
const platformSource = path.join(__dirname, "files", "platform.rs");
const platformDestination = path.join(sourceDir, "platform.rs");

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Required file not found: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

function write(file, text) {
  fs.writeFileSync(file, text, "utf8");
}

fs.copyFileSync(platformSource, platformDestination);
console.log("[COPY] src-tauri/src/platform.rs");

let lib = read(libPath);

if (!/^\s*mod platform;\s*$/m.test(lib)) {
  const moduleAnchor = /^\s*mod system_hardware;\s*$/m;
  if (moduleAnchor.test(lib)) {
    lib = lib.replace(moduleAnchor, (match) => `${match}\nmod platform;`);
  } else {
    const firstMod = lib.match(/^\s*mod\s+\w+;\s*$/m);
    if (!firstMod) {
      throw new Error("Could not find module insertion point in src-tauri/src/lib.rs");
    }
    lib = lib.replace(firstMod[0], `${firstMod[0]}\nmod platform;`);
  }
  console.log("[PATCH] lib.rs platform module");
} else {
  console.log("[SKIP] lib.rs platform module already present");
}

if (!lib.includes("platform::get_platform_info")) {
  const handlerAnchor = /(\s*system_hardware::get_system_hardware\s*,?)/;
  if (handlerAnchor.test(lib)) {
    lib = lib.replace(
      handlerAnchor,
      `\n                platform::get_platform_info,\n$1`
    );
  } else {
    const handlerStart = lib.indexOf("tauri::generate_handler![");
    if (handlerStart < 0) {
      throw new Error("Could not find Tauri generate_handler list in lib.rs");
    }
    const insertAt = handlerStart + "tauri::generate_handler![".length;
    lib =
      lib.slice(0, insertAt) +
      "\n                platform::get_platform_info," +
      lib.slice(insertAt);
  }
  console.log("[PATCH] lib.rs get_platform_info command");
} else {
  console.log("[SKIP] get_platform_info already registered");
}

write(libPath, lib);

let hardware = read(hardwarePath);

if (hardware.includes("detect_linux_system_hardware")) {
  console.log("[SKIP] Linux system hardware implementation already present");
} else {
  const oldFallback =
/#\[cfg\(not\(target_os = "windows"\)\)\]\s*#\[tauri::command\]\s*pub fn get_system_hardware\(\) -> Result<SystemHardwareInfo, String> \{\s*Err\(\s*"System hardware detection is currently implemented for Windows\."\s*\.to_string\(\)\s*\)\s*\}/m;

  if (!oldFallback.test(hardware)) {
    throw new Error(
      "Could not find the expected non-Windows get_system_hardware fallback. " +
      "No hardware changes were made."
    );
  }

  hardware = hardware.replace(oldFallback, "");
  hardware = hardware.trimEnd() + "\n\n" + fs.readFileSync(
    path.join(__dirname, "files", "linux-system-hardware.rs"),
    "utf8"
  ).trim() + "\n";

  console.log("[PATCH] system_hardware.rs Linux implementation");
  write(hardwarePath, hardware);
}

console.log("[PASS] GameAtlas 2.0 Platform Foundation patch applied.");
