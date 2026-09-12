use std::{
    env,
    path::{Path, PathBuf},
    process::Command,
};

fn strip_wrapping_quotes(value: &str) -> &str {
    value.trim().trim_matches('"').trim_matches('\'')
}

fn expand_percent_variables(value: &str) -> String {
    let mut output = String::with_capacity(value.len());

    let bytes = value.as_bytes();

    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' {
            let remaining = &value[index + 1..];

            if let Some(relative_end) = remaining.find('%') {
                let end = index + 1 + relative_end;

                let variable = &value[index + 1..end];

                if !variable.is_empty() {
                    if let Ok(variable_value) = env::var(variable) {
                        output.push_str(&variable_value);

                        index = end + 1;

                        continue;
                    }
                }
            }
        }

        let character = value[index..]
            .chars()
            .next()
            .expect("index should always be on a character boundary");

        output.push(character);

        index += character.len_utf8();
    }

    output
}

fn replace_case_insensitive(input: &str, needle: &str, replacement: &str) -> String {
    let lower_input = input.to_ascii_lowercase();

    let lower_needle = needle.to_ascii_lowercase();

    let mut output = String::new();

    let mut search_from = 0;

    while let Some(relative) = lower_input[search_from..].find(&lower_needle) {
        let start = search_from + relative;

        let end = start + needle.len();

        output.push_str(&input[search_from..start]);

        output.push_str(replacement);

        search_from = end;
    }

    output.push_str(&input[search_from..]);

    output
}

fn expand_known_placeholders(value: &str, install_path: Option<&str>) -> String {
    let mut output = value.trim().to_string();

    if let Some(install_path) = install_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        for token in [
            "<path-to-game>",
            "<game-path>",
            "<install-path>",
            "{path-to-game}",
            "{game-path}",
        ] {
            output = replace_case_insensitive(&output, token, install_path);
        }
    }

    if let Ok(user_profile) = env::var("USERPROFILE") {
        let documents = Path::new(&user_profile)
            .join("Documents")
            .to_string_lossy()
            .to_string();

        let saved_games = Path::new(&user_profile)
            .join("Saved Games")
            .to_string_lossy()
            .to_string();

        /*
         * PCGamingWiki commonly uses path templates rendered as:
         *
         * <userprofile>
         * <userprofile\documents>
         * <userprofile\saved games>
         *
         * The second form is a single placeholder, not
         * "<userprofile>" followed by "\documents".
         */
        for (token, replacement) in [
            ("<userprofile\\documents>", documents.as_str()),
            ("<userprofile/documents>", documents.as_str()),
            ("<userprofile\\saved games>", saved_games.as_str()),
            ("<userprofile/saved games>", saved_games.as_str()),
            ("<userprofile>", user_profile.as_str()),
            ("{userprofile}", user_profile.as_str()),
            ("<documents>", documents.as_str()),
            ("<saved games>", saved_games.as_str()),
        ] {
            output = replace_case_insensitive(&output, token, replacement);
        }

        if output == "~" || output.starts_with("~/") || output.starts_with("~\\") {
            output = format!("{}{}", user_profile, &output[1..]);
        }
    }

    if let Ok(app_data) = env::var("APPDATA") {
        output = replace_case_insensitive(&output, "<appdata>", &app_data);
    }

    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        output = replace_case_insensitive(&output, "<localappdata>", &local_app_data);
    }

    if let Ok(program_data) = env::var("PROGRAMDATA") {
        output = replace_case_insensitive(&output, "<programdata>", &program_data);
    }

    expand_percent_variables(&output)
}

