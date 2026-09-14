use crate::steam_keyvalues as kv;
use std::{
    env,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
static WRITE_LOCK: Mutex<()> = Mutex::new(());
pub struct Account {
    pub id: String,
    pub label: String,
    pub config: PathBuf,
    pub value: Option<String>,
}
pub fn read_text(path: &Path) -> Result<String, String> {
    let file = File::open(path).map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    let mut text = String::new();
    file.take(32 * 1024 * 1024 + 1)
        .read_to_string(&mut text)
        .map_err(|e| e.to_string())?;
    if text.len() > 32 * 1024 * 1024 {
        return Err("Steam config exceeds 32 MiB".into());
    }
    Ok(text)
}
fn numeric(value: &str) -> bool {
    !value.is_empty()
        && value.bytes().all(|b| b.is_ascii_digit())
        && value.parse::<u32>().is_ok_and(|v| v > 0)
}
fn roots() -> Result<Vec<PathBuf>, String> {
    let home = PathBuf::from(env::var_os("HOME").ok_or("HOME is unavailable")?);
    let mut roots = Vec::new();
    for suffix in [
        ".steam/steam",
        ".steam/root",
        ".local/share/Steam",
        ".var/app/com.valvesoftware.Steam/data/Steam",
        ".var/app/com.valvesoftware.Steam/.local/share/Steam",
    ] {
        if let Ok(path) = fs::canonicalize(home.join(suffix)) {
            if !roots.contains(&path) {
                roots.push(path);
            }
        }
    }
    Ok(roots)
}
fn libraries(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut result = vec![root.to_path_buf()];
    let path = root.join("steamapps/libraryfolders.vdf");
    if !path.exists() {
        return Ok(result);
    }
    let tree = kv::parse(&read_text(&path)?)?;
    let folders =
        kv::object(kv::child(&tree, "libraryfolders")?.ok_or("Missing libraryfolders object")?)?;
    for folder in folders {
        if !folder.key.bytes().all(|b| b.is_ascii_digit()) {
            continue;
        }
        let path = match &folder.value {
            kv::Value::Text(s, _) => Some(s.clone()),
            kv::Value::Object(nodes, _) => kv::scalar(nodes, "path")?,
        };
        if let Some(path) = path {
            if let Ok(path) = fs::canonicalize(path) {
                if !result.contains(&path) {
                    result.push(path);
                }
            }
        }
    }
    Ok(result)
}
fn owns_game(root: &Path, app: &str, install: &Path) -> Result<bool, String> {
    for library in libraries(root)? {
        let manifest = library.join(format!("steamapps/appmanifest_{app}.acf"));
        if !manifest.exists() {
            continue;
        }
        let tree = kv::parse(&read_text(&manifest)?)?;
        let state = kv::object(kv::child(&tree, "AppState")?.ok_or("Missing AppState")?)?;
        if kv::scalar(state, "appid")?.as_deref() != Some(app) {
            continue;
        }
        if let Some(dir) = kv::scalar(state, "installdir")? {
            if fs::canonicalize(library.join("steamapps/common").join(dir))
                .ok()
                .as_deref()
                == Some(install)
            {
                return Ok(true);
            }
        }
    }
    Ok(false)
}
pub fn accounts(app: &str, install: &str) -> Result<Vec<Account>, String> {
    if !cfg!(target_os = "linux") {
        return Err("Steam launch options integration is Linux-only".into());
    }
    if !numeric(app) {
        return Err("Selected game has an invalid Steam AppID".into());
    }
    accounts_in_roots(app, install, roots()?)
}
fn accounts_in_roots(
    app: &str,
    install: &str,
    steam_roots: Vec<PathBuf>,
) -> Result<Vec<Account>, String> {
    let install =
        fs::canonicalize(install).map_err(|_| "Selected game's install folder is unavailable")?;
    let mut result = Vec::new();
    for root in steam_roots {
        if !owns_game(&root, app, &install)? {
            continue;
        }
        let login_path = root.join("config/loginusers.vdf");
        let login = if login_path.exists() {
            kv::parse(&read_text(&login_path)?)?
        } else {
            Vec::new()
        };
        let users = match kv::child(&login, "users")? {
            Some(n) => kv::object(n)?,
            None => &[],
        };
        let userdata = root.join("userdata");
        if !userdata.exists() {
            continue;
        }
        for entry in fs::read_dir(&userdata).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let id = entry.file_name().to_string_lossy().into_owned();
            if !numeric(&id) {
                continue;
            }
            let config = entry.path().join("config/localconfig.vdf");
            if !config.exists() {
                continue;
            }
            let canonical = fs::canonicalize(&config).map_err(|e| e.to_string())?;
            if !canonical.starts_with(&userdata)
                || fs::symlink_metadata(&config)
                    .map_err(|e| e.to_string())?
                    .file_type()
                    .is_symlink()
            {
                return Err("Refusing redirected Steam account config".into());
            }
            let steam64 = 76561197960265728u64 + id.parse::<u64>().map_err(|e| e.to_string())?;
            let name = match kv::child(users, &steam64.to_string())? {
                Some(n) => kv::scalar(kv::object(n)?, "PersonaName")?
                    .or(kv::scalar(kv::object(n)?, "AccountName")?),
                None => None,
            }
            .unwrap_or_else(|| format!("Account {id}"));
            let value = kv::launch_value(&read_text(&config)?, app)?;
            result.push(Account {
                id: canonical.to_string_lossy().into_owned(),
                label: format!("{name} · {id} · {}", root.display()),
                config: canonical,
                value,
            });
        }
    }
    result.sort_by(|a, b| a.id.cmp(&b.id));
    result.dedup_by(|a, b| a.id == b.id);
    if result.is_empty() {
        return Err("No Steam account config matched this game's AppID and install folder. Sign in to Steam once, then exit Steam and refresh.".into());
    }
    Ok(result)
}
fn pgrep(host: bool) -> Result<bool, String> {
    let mut command = if host {
        let mut c = Command::new("distrobox-host-exec");
        c.arg("pgrep");
        c
    } else {
        Command::new("pgrep")
    };
    let output = command
        .args([
            "-x",
            "steam|steamwebhelper|steam.sh|steam-runtime-launcher-service",
        ])
        .output()
        .map_err(|e| {
            format!(
                "Cannot check {}Steam processes: {e}",
                if host { "host " } else { "" }
            )
        })?;
    match output.status.code() {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => Err("Steam process check failed; writing is disabled".into()),
    }
}
pub fn steam_running() -> Result<bool, String> {
    if !cfg!(target_os = "linux") {
        return Err("Linux-only integration".into());
    }
    let local = pgrep(false)?;
    let container = Path::new("/run/.containerenv").exists()
        || Path::new("/.dockerenv").exists()
        || env::var_os("CONTAINER_ID").is_some()
        || env::var_os("DISTROBOX_ENTER_PATH").is_some()
        || env::var_os("container").is_some();
    if container {
        Ok(pgrep(true)? || local)
    } else {
        Ok(local)
    }
}
fn ensure_stopped() -> Result<(), String> {
    if steam_running()? {
        Err("Exit Steam completely (including the tray icon), then refresh and retry.".into())
    } else {
        Ok(())
    }
}
struct Cleanup(PathBuf);
impl Drop for Cleanup {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}
fn unique_file(config: &Path, suffix: &str) -> Result<(PathBuf, File), String> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    for attempt in 0..100 {
        let path = config.with_file_name(format!(
            "localconfig.vdf.gameatlas-{stamp}-{}-{attempt}.{suffix}",
            std::process::id()
        ));
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        match options.open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.to_string()),
        }
    }
    Err("Could not allocate a unique backup/temp file".into())
}
// Guard is injectable for deterministic transaction tests; production always uses ensure_stopped.
fn transaction(
    config: &Path,
    app: &str,
    expected: Option<&str>,
    value: &str,
    guard: impl Fn() -> Result<(), String>,
) -> Result<Option<PathBuf>, String> {
    guard()?;
    let metadata = fs::symlink_metadata(config).map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err("Steam config must be a regular file".into());
    }
    let original = read_text(config)?;
    if kv::launch_value(&original, app)?.as_deref() != expected {
        return Err(
            "Steam LaunchOptions changed since refresh. Refresh and review before saving.".into(),
        );
    }
    if expected == Some(value) || (expected.is_none() && value.is_empty()) {
        return Ok(None);
    }
    let updated = kv::edit_launch(&original, app, value)?;
    if kv::launch_value(&updated, app)?.as_deref() != Some(value) {
        return Err("Prepared value failed verification".into());
    }
    let lock_path = config.with_file_name(format!(
        "{}.gameatlas-write.lock",
        config
            .file_name()
            .ok_or("Missing config filename")?
            .to_string_lossy()
    ));
    let _lock_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&lock_path)
        .map_err(|e| {
            format!(
                "Cannot acquire GameAtlas write lock {}: {e}",
                lock_path.display()
            )
        })?;
    let _lock_cleanup = Cleanup(lock_path);
    let (backup_path, mut backup) = unique_file(config, "bak")?;
    backup
        .write_all(original.as_bytes())
        .and_then(|_| backup.sync_all())
        .map_err(|e| e.to_string())?;
    if fs::read(&backup_path).map_err(|e| e.to_string())? != original.as_bytes() {
        return Err("Backup verification failed".into());
    }
    File::open(config.parent().ok_or("Missing config directory")?)
        .and_then(|f| f.sync_all())
        .map_err(|e| e.to_string())?;
    let (temporary, mut file) = unique_file(config, "tmp")?;
    let _temp_cleanup = Cleanup(temporary.clone());
    file.set_permissions(metadata.permissions())
        .and_then(|_| file.write_all(updated.as_bytes()))
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    guard()?;
    if fs::symlink_metadata(config)
        .map_err(|e| e.to_string())?
        .file_type()
        .is_symlink()
        || read_text(config)? != original
    {
        return Err(
            "Steam config changed during save; no replacement was made. Refresh and retry.".into(),
        );
    }
    fs::rename(&temporary, config).map_err(|e| {
        format!(
            "Atomic replacement failed: {e}; backup: {}",
            backup_path.display()
        )
    })?;
    let verify = || -> Result<(), String> {
        File::open(config.parent().ok_or("Missing config directory")?)
            .and_then(|f| f.sync_all())
            .map_err(|e| e.to_string())?;
        let actual = read_text(config)?;
        if actual != updated || kv::launch_value(&actual, app)?.as_deref() != Some(value) {
            return Err("Read-back did not match saved data".into());
        }
        guard()?;
        Ok(())
    };
    verify().map_err(|e|format!("Config was written but verification failed: {e}. Exact original backup: {}. Exit Steam before restoring it.",backup_path.display()))?;
    Ok(Some(backup_path))
}
pub fn write(
    app: &str,
    install: &str,
    account_id: &str,
    expected: Option<&str>,
    value: &str,
) -> Result<Option<PathBuf>, String> {
    let _lock = WRITE_LOCK
        .lock()
        .map_err(|_| "Steam write lock unavailable")?;
    if value.len() > 32768 || value.contains('\0') {
        return Err("Invalid or oversized launch options".into());
    }
    ensure_stopped()?;
    let account = accounts(app, install)?
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or("Account no longer matches selected game; refresh")?;
    transaction(&account.config, app, expected, value, ensure_stopped)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> (PathBuf, Cleanup) {
        let (path, mut file) =
            unique_file(&env::temp_dir().join("localconfig.vdf"), "test").unwrap();
        file.write_all(b"UserLocalConfigStore { Software { Valve { Steam { apps { 42 { LaunchOptions old } 43 { LaunchOptions keep } } } } } }").unwrap();
        let cleanup = Cleanup(path.clone());
        (path, cleanup)
    }
    #[test]
    fn backup_atomic_write_clear_and_stale_rejection() {
        let (path, _cleanup) = fixture();
        let original = fs::read(&path).unwrap();
        let backup = transaction(&path, "42", Some("old"), "HDR=1 %command%", || Ok(()))
            .unwrap()
            .unwrap();
        let _backup_cleanup = Cleanup(backup.clone());
        assert_eq!(fs::read(backup).unwrap(), original);
        assert_eq!(
            kv::launch_value(&read_text(&path).unwrap(), "43").unwrap(),
            Some("keep".into())
        );
        assert!(transaction(&path, "42", Some("old"), "bad", || Ok(())).is_err());
        let backup = transaction(&path, "42", Some("HDR=1 %command%"), "", || Ok(()))
            .unwrap()
            .unwrap();
        let _cleanup2 = Cleanup(backup);
        assert_eq!(
            kv::launch_value(&read_text(&path).unwrap(), "42").unwrap(),
            Some("".into())
        );
        assert!(transaction(&path, "42", Some(""), "", || Ok(()))
            .unwrap()
            .is_none());
    }
    #[test]
    fn running_guard_leaves_config_untouched() {
        let (path, _cleanup) = fixture();
        let before = fs::read(&path).unwrap();
        assert!(transaction(&path, "42", Some("old"), "new", || Err(
            "Steam running".into()
        ))
        .is_err());
        assert_eq!(fs::read(path).unwrap(), before);
    }
    #[test]
    fn validates_appids() {
        for id in ["", "../42", "0", "-1", "4294967296"] {
            assert!(!numeric(id));
        }
        assert!(numeric("42"));
    }

    #[test]
    fn discovers_accounts_by_manifest_and_external_library() {
        let root = env::temp_dir().join(format!(
            "gameatlas-discovery-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join("steamapps")).unwrap();
        let library = root.join("external");
        let install = library.join("steamapps/common/Test Game");
        fs::create_dir_all(&install).unwrap();
        fs::write(
            root.join("steamapps/libraryfolders.vdf"),
            format!(
                "libraryfolders {{ 0 {{ path \"{}\" }} }}",
                library.display()
            ),
        )
        .unwrap();
        fs::write(
            library.join("steamapps/appmanifest_42.acf"),
            "AppState { appid 42 installdir \"Test Game\" }",
        )
        .unwrap();
        fs::create_dir_all(root.join("config")).unwrap();
        fs::write(root.join("config/loginusers.vdf"),"users { 76561197960265729 { PersonaName Alice } 76561197960265730 { PersonaName Bob } }").unwrap();
        for id in [1, 2] {
            let dir = root.join(format!("userdata/{id}/config"));
            fs::create_dir_all(&dir).unwrap();
            fs::write(dir.join("localconfig.vdf"), "UserLocalConfigStore {}").unwrap();
        }
        let found = accounts_in_roots("42", install.to_str().unwrap(), vec![root.clone()]).unwrap();
        assert_eq!(found.len(), 2);
        assert!(found[0].label.contains("Alice"));
        assert!(found[1].label.contains("Bob"));
        assert_ne!(found[0].id, found[1].id);
        assert!(accounts_in_roots("43", install.to_str().unwrap(), vec![root.clone()]).is_err());
        assert!(accounts_in_roots("42", root.to_str().unwrap(), vec![root.clone()]).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn second_guard_and_concurrent_edit_abort_before_replace() {
        use std::cell::Cell;
        let (path, _cleanup) = fixture();
        let before = fs::read(&path).unwrap();
        let calls = Cell::new(0);
        assert!(transaction(&path, "42", Some("old"), "new", || {
            calls.set(calls.get() + 1);
            if calls.get() == 2 {
                Err("Steam started".into())
            } else {
                Ok(())
            }
        })
        .is_err());
        assert_eq!(fs::read(&path).unwrap(), before);
        let calls = Cell::new(0);
        assert!(transaction(&path, "42", Some("old"), "new", || {
            calls.set(calls.get() + 1);
            if calls.get() == 2 {
                fs::write(&path, b"external change").unwrap();
            }
            Ok(())
        })
        .is_err());
        assert_eq!(fs::read(&path).unwrap(), b"external change");
    }
}
