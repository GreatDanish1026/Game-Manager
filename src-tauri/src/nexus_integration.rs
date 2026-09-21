use reqwest::{header::HeaderMap, Client, StatusCode, Url};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::time::Duration;
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
};

#[cfg(target_os = "linux")]
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const NEXUS_API_ROOT: &str = "https://api.nexusmods.com/v1";
const APP_NAME: &str = "GameAtlas";
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
#[cfg(target_os = "linux")]
const MAX_NEXUS_DOWNLOAD_BYTES: u64 = 32 * 1024 * 1024 * 1024;

static NEXUS_SESSION: OnceLock<Mutex<Option<NexusSession>>> = OnceLock::new();

#[derive(Clone)]
struct NexusSession {
    api_key: String,
    account: NexusAccountStatus,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusAccountStatus {
    pub connected: bool,
    pub session_only: bool,
    pub user_id: Option<u64>,
    pub name: Option<String>,
    pub profile_url: Option<String>,
    pub is_premium: bool,
    pub is_supporter: bool,
    pub daily_remaining: Option<u64>,
    pub hourly_remaining: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectNexusRequest {
    pub api_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusLookupRequest {
    pub nexus_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusDownloadRequest {
    pub game_name: String,
    pub game_domain: String,
    pub mod_id: u64,
    pub file_id: u64,
    pub file_name: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusDownloadResult {
    pub success: bool,
    pub file_name: String,
    pub path: String,
    pub bytes_downloaded: u64,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusUpdateCheckRequest {
    pub mods: Vec<NexusTrackedMod>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusTrackedMod {
    pub deployment_id: String,
    pub name: String,
    pub game_domain: String,
    pub mod_id: u64,
    pub file_id: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusUpdateReport {
    pub is_premium: bool,
    pub checked_count: usize,
    pub update_count: usize,
    pub results: Vec<NexusTrackedModUpdate>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusTrackedModUpdate {
    pub deployment_id: String,
    pub name: String,
    pub game_domain: String,
    pub mod_id: u64,
    pub current_file_id: u64,
    pub status: String,
    pub message: String,
    pub candidates: Vec<NexusFileMetadata>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusModMetadata {
    pub game_domain: String,
    pub mod_id: u64,
    pub name: String,
    pub summary: String,
    pub version: String,
    pub author: String,
    pub picture_url: Option<String>,
    pub mod_page_url: String,
    pub endorsement_count: u64,
    pub created_unix: u64,
    pub updated_unix: u64,
    pub status: String,
    pub available: bool,
    pub files: Vec<NexusFileMetadata>,
    pub daily_remaining: Option<u64>,
    pub hourly_remaining: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusFileMetadata {
    pub file_id: u64,
    pub name: String,
    pub version: String,
    pub category_id: Option<u64>,
    pub category_name: String,
    pub file_name: String,
    pub description: String,
    pub uploaded_unix: u64,
    pub size_bytes: u64,
    pub primary: bool,
}

#[derive(Debug, Deserialize)]
struct ModResponse {
    #[serde(default)]
    name: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    version: String,
    #[serde(default)]
    author: String,
    picture_url: Option<String>,
    #[serde(default)]
    endorsement_count: u64,
    #[serde(default)]
    created_timestamp: u64,
    #[serde(default)]
    updated_timestamp: u64,
    #[serde(default)]
    status: String,
    #[serde(default)]
    available: bool,
}

#[derive(Debug, Deserialize)]
struct FilesResponse {
    #[serde(default)]
    files: Vec<FileResponse>,
}

#[derive(Clone, Debug, Deserialize)]
struct FileResponse {
    #[serde(default)]
    file_id: u64,
    #[serde(default)]
    name: String,
    #[serde(default)]
    version: String,
    category_id: Option<u64>,
    #[serde(default)]
    category_name: String,
    #[serde(default)]
    file_name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    uploaded_timestamp: u64,
    #[serde(default)]
    size_kb: u64,
    #[serde(default)]
    is_primary: bool,
}

#[derive(Debug, Deserialize)]
struct DownloadLinkResponse {
    #[serde(rename = "URI", alias = "uri")]
    uri: String,
}

#[derive(Clone, Copy, Debug, Default)]
struct NexusQuota {
    daily_remaining: Option<u64>,
    hourly_remaining: Option<u64>,
}

fn session() -> &'static Mutex<Option<NexusSession>> {
    NEXUS_SESSION.get_or_init(|| Mutex::new(None))
}

fn client() -> Result<Client, String> {
    Client::builder()
        .user_agent(format!("{APP_NAME}/{APP_VERSION}"))
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Could not initialize Nexus networking: {error}"))
}

fn quota_from_headers(headers: &HeaderMap) -> NexusQuota {
    fn value(headers: &HeaderMap, name: &str) -> Option<u64> {
        headers
            .get(name)
            .and_then(|header| header.to_str().ok())
            .and_then(|text| text.parse::<u64>().ok())
    }

    NexusQuota {
        daily_remaining: value(headers, "x-rl-daily-remaining"),
        hourly_remaining: value(headers, "x-rl-hourly-remaining"),
    }
}

fn api_error(status: StatusCode) -> String {
    match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            "Nexus Mods rejected the API key. Create or copy a personal API key from your Nexus Mods API settings and try again.".to_string()
        }
        StatusCode::NOT_FOUND => "Nexus Mods could not find that game or mod.".to_string(),
        StatusCode::TOO_MANY_REQUESTS => {
            "The Nexus Mods API rate limit has been reached. Wait for the quota to reset, then try again.".to_string()
        }
        _ => format!("Nexus Mods returned HTTP {status}."),
    }
}

async fn get_json<T: DeserializeOwned>(
    client: &Client,
    url: String,
    api_key: &str,
) -> Result<(T, NexusQuota), String> {
    let response = client
        .get(url)
        .header("apikey", api_key)
        .header("Application-Name", APP_NAME)
        .header("Application-Version", APP_VERSION)
        .send()
        .await
        .map_err(|error| format!("Could not reach Nexus Mods: {error}"))?;

    let status = response.status();
    let quota = quota_from_headers(response.headers());
    if !status.is_success() {
        return Err(api_error(status));
    }

    let body = response
        .bytes()
        .await
        .map_err(|error| format!("Nexus Mods returned an unreadable response body: {error}"))?;
    let value = serde_json::from_slice::<T>(&body).map_err(|error| {
        format!(
            "Nexus Mods returned JSON that GameAtlas could not interpret (line {}, column {}).",
            error.line(),
            error.column()
        )
    })?;
    Ok((value, quota))
}

fn optional_string(value: &serde_json::Value, names: &[&str]) -> Option<String> {
    names
        .iter()
        .filter_map(|name| value.get(*name))
        .find_map(|field| field.as_str())
        .map(str::trim)
        .filter(|field| !field.is_empty())
        .map(str::to_string)
}

fn optional_u64(value: &serde_json::Value, names: &[&str]) -> Option<u64> {
    names
        .iter()
        .filter_map(|name| value.get(*name))
        .find_map(|field| {
            field
                .as_u64()
                .or_else(|| field.as_str().and_then(|text| text.parse::<u64>().ok()))
        })
}

fn flexible_bool(value: &serde_json::Value, names: &[&str]) -> bool {
    names
        .iter()
        .filter_map(|name| value.get(*name))
        .any(|field| {
            field.as_bool().unwrap_or_else(|| {
                field.as_u64() == Some(1)
                    || field.as_str().is_some_and(|text| {
                        matches!(text.to_ascii_lowercase().as_str(), "true" | "1")
                    })
            })
        })
}

fn account_from_json(
    value: serde_json::Value,
    quota: NexusQuota,
) -> Result<NexusAccountStatus, String> {
    if !value.is_object() {
        return Err("Nexus Mods returned an unexpected account response.".to_string());
    }

    let user_id = optional_u64(&value, &["user_id", "userId"]);
    let name = optional_string(&value, &["name"]);
    if user_id.is_none() && name.is_none() {
        return Err(
            "Nexus Mods accepted the request but did not return an account identity.".to_string(),
        );
    }

    Ok(NexusAccountStatus {
        connected: true,
        session_only: true,
        user_id,
        name,
        profile_url: optional_string(&value, &["profile_url", "profileUrl"]),
        is_premium: flexible_bool(&value, &["is_premium", "is_premium?", "isPremium"]),
        is_supporter: flexible_bool(&value, &["is_supporter", "is_supporter?", "isSupporter"]),
        daily_remaining: quota.daily_remaining,
        hourly_remaining: quota.hourly_remaining,
    })
}

async fn validate_account(api_key: &str) -> Result<NexusAccountStatus, String> {
    let (value, quota) = get_json::<serde_json::Value>(
        &client()?,
        format!("{NEXUS_API_ROOT}/users/validate"),
        api_key,
    )
    .await?;
    account_from_json(value, quota)
}

fn current_session() -> Result<NexusSession, String> {
    session()
        .lock()
        .map_err(|_| "The Nexus account session could not be accessed.".to_string())?
        .clone()
        .ok_or_else(|| "Connect a Nexus Mods account before looking up mod metadata.".to_string())
}

fn save_session(next: Option<NexusSession>) -> Result<(), String> {
    *session()
        .lock()
        .map_err(|_| "The Nexus account session could not be updated.".to_string())? = next;
    Ok(())
}

fn update_quota(quota: NexusQuota) -> Result<(), String> {
    if let Some(active) = session()
        .lock()
        .map_err(|_| "The Nexus account session could not be updated.".to_string())?
        .as_mut()
    {
        active.account.daily_remaining = quota.daily_remaining;
        active.account.hourly_remaining = quota.hourly_remaining;
    }
    Ok(())
}

fn parse_nexus_mod_url(value: &str) -> Result<(String, u64), String> {
    let url = Url::parse(value.trim()).map_err(|_| {
        "Paste a complete Nexus Mods URL, such as https://www.nexusmods.com/game/mods/123."
            .to_string()
    })?;
    if url.scheme() != "https"
        || !matches!(url.host_str(), Some("nexusmods.com" | "www.nexusmods.com"))
    {
        return Err("Only HTTPS mod-page URLs from nexusmods.com are accepted.".to_string());
    }

    let parts = url
        .path_segments()
        .map(|segments| segments.filter(|part| !part.is_empty()).collect::<Vec<_>>())
        .unwrap_or_default();
    let (domain, id) =
        match parts.as_slice() {
            [domain, "mods", id, ..] => (*domain, *id),
            ["games", domain, "mods", id, ..] => (*domain, *id),
            _ => return Err(
                "That is not a Nexus Mods mod-page URL. Open the mod page and copy its address."
                    .to_string(),
            ),
        };
    if domain.is_empty()
        || !domain
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("The Nexus game domain in that URL is invalid.".to_string());
    }
    let mod_id = id
        .parse::<u64>()
        .ok()
        .filter(|number| *number > 0)
        .ok_or_else(|| "The Nexus mod ID in that URL is invalid.".to_string())?;
    Ok((domain.to_ascii_lowercase(), mod_id))
}

fn file_metadata(file: FileResponse) -> NexusFileMetadata {
    NexusFileMetadata {
        file_id: file.file_id,
        name: file.name,
        version: file.version,
        category_id: file.category_id,
        category_name: file.category_name,
        file_name: file.file_name,
        description: file.description,
        uploaded_unix: file.uploaded_timestamp,
        size_bytes: file.size_kb.saturating_mul(1024),
        primary: file.is_primary,
    }
}

fn supported_archive_name(value: &str) -> bool {
    let extension = std::path::Path::new(value)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default();
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "zip" | "rar" | "7z"
    )
}

fn obsolete_category(value: &str) -> bool {
    let category = value.to_ascii_lowercase();
    category.contains("old") || category.contains("archiv") || category.contains("delete")
}

fn replacement_category(value: &str) -> bool {
    let category = value.to_ascii_lowercase();
    category.contains("main") || category.contains("update")
}

fn update_candidates(
    files: &[FileResponse],
    current_file_id: u64,
) -> Option<Vec<NexusFileMetadata>> {
    let current = files.iter().find(|file| file.file_id == current_file_id)?;
    let current_is_obsolete = obsolete_category(&current.category_name);
    let mut candidates = files
        .iter()
        .filter(|file| {
            file.file_id != current.file_id
                && file.uploaded_timestamp > current.uploaded_timestamp
                && supported_archive_name(&file.file_name)
                && !obsolete_category(&file.category_name)
                && if current_is_obsolete {
                    file.is_primary || replacement_category(&file.category_name)
                } else {
                    file.category_id == current.category_id
                        || (current.is_primary && file.is_primary)
                }
        })
        .cloned()
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        right
            .is_primary
            .cmp(&left.is_primary)
            .then_with(|| right.uploaded_timestamp.cmp(&left.uploaded_timestamp))
            .then_with(|| right.file_id.cmp(&left.file_id))
    });
    candidates.truncate(8);
    Some(candidates.into_iter().map(file_metadata).collect())
}

fn validate_game_domain(value: &str) -> Result<String, String> {
    let domain = value.trim().to_ascii_lowercase();
    if domain.is_empty()
        || domain.len() > 120
        || !domain
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("The Nexus game domain is invalid.".to_string());
    }
    Ok(domain)
}

#[cfg(target_os = "linux")]
fn safe_archive_name(value: &str, mod_id: u64, file_id: u64) -> Result<String, String> {
    let fallback = format!("nexus-{mod_id}-{file_id}.zip");
    let candidate = value.trim();
    let candidate = if candidate.is_empty() {
        fallback.as_str()
    } else {
        candidate
    };
    if candidate.chars().any(char::is_control)
        || candidate.contains('/')
        || candidate.contains('\\')
    {
        return Err("Nexus returned an unsafe archive filename.".to_string());
    }
    let cleaned = candidate.trim().trim_matches('.').trim();
    if cleaned.is_empty() || cleaned.starts_with(".gameatlas-") {
        return Err("Nexus returned an unsafe archive filename.".to_string());
    }
    let path = Path::new(cleaned);
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default();
    if !matches!(
        extension.to_ascii_lowercase().as_str(),
        "zip" | "rar" | "7z"
    ) {
        return Err(
            "This Nexus file is not a ZIP, RAR, or 7z archive. Download it manually and place an extracted folder in VortexMods."
                .to_string(),
        );
    }
    if cleaned.chars().count() <= 180 {
        return Ok(cleaned.to_string());
    }
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Nexus Mod");
    let available = 179_usize.saturating_sub(extension.chars().count());
    Ok(format!(
        "{}.{}",
        stem.chars().take(available).collect::<String>(),
        extension
    ))
}

#[cfg(target_os = "linux")]
fn available_destination(staging: &Path, file_name: &str) -> PathBuf {
    let requested = staging.join(file_name);
    if !requested.exists() {
        return requested;
    }
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Nexus Mod");
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("zip");
    for suffix in 2..=9999 {
        let candidate = staging.join(format!("{stem} ({suffix}).{extension}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    staging.join(format!("{stem}-{}.{}", file_id_seed(), extension))
}

#[cfg(target_os = "linux")]
fn file_id_seed() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_nexus_account_status() -> Result<NexusAccountStatus, String> {
    Ok(session()
        .lock()
        .map_err(|_| "The Nexus account session could not be accessed.".to_string())?
        .as_ref()
        .map(|active| active.account.clone())
        .unwrap_or_default())
}

#[tauri::command]
pub async fn connect_nexus_account(
    request: ConnectNexusRequest,
) -> Result<NexusAccountStatus, String> {
    let api_key = request.api_key.trim();
    if api_key.len() < 20 || api_key.len() > 256 || api_key.chars().any(char::is_control) {
        return Err("Enter a valid Nexus Mods personal API key.".to_string());
    }

    let account = validate_account(api_key).await?;
    save_session(Some(NexusSession {
        api_key: api_key.to_string(),
        account: account.clone(),
    }))?;
    Ok(account)
}

#[tauri::command]
pub async fn refresh_nexus_account() -> Result<NexusAccountStatus, String> {
    let active = current_session()?;
    let account = validate_account(&active.api_key).await?;
    save_session(Some(NexusSession {
        api_key: active.api_key,
        account: account.clone(),
    }))?;
    Ok(account)
}

#[tauri::command]
pub fn disconnect_nexus_account() -> Result<NexusAccountStatus, String> {
    save_session(None)?;
    Ok(NexusAccountStatus::default())
}

#[tauri::command]
pub async fn lookup_nexus_mod(request: NexusLookupRequest) -> Result<NexusModMetadata, String> {
    let (game_domain, mod_id) = parse_nexus_mod_url(&request.nexus_url)?;
    let active = current_session()?;
    let client = client()?;
    let (mod_data, _) = get_json::<ModResponse>(
        &client,
        format!("{NEXUS_API_ROOT}/games/{game_domain}/mods/{mod_id}.json"),
        &active.api_key,
    )
    .await?;
    let (file_data, quota) = get_json::<FilesResponse>(
        &client,
        format!("{NEXUS_API_ROOT}/games/{game_domain}/mods/{mod_id}/files.json"),
        &active.api_key,
    )
    .await?;
    update_quota(quota)?;

    let files = file_data.files.into_iter().map(file_metadata).collect();

    Ok(NexusModMetadata {
        game_domain: game_domain.clone(),
        mod_id,
        name: mod_data.name,
        summary: mod_data.summary,
        version: mod_data.version,
        author: mod_data.author,
        picture_url: mod_data.picture_url,
        mod_page_url: format!("https://www.nexusmods.com/{game_domain}/mods/{mod_id}"),
        endorsement_count: mod_data.endorsement_count,
        created_unix: mod_data.created_timestamp,
        updated_unix: mod_data.updated_timestamp,
        status: mod_data.status,
        available: mod_data.available,
        files,
        daily_remaining: quota.daily_remaining,
        hourly_remaining: quota.hourly_remaining,
    })
}

#[tauri::command]
pub async fn check_nexus_mod_updates(
    request: NexusUpdateCheckRequest,
) -> Result<NexusUpdateReport, String> {
    if request.mods.len() > 100 {
        return Err("At most 100 managed Nexus mods can be checked at once.".to_string());
    }
    let active = current_session()?;
    let client = client()?;
    let mut cache: HashMap<(String, u64), Vec<FileResponse>> = HashMap::new();
    let mut results = Vec::with_capacity(request.mods.len());

    for tracked in request.mods {
        if tracked.deployment_id.is_empty()
            || tracked.deployment_id.len() > 128
            || tracked.mod_id == 0
            || tracked.file_id == 0
        {
            return Err("A managed Nexus mod has invalid tracking metadata.".to_string());
        }
        let domain = validate_game_domain(&tracked.game_domain)?;
        let key = (domain.clone(), tracked.mod_id);
        if !cache.contains_key(&key) {
            let (response, quota) = get_json::<FilesResponse>(
                &client,
                format!(
                    "{NEXUS_API_ROOT}/games/{domain}/mods/{}/files.json",
                    tracked.mod_id
                ),
                &active.api_key,
            )
            .await?;
            update_quota(quota)?;
            cache.insert(key.clone(), response.files);
        }
        let files = cache.get(&key).expect("Nexus file cache was populated");
        let candidates = update_candidates(files, tracked.file_id);
        let (status, message, candidates) = match candidates {
            None => (
                "current-file-missing".to_string(),
                "The installed Nexus file is no longer present in the current catalog. Review the mod page manually before changing it."
                    .to_string(),
                Vec::new(),
            ),
            Some(candidates) if candidates.is_empty() => (
                "current".to_string(),
                "No newer compatible file candidates were found.".to_string(),
                candidates,
            ),
            Some(candidates) => (
                "update-available".to_string(),
                format!(
                    "{} newer compatible file candidate{} found. Review the selected file before upgrading.",
                    candidates.len(),
                    if candidates.len() == 1 { " was" } else { "s were" }
                ),
                candidates,
            ),
        };
        results.push(NexusTrackedModUpdate {
            deployment_id: tracked.deployment_id,
            name: tracked.name,
            game_domain: domain,
            mod_id: tracked.mod_id,
            current_file_id: tracked.file_id,
            status,
            message,
            candidates,
        });
    }

    let update_count = results
        .iter()
        .filter(|result| result.status == "update-available")
        .count();
    Ok(NexusUpdateReport {
        is_premium: active.account.is_premium,
        checked_count: results.len(),
        update_count,
        results,
    })
}

#[tauri::command]
pub async fn download_nexus_file(
    request: NexusDownloadRequest,
) -> Result<NexusDownloadResult, String> {
    #[cfg(target_os = "linux")]
    {
        if request.mod_id == 0 || request.file_id == 0 {
            return Err("The Nexus mod or file identifier is invalid.".to_string());
        }
        let game_name = request.game_name.trim();
        if game_name.is_empty() || game_name.len() > 240 {
            return Err("The game name is invalid.".to_string());
        }
        let domain = validate_game_domain(&request.game_domain)?;
        let file_name = safe_archive_name(&request.file_name, request.mod_id, request.file_id)?;
        let active = current_session()?;
        if !active.account.is_premium {
            return Err(
                "Direct API downloads require Nexus Mods Premium. Open the file page in your browser, download it there, and move the archive into this game's VortexMods folder."
                    .to_string(),
            );
        }

        let api_client = client()?;
        let (links, quota) = get_json::<Vec<DownloadLinkResponse>>(
            &api_client,
            format!(
                "{NEXUS_API_ROOT}/games/{domain}/mods/{}/files/{}/download_link",
                request.mod_id, request.file_id
            ),
            &active.api_key,
        )
        .await?;
        update_quota(quota)?;
        let link = links.into_iter().next().ok_or_else(|| {
            "Nexus Mods did not return a download mirror for that file.".to_string()
        })?;
        let download_url = Url::parse(&link.uri)
            .map_err(|_| "Nexus Mods returned an invalid download mirror.".to_string())?;
        if download_url.scheme() != "https" || download_url.host_str().is_none() {
            return Err("Nexus Mods returned an unsafe download mirror.".to_string());
        }

        let staging = crate::linux_mod_deployment::staging_directory(game_name)?;
        let destination = available_destination(&staging, &file_name);
        let finalized_name = destination
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "Could not create a safe Nexus archive filename.".to_string())?
            .to_string();
        let temporary = staging.join(format!(
            ".gameatlas-download-{}-{}.part",
            request.file_id,
            file_id_seed()
        ));

        let download_client = Client::builder()
            .user_agent(format!("{APP_NAME}/{APP_VERSION}"))
            .https_only(true)
            .connect_timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .map_err(|error| format!("Could not initialize the Nexus downloader: {error}"))?;
        let mut response = download_client
            .get(download_url)
            .send()
            .await
            .map_err(|error| format!("Could not start the Nexus download: {error}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "The Nexus download mirror returned HTTP {}.",
                response.status()
            ));
        }
        if response
            .content_length()
            .is_some_and(|length| length > MAX_NEXUS_DOWNLOAD_BYTES)
        {
            return Err("The Nexus archive exceeds the 32 GiB safety limit.".to_string());
        }

        let mut output = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)
            .map_err(|error| format!("Could not create the temporary Nexus download: {error}"))?;
        let result: Result<u64, String> = async {
            let mut bytes_downloaded = 0_u64;
            while let Some(chunk) = response
                .chunk()
                .await
                .map_err(|error| format!("The Nexus download was interrupted: {error}"))?
            {
                bytes_downloaded = bytes_downloaded.saturating_add(chunk.len() as u64);
                if bytes_downloaded > MAX_NEXUS_DOWNLOAD_BYTES {
                    return Err("The Nexus archive exceeded the 32 GiB safety limit.".to_string());
                }
                output
                    .write_all(&chunk)
                    .map_err(|error| format!("Could not write the Nexus archive: {error}"))?;
            }
            output
                .sync_all()
                .map_err(|error| format!("Could not finalize the Nexus archive: {error}"))?;
            Ok(bytes_downloaded)
        }
        .await;
        drop(output);

        let bytes_downloaded = match result {
            Ok(value) if value > 0 => value,
            Ok(_) => {
                let _ = fs::remove_file(&temporary);
                return Err("The Nexus download completed without any file data.".to_string());
            }
            Err(error) => {
                let _ = fs::remove_file(&temporary);
                return Err(error);
            }
        };
        if let Err(error) = fs::hard_link(&temporary, &destination) {
            let _ = fs::remove_file(&temporary);
            return Err(format!(
                "Could not commit the Nexus archive to VortexMods: {error}"
            ));
        }
        let _ = fs::remove_file(&temporary);

        return Ok(NexusDownloadResult {
            success: true,
            file_name: finalized_name.clone(),
            path: destination.to_string_lossy().to_string(),
            bytes_downloaded,
            message: format!(
                "Downloaded {finalized_name} to VortexMods. Extract and preview it before installation."
            ),
        });
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = request;
        Err(
            "Nexus downloads through the GameAtlas mod manager are available on Linux only."
                .to_string(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_current_and_legacy_mod_urls() {
        assert_eq!(
            parse_nexus_mod_url("https://www.nexusmods.com/godofwar/mods/47?tab=files").unwrap(),
            ("godofwar".to_string(), 47)
        );
        assert_eq!(
            parse_nexus_mod_url("https://www.nexusmods.com/games/cyberpunk2077/mods/123/").unwrap(),
            ("cyberpunk2077".to_string(), 123)
        );
    }

    #[test]
    fn rejects_non_nexus_and_non_mod_urls() {
        assert!(parse_nexus_mod_url("https://example.com/godofwar/mods/47").is_err());
        assert!(parse_nexus_mod_url("http://www.nexusmods.com/godofwar/mods/47").is_err());
        assert!(parse_nexus_mod_url("https://www.nexusmods.com/godofwar").is_err());
    }

    #[test]
    fn accepts_account_field_variations() {
        let account = account_from_json(
            serde_json::from_str(
                r#"{"user_id":"42","name":"AtlasUser","is_premium?":1,"is_supporter":"false","profile_url":false}"#,
            )
            .unwrap(),
            NexusQuota::default(),
        )
        .unwrap();
        assert_eq!(account.user_id, Some(42));
        assert_eq!(account.name.as_deref(), Some("AtlasUser"));
        assert_eq!(account.profile_url, None);
        assert!(account.is_premium);
        assert!(!account.is_supporter);
    }

    #[test]
    fn rejects_account_payload_without_an_identity() {
        assert!(account_from_json(
            serde_json::json!({ "is_premium": true }),
            NexusQuota::default()
        )
        .is_err());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn accepts_only_safe_supported_archive_names() {
        assert_eq!(
            safe_archive_name("Useful Mod-1.2.7z", 10, 20).unwrap(),
            "Useful Mod-1.2.7z"
        );
        assert!(safe_archive_name("../escape.zip", 10, 20).is_err());
        assert!(safe_archive_name("installer.exe", 10, 20).is_err());
        assert!(safe_archive_name(".gameatlas-hidden.rar", 10, 20).is_err());
    }

    #[test]
    fn update_candidates_exclude_old_and_unrelated_files() {
        let files = vec![
            FileResponse {
                file_id: 10,
                name: "Installed".to_string(),
                version: "1.0".to_string(),
                category_id: Some(1),
                category_name: "MAIN".to_string(),
                file_name: "mod-1.zip".to_string(),
                description: String::new(),
                uploaded_timestamp: 100,
                size_kb: 1,
                is_primary: true,
            },
            FileResponse {
                file_id: 20,
                name: "New main".to_string(),
                version: "2.0".to_string(),
                category_id: Some(1),
                category_name: "MAIN".to_string(),
                file_name: "mod-2.7z".to_string(),
                description: String::new(),
                uploaded_timestamp: 200,
                size_kb: 2,
                is_primary: true,
            },
            FileResponse {
                file_id: 30,
                name: "Old".to_string(),
                version: "0.9".to_string(),
                category_id: Some(1),
                category_name: "OLD VERSION".to_string(),
                file_name: "old.rar".to_string(),
                description: String::new(),
                uploaded_timestamp: 300,
                size_kb: 2,
                is_primary: false,
            },
            FileResponse {
                file_id: 40,
                name: "Optional".to_string(),
                version: "1.0".to_string(),
                category_id: Some(3),
                category_name: "OPTIONAL".to_string(),
                file_name: "optional.zip".to_string(),
                description: String::new(),
                uploaded_timestamp: 400,
                size_kb: 2,
                is_primary: false,
            },
        ];
        let candidates = update_candidates(&files, 10).unwrap();
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].file_id, 20);
    }

    #[test]
    fn obsolete_installed_file_finds_new_main_replacement() {
        let files = vec![
            FileResponse {
                file_id: 202,
                name: "Installed old version".to_string(),
                version: "0.1".to_string(),
                category_id: Some(4),
                category_name: "OLD_VERSION".to_string(),
                file_name: "old-version.zip".to_string(),
                description: String::new(),
                uploaded_timestamp: 100,
                size_kb: 1,
                is_primary: false,
            },
            FileResponse {
                file_id: 250,
                name: "Current main file".to_string(),
                version: "0.2".to_string(),
                category_id: Some(1),
                category_name: "MAIN".to_string(),
                file_name: "current-version.7z".to_string(),
                description: String::new(),
                uploaded_timestamp: 200,
                size_kb: 2,
                is_primary: true,
            },
            FileResponse {
                file_id: 260,
                name: "Unrelated optional file".to_string(),
                version: "1.0".to_string(),
                category_id: Some(3),
                category_name: "OPTIONAL".to_string(),
                file_name: "optional.zip".to_string(),
                description: String::new(),
                uploaded_timestamp: 300,
                size_kb: 2,
                is_primary: false,
            },
        ];

        let candidates = update_candidates(&files, 202).unwrap();
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].file_id, 250);
        assert_eq!(candidates[0].category_name, "MAIN");
    }
}