fn candidate_strings(raw: &str) -> Vec<String> {
    let mut values = Vec::new();

    /*
     * PCGamingWiki can report multiple possible locations.
     * Try common separators while keeping drive letters intact.
     */
    for line in raw
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .lines()
    {
        for candidate in line.split(" | ") {
            let cleaned = strip_wrapping_quotes(candidate)
                .trim()
                .trim_end_matches(';')
                .trim()
                .to_string();

            if cleaned.is_empty() {
                continue;
            }

            if !values.iter().any(|existing| existing == &cleaned) {
                values.push(cleaned);
            }
        }
    }

    if values.is_empty() && !raw.trim().is_empty() {
        values.push(strip_wrapping_quotes(raw).to_string());
    }

    values
}

fn normalize_platform_separators(value: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        return value.replace('/', "\\");
    }

    #[cfg(not(target_os = "windows"))]
    {
        /*
         * PCGamingWiki path templates frequently use Windows-style
         * backslashes even when the platform-specific root has already
         * been expanded to a Linux filesystem path.
         *
         * On Unix, backslash is a normal filename character rather than
         * a path separator, so a mixed path such as:
         *
         *   /home/user/.steam/steam/userdata\\123\\456\\remote
         *
         * must be normalized before existence checks or opening.
         */
        value.replace('\\', "/")
    }
}

#[cfg(target_os = "windows")]
fn steam_root_candidates() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    /*
     * Steam's userdata directory lives under the Steam client root,
     * which may be different from a game's library/install drive.
     *
     * Prefer the per-user Steam registry value, then common defaults.
     */
    if let Ok(output) = Command::new("reg.exe")
        .args(["query", r"HKCU\Software\Valve\Steam", "/v", "SteamPath"])
        .output()
    {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);

            for line in stdout.lines() {
                let trimmed = line.trim();

                if !trimmed.to_ascii_lowercase().starts_with("steampath") {
                    continue;
                }

                let parts = trimmed.split_whitespace().collect::<Vec<_>>();

                if parts.len() >= 3 {
                    let value = parts[2..].join(" ");

                    if !value.is_empty() {
                        roots.push(PathBuf::from(value));
                    }
                }
            }
        }
    }

    if let Ok(program_files_x86) = env::var("ProgramFiles(x86)") {
        roots.push(PathBuf::from(program_files_x86).join("Steam"));
    }

    if let Ok(program_files) = env::var("ProgramFiles") {
        roots.push(PathBuf::from(program_files).join("Steam"));
    }

    let mut unique = Vec::new();

    for root in roots {
        if !unique.iter().any(|existing: &PathBuf| {
            existing
                .to_string_lossy()
                .eq_ignore_ascii_case(&root.to_string_lossy())
        }) {
            unique.push(root);
        }
    }

    unique
}

#[cfg(target_os = "linux")]
fn steam_root_candidates() -> Vec<PathBuf> {
    let Ok(home) = env::var("HOME") else {
        return Vec::new();
    };

    let home = PathBuf::from(home);

    let candidates = [
        home.join(".steam/steam"),
        home.join(".local/share/Steam"),
        home.join(".var/app/com.valvesoftware.Steam/data/Steam"),
    ];

    candidates
        .into_iter()
        .filter(|path| path.is_dir())
        .collect()
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn steam_root_candidates() -> Vec<PathBuf> {
    Vec::new()
}

fn steam_user_ids(steam_root: &Path) -> Vec<String> {
    let userdata = steam_root.join("userdata");

    let entries = match std::fs::read_dir(userdata) {
        Ok(entries) => entries,

        Err(_) => return Vec::new(),
    };

    let mut ids = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();

        if !name.is_empty() && name.chars().all(|character| character.is_ascii_digit()) {
            ids.push(name);
        }
    }

    ids
}

fn steam_path_candidates(raw_candidate: &str) -> Vec<String> {
    let lower = raw_candidate.to_ascii_lowercase();

    let has_steam = lower.contains("<steam>") || lower.contains("{steam}");

    let has_user_id = lower.contains("<user-id>")
        || lower.contains("<userid>")
        || lower.contains("{user-id}")
        || lower.contains("{userid}");

    if !has_steam && !has_user_id {
        return vec![raw_candidate.to_string()];
    }

    let steam_roots = steam_root_candidates();

    if steam_roots.is_empty() {
        return vec![raw_candidate.to_string()];
    }

    let mut output = Vec::new();

    for steam_root in steam_roots {
        let steam = steam_root.to_string_lossy().to_string();

        let mut root_expanded = raw_candidate.to_string();

        for token in ["<steam>", "{steam}"] {
            root_expanded = replace_case_insensitive(&root_expanded, token, &steam);
        }

        if !has_user_id {
            output.push(root_expanded);

            continue;
        }

        let user_ids = steam_user_ids(&steam_root);

        if user_ids.is_empty() {
            output.push(root_expanded);

            continue;
        }

        for user_id in user_ids {
            let mut candidate = root_expanded.clone();

            for token in ["<user-id>", "<userid>", "{user-id}", "{userid}"] {
                candidate = replace_case_insensitive(&candidate, token, &user_id);
            }

            output.push(candidate);
        }
    }

    if output.is_empty() {
        vec![raw_candidate.to_string()]
    } else {
        output
    }
}

#[cfg(target_os = "linux")]
fn normalize_proton_relative_path(value: &str) -> String {
    value.replace('\\', "/").trim_start_matches('/').to_string()
}

#[cfg(target_os = "linux")]
fn proton_translate_candidate(candidate: &str, proton_prefix: Option<&str>) -> String {
    let Some(prefix) = proton_prefix
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return candidate.to_string();
    };

    let prefix = PathBuf::from(prefix);

    let user = prefix.join("drive_c").join("users").join("steamuser");

    let roaming = user.join("AppData").join("Roaming");

    let local = user.join("AppData").join("Local");

    let documents = user.join("Documents");

    let saved_games = user.join("Saved Games");

    let program_data = prefix.join("drive_c").join("ProgramData");

    let mut output = candidate.trim().to_string();

    for (token, replacement) in [
        (
            "<userprofile\\documents>",
            documents.to_string_lossy().as_ref(),
        ),
        (
            "<userprofile/documents>",
            documents.to_string_lossy().as_ref(),
        ),
        (
            "<userprofile\\saved games>",
            saved_games.to_string_lossy().as_ref(),
        ),
        (
            "<userprofile/saved games>",
            saved_games.to_string_lossy().as_ref(),
        ),
        ("%userprofile%", user.to_string_lossy().as_ref()),
        ("<userprofile>", user.to_string_lossy().as_ref()),
        ("{userprofile}", user.to_string_lossy().as_ref()),
        ("%appdata%", roaming.to_string_lossy().as_ref()),
        ("<appdata>", roaming.to_string_lossy().as_ref()),
        ("%localappdata%", local.to_string_lossy().as_ref()),
        ("<localappdata>", local.to_string_lossy().as_ref()),
        ("<documents>", documents.to_string_lossy().as_ref()),
        ("<saved games>", saved_games.to_string_lossy().as_ref()),
        ("%programdata%", program_data.to_string_lossy().as_ref()),
        ("<programdata>", program_data.to_string_lossy().as_ref()),
    ] {
        output = replace_case_insensitive(&output, token, replacement);
    }

    /*
     * PCGamingWiki sometimes provides a literal Windows path rather
     * than a placeholder-based path. Translate the common Proton user
     * root and C: drive forms conservatively.
     */
    let lower = output.to_ascii_lowercase();

    if let Some(relative) = lower.strip_prefix("c:\\users\\steamuser\\") {
        let offset = output.len() - relative.len();

        let actual_relative = normalize_proton_relative_path(&output[offset..]);

        output = user.join(actual_relative).to_string_lossy().to_string();
    } else if let Some(relative) = lower.strip_prefix("c:/users/steamuser/") {
        let offset = output.len() - relative.len();

        output = user
            .join(normalize_proton_relative_path(&output[offset..]))
            .to_string_lossy()
            .to_string();
    } else if lower.starts_with("c:\\") || lower.starts_with("c:/") {
        output = prefix
            .join("drive_c")
            .join(normalize_proton_relative_path(&output[3..]))
            .to_string_lossy()
            .to_string();
    }

    /*
     * Any remaining backslashes are Windows separators within the
     * translated Proton path.
     */
    if output.starts_with(prefix.to_string_lossy().as_ref()) {
        output = output.replace('\\', "/");
    }

    output
}

#[cfg(not(target_os = "linux"))]
fn proton_translate_candidate(candidate: &str, _proton_prefix: Option<&str>) -> String {
    candidate.to_string()
}

fn normalize_candidate(candidate: &str, install_path: Option<&str>) -> Option<PathBuf> {
    let expanded = expand_known_placeholders(candidate, install_path);

    let expanded = normalize_platform_separators(&expanded);

    let cleaned = expanded.trim().trim_matches('"').trim_matches('\'').trim();

    if cleaned.is_empty() {
        return None;
    }

    /*
     * Ignore values that are clearly not filesystem paths.
     */
    let lower = cleaned.to_ascii_lowercase();

    if lower.starts_with("registry:")
        || lower.starts_with("hkey_")
        || lower.starts_with("hkcu")
        || lower.starts_with("hklm")
        || lower.starts_with("http://")
        || lower.starts_with("https://")
    {
        return None;
    }

    let mut normalized = cleaned.to_string();

    while normalized.len() > 3 && (normalized.ends_with('\\') || normalized.ends_with('/')) {
        normalized.pop();
    }

    Some(PathBuf::from(normalized))
}

fn resolve_game_path_internal(
    raw_path: &str,
    install_path: Option<&str>,
    proton_prefix: Option<&str>,
) -> Result<PathBuf, String> {
    let candidates = candidate_strings(raw_path);

    if candidates.is_empty() {
        return Err("No path was provided.".to_string());
    }

    let mut normalized = Vec::new();

    for candidate in candidates {
        let expanded_candidates = steam_path_candidates(&candidate);

        for expanded_candidate in expanded_candidates {
            let translated_candidate =
                proton_translate_candidate(&expanded_candidate, proton_prefix);

            let Some(path) = normalize_candidate(&translated_candidate, install_path) else {
                continue;
            };

            /*
             * Prefer an existing candidate. If it points to a file,
             * open the parent folder instead.
             *
             * Steam placeholders can expand into several local user
             * accounts. Returning the first existing full path avoids
             * guessing which Steam account owns the game's data.
             */
            if path.exists() {
                if path.is_file() {
                    if let Some(parent) = path.parent() {
                        return Ok(parent.to_path_buf());
                    }
                }

                return Ok(path);
            }

            normalized.push(path);
        }
    }

    /*
     * PCGW sometimes points to a folder that has not yet been
     * created. Explorer can still open an existing parent, but
     * showing a misleading location is worse than reporting that
     * the path does not currently exist.
     */
    if let Some(first) = normalized.first() {
        return Err(format!(
            "The resolved path does not currently exist: {}",
            first.display()
        ));
    }

    Err("The reported location is not a filesystem path that Game Manager can open.".to_string())
}

pub(crate) fn resolve_game_path(
    raw_path: &str,
    install_path: Option<&str>,
) -> Result<PathBuf, String> {
    resolve_game_path_internal(raw_path, install_path, None)
}

pub(crate) fn resolve_game_path_with_context(
    raw_path: &str,
    install_path: Option<&str>,
    proton_prefix: Option<&str>,
) -> Result<PathBuf, String> {
    resolve_game_path_internal(raw_path, install_path, proton_prefix)
}

#[cfg(target_os = "windows")]
fn open_in_file_manager(path: &Path) -> Result<(), String> {
    /*
     * Windows Explorer can mis-handle a quoted directory argument
     * that ends in a trailing backslash. PCGamingWiki paths often
     * include that trailing slash, for example:
     *
     * C:\Users\Name\Documents\My Games\Game\Config\
     *
     * In that case Explorer may fall back to opening the Documents
     * known folder instead of the requested subdirectory.
     *
     * Convert the path to a string and remove trailing separators
     * for non-root paths before passing it to explorer.exe.
     */
    let original = path.to_string_lossy().to_string();

    let mut explorer_path = normalize_platform_separators(original.trim());

    while explorer_path.len() > 3 && (explorer_path.ends_with('\\') || explorer_path.ends_with('/'))
    {
        explorer_path.pop();
    }

    println!("[PATHS] Explorer argument: {:?}", explorer_path);

    Command::new("explorer.exe")
        .arg(explorer_path)
        .spawn()
        .map_err(|error| format!("Failed to open File Explorer: {}", error))?;

    Ok(())
}

#[cfg(target_os = "linux")]
fn open_in_file_manager(path: &Path) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|error| format!("Failed to open the file manager: {}", error))?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn open_in_file_manager(path: &Path) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|error| format!("Failed to open Finder: {}", error))?;

    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
fn open_in_file_manager(_path: &Path) -> Result<(), String> {
    Err("Opening folders is not supported on this operating system.".to_string())
}

fn validate_openable_game_file(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("The file does not exist: {}", path.display()));
    }

    if !path.is_file() {
        return Err(format!("The path is not a file: {}", path.display()));
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    /*
     * This command is intentionally narrow. It exists for GameAtlas
     * screenshot/media actions, not as an unrestricted shell launcher.
     */
    let allowed = matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "bmp" | "webp" | "gif"
    );

    if !allowed {
        return Err(format!(
            "GameAtlas does not open this file type through the screenshot viewer: .{}",
            extension
        ));
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn open_file_with_default_app(path: &Path) -> Result<(), String> {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt, ptr};

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(
            hwnd: *mut std::ffi::c_void,
            operation: *const u16,
            file: *const u16,
            parameters: *const u16,
            directory: *const u16,
            show_command: i32,
        ) -> isize;
    }

    let operation = OsStr::new("open")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();

    let file = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();

    let result = unsafe {
        ShellExecuteW(
            ptr::null_mut(),
            operation.as_ptr(),
            file.as_ptr(),
            ptr::null(),
            ptr::null(),
            1,
        )
    };

    /*
     * ShellExecute returns a value greater than 32 on success.
     */
    if result <= 32 {
        return Err(format!(
            "Windows could not open the file with its default application (ShellExecute code {}).",
            result
        ));
    }

    Ok(())
}

#[cfg(target_os = "linux")]
fn open_file_with_default_app(path: &Path) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|error| format!("Failed to open the file: {}", error))?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn open_file_with_default_app(path: &Path) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|error| format!("Failed to open the file: {}", error))?;

    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
fn open_file_with_default_app(_path: &Path) -> Result<(), String> {
    Err("Opening local files is not supported on this operating system.".to_string())
}

#[tauri::command]
pub fn open_game_file(path: String) -> Result<(), String> {
    let path = PathBuf::from(path.trim().trim_matches('"'));

    validate_openable_game_file(&path)?;

    println!("[PATHS] Opening file: {}", path.display());

    open_file_with_default_app(&path)
}

#[tauri::command]
pub fn open_game_path(path: String, install_path: Option<String>) -> Result<(), String> {
    let resolved = resolve_game_path(&path, install_path.as_deref())?;

    println!("[PATHS] Opening: {}", resolved.display());

    open_in_file_manager(&resolved)
}

#[tauri::command]
pub fn open_game_path_with_context(
    path: String,
    install_path: Option<String>,
    proton_prefix: Option<String>,
) -> Result<(), String> {
    let resolved =
        resolve_game_path_with_context(&path, install_path.as_deref(), proton_prefix.as_deref())?;

    println!(
        "[PATHS] Opening with runtime context: {}",
        resolved.display()
    );

    open_in_file_manager(&resolved)
}
