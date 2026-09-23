use reqwest::{header::HeaderMap, Client, StatusCode, Url};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::{
    collections::{HashMap, VecDeque},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
};
use tauri::Emitter;

#[cfg(target_os = "linux")]
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

const NEXUS_API_ROOT: &str = "https://api.nexusmods.com/v1";
const APP_NAME: &str = "GameAtlas";
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_API_RESPONSE_BYTES: u64 = 4 * 1024 * 1024;
#[cfg(target_os = "linux")]
const MAX_NEXUS_DOWNLOAD_BYTES: u64 = 32 * 1024 * 1024 * 1024;

static NEXUS_SESSION: OnceLock<Mutex<Option<NexusSession>>> = OnceLock::new();
static PENDING_NXM_LINKS: OnceLock<Mutex<VecDeque<String>>> = OnceLock::new();
static ACTIVE_NEXUS_DOWNLOADS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();

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
    pub daily_reset: Option<String>,
    pub hourly_reset: Option<String>,
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
    pub download_id: String,
    pub game_name: String,
    pub game_domain: String,
    pub mod_id: u64,
    pub file_id: u64,
    pub file_name: String,
    pub nxm_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NxmLinkRequest {
    pub nxm_url: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NxmLinkInfo {
    pub game_domain: String,
    pub mod_id: u64,
    pub file_id: u64,
    pub mod_page_url: String,
    pub expires_unix: Option<u64>,
    pub authenticated: bool,
}

#[derive(Debug)]
struct ParsedNxmLink {
    info: NxmLinkInfo,
    key: Option<String>,
    user_id: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusDownloadResult {
    pub success: bool,
    pub download_id: String,
    pub file_name: String,
    pub path: String,
    pub bytes_downloaded: u64,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelNexusDownloadRequest {
    pub download_id: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NexusDownloadProgress {
    download_id: String,
    file_name: String,
    destination: String,
    phase: String,
    bytes_downloaded: u64,
    total_bytes: Option<u64>,
    bytes_per_second: u64,
}

struct ActiveNexusDownload {
    download_id: String,
}

impl Drop for ActiveNexusDownload {
    fn drop(&mut self) {
        if let Ok(mut active) = active_nexus_downloads().lock() {
            active.remove(&self.download_id);
        }
    }
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
    pub daily_remaining: Option<u64>,
    pub hourly_remaining: Option<u64>,
    pub daily_reset: Option<String>,
    pub hourly_reset: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusTrackedModUpdate {
    pub deployment_id: String,
    pub name: String,
    pub game_domain: String,
    pub mod_id: u64,
    pub current_file_id: u64,
    pub current_file: Option<NexusFileMetadata>,
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
    pub daily_reset: Option<String>,
    pub hourly_reset: Option<String>,
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

#[derive(Clone, Debug, Default)]
struct NexusQuota {
    daily_remaining: Option<u64>,
    hourly_remaining: Option<u64>,
    daily_reset: Option<String>,
    hourly_reset: Option<String>,
}

fn session() -> &'static Mutex<Option<NexusSession>> {
    NEXUS_SESSION.get_or_init(|| Mutex::new(None))
}

fn pending_nxm_links() -> &'static Mutex<VecDeque<String>> {
    PENDING_NXM_LINKS.get_or_init(|| Mutex::new(VecDeque::new()))
}

fn active_nexus_downloads() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    ACTIVE_NEXUS_DOWNLOADS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn validate_download_id(value: &str) -> Result<String, String> {
    let download_id = value.trim();
    if download_id.is_empty()
        || download_id.len() > 160
        || !download_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("The Nexus download identifier is invalid.".to_string());
    }
    Ok(download_id.to_string())
}

fn register_nexus_download(
    download_id: String,
) -> Result<(ActiveNexusDownload, Arc<AtomicBool>), String> {
    let cancellation = Arc::new(AtomicBool::new(false));
    let mut active = active_nexus_downloads()
        .lock()
        .map_err(|_| "The active Nexus downloads could not be updated.".to_string())?;
    if !active.is_empty() {
        return Err("Another Nexus download is already active. Wait for it to finish or cancel it before starting a new one.".to_string());
    }
    active.insert(download_id.clone(), cancellation.clone());
    Ok((ActiveNexusDownload { download_id }, cancellation))
}

fn emit_download_progress(
    app: &tauri::AppHandle,
    download_id: &str,
    file_name: &str,
    destination: &str,
    phase: &str,
    bytes_downloaded: u64,
    total_bytes: Option<u64>,
    bytes_per_second: u64,
) {
    let _ = app.emit(
        "gameatlas:nexus-download-progress",
        NexusDownloadProgress {
            download_id: download_id.to_string(),
            file_name: file_name.to_string(),
            destination: destination.to_string(),
            phase: phase.to_string(),
            bytes_downloaded,
            total_bytes,
            bytes_per_second,
        },
    );
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

    fn text(headers: &HeaderMap, name: &str) -> Option<String> {
        headers
            .get(name)
            .and_then(|header| header.to_str().ok())
            .map(str::trim)
            .filter(|value| !value.is_empty() && value.len() <= 80)
            .filter(|value| !value.chars().any(char::is_control))
            .map(str::to_string)
    }

    NexusQuota {
        daily_remaining: value(headers, "x-rl-daily-remaining"),
        hourly_remaining: value(headers, "x-rl-hourly-remaining"),
        daily_reset: text(headers, "x-rl-daily-reset"),
        hourly_reset: text(headers, "x-rl-hourly-reset"),
    }
}

fn quota_reset_hint(quota: &NexusQuota) -> String {
    if quota.daily_remaining == Some(0) {
        return quota
            .daily_reset
            .as_deref()
            .map(|reset| format!(" Daily quota resets at {reset}."))
            .unwrap_or_default();
    }
    quota
        .hourly_reset
        .as_deref()
        .map(|reset| format!(" Hourly quota resets at {reset}."))
        .unwrap_or_default()
}

fn api_error(status: StatusCode, quota: &NexusQuota) -> String {
    match status {
        StatusCode::UNAUTHORIZED => {
            "Nexus Mods rejected the API key. It may be invalid or revoked; disconnect the account, create a new key in Nexus API settings, and reconnect."
                .to_string()
        }
        StatusCode::FORBIDDEN => {
            "Nexus Mods denied access to this resource. Confirm the connected account can access it; for a free-account download, request a fresh Mod Manager Download link."
                .to_string()
        }
        StatusCode::NOT_FOUND => {
            "Nexus Mods could not find the requested game, mod, or file. Refresh the page and confirm it is still available."
                .to_string()
        }
        StatusCode::TOO_MANY_REQUESTS => {
            format!(
                "The Nexus Mods API rate limit has been reached. Wait for the quota to reset, then try again.{}",
                quota_reset_hint(quota)
            )
        }
        StatusCode::BAD_REQUEST | StatusCode::UNPROCESSABLE_ENTITY => {
            "Nexus Mods rejected the request as invalid. Refresh the catalog or request a new download link and try again.".to_string()
        }
        status if status.is_server_error() => {
            "Nexus Mods is temporarily unavailable. No local files were changed; try again later."
                .to_string()
        }
        _ => format!(
            "Nexus Mods returned HTTP {}. No local files were changed.",
            status.as_u16()
        ),
    }
}

fn request_error(error: &reqwest::Error, action: &str) -> String {
    if error.is_timeout() {
        return format!("Nexus Mods timed out while {action}. Check the connection and try again.");
    }
    if error.is_connect() {
        return format!(
            "GameAtlas could not connect to Nexus Mods while {action}. Check the network connection and try again."
        );
    }
    format!("The Nexus Mods request failed while {action}. No credentials were logged; try again.")
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
        .map_err(|error| request_error(&error, "requesting API data"))?;

    let status = response.status();
    let quota = quota_from_headers(response.headers());
    let _ = update_quota(&quota);
    if response
        .content_length()
        .is_some_and(|length| length > MAX_API_RESPONSE_BYTES)
    {
        return Err("Nexus Mods returned an unexpectedly large API response.".to_string());
    }
    let body = response
        .bytes()
        .await
        .map_err(|error| request_error(&error, "reading API data"))?;
    if body.len() as u64 > MAX_API_RESPONSE_BYTES {
        return Err("Nexus Mods returned an unexpectedly large API response.".to_string());
    }
    if !status.is_success() {
        return Err(api_error(status, &quota));
    }

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
        daily_reset: quota.daily_reset,
        hourly_reset: quota.hourly_reset,
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

fn update_quota(quota: &NexusQuota) -> Result<(), String> {
    if let Some(active) = session()
        .lock()
        .map_err(|_| "The Nexus account session could not be updated.".to_string())?
        .as_mut()
    {
        active.account.daily_remaining = quota.daily_remaining;
        active.account.hourly_remaining = quota.hourly_remaining;
        active.account.daily_reset = quota.daily_reset.clone();
        active.account.hourly_reset = quota.hourly_reset.clone();
    }
    Ok(())
}

fn ensure_quota_capacity(
    account: &NexusAccountStatus,
    required: u64,
    action: &str,
) -> Result<(), String> {
    let remaining = match (account.hourly_remaining, account.daily_remaining) {
        (Some(hourly), Some(daily)) => Some(hourly.min(daily)),
        (Some(hourly), None) => Some(hourly),
        (None, Some(daily)) => Some(daily),
        (None, None) => None,
    };
    if remaining.is_some_and(|remaining| remaining < required) {
        let quota = NexusQuota {
            daily_remaining: account.daily_remaining,
            hourly_remaining: account.hourly_remaining,
            daily_reset: account.daily_reset.clone(),
            hourly_reset: account.hourly_reset.clone(),
        };
        return Err(format!(
            "Nexus quota is too low to {action}: {required} request{} required, {} remaining.{} Select Refresh after the reset to resume.",
            if required == 1 { " is" } else { "s are" },
            remaining.unwrap_or_default(),
            quota_reset_hint(&quota)
        ));
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

fn parse_nxm_url(value: &str) -> Result<ParsedNxmLink, String> {
    let url = Url::parse(value.trim())
        .map_err(|_| "Nexus supplied an invalid Mod Manager Download link.".to_string())?;
    if url.scheme() != "nxm" {
        return Err("Only nxm:// download links are accepted.".to_string());
    }

    let game_domain = validate_game_domain(
        url.host_str()
            .ok_or_else(|| "The nxm link does not identify a Nexus game.".to_string())?,
    )?;
    let parts = url
        .path_segments()
        .map(|segments| segments.filter(|part| !part.is_empty()).collect::<Vec<_>>())
        .unwrap_or_default();
    let (mod_id, file_id) = match parts.as_slice() {
        ["mods", mod_id, "files", file_id] => (mod_id, file_id),
        ["collections", ..] => {
            return Err(
                "Nexus Collections are not supported yet. Open an individual mod file instead."
                    .to_string(),
            )
        }
        _ => return Err("That nxm link is not an individual Nexus mod-file download.".to_string()),
    };
    let mod_id = mod_id
        .parse::<u64>()
        .ok()
        .filter(|value| *value > 0)
        .ok_or_else(|| "The nxm link contains an invalid mod ID.".to_string())?;
    let file_id = file_id
        .parse::<u64>()
        .ok()
        .filter(|value| *value > 0)
        .ok_or_else(|| "The nxm link contains an invalid file ID.".to_string())?;

    let mut key = None;
    let mut expires_unix = None;
    let mut user_id = None;
    for (name, value) in url.query_pairs() {
        match name.as_ref() {
            "key" if key.is_none() => key = Some(value.into_owned()),
            "expires" if expires_unix.is_none() => {
                expires_unix = value.parse::<u64>().ok();
            }
            "user_id" if user_id.is_none() => {
                user_id = value.parse::<u64>().ok().filter(|value| *value > 0);
            }
            _ => {}
        }
    }

    let credential_count = usize::from(key.is_some())
        + usize::from(expires_unix.is_some())
        + usize::from(user_id.is_some());
    if credential_count != 0 && credential_count != 3 {
        return Err("The nxm download credentials are incomplete. Request a fresh Mod Manager Download link from Nexus Mods.".to_string());
    }
    if let Some(secret) = key.as_deref() {
        if secret.is_empty() || secret.len() > 512 || secret.chars().any(char::is_control) {
            return Err("The nxm download token is invalid.".to_string());
        }
    }
    if let Some(expires) = expires_unix {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or_default();
        if expires <= now {
            return Err(
                "This Mod Manager Download link has expired. Request a new one from Nexus Mods."
                    .to_string(),
            );
        }
    }

    Ok(ParsedNxmLink {
        info: NxmLinkInfo {
            game_domain: game_domain.clone(),
            mod_id,
            file_id,
            mod_page_url: format!("https://www.nexusmods.com/{game_domain}/mods/{mod_id}"),
            expires_unix,
            authenticated: credential_count == 3,
        },
        key,
        user_id,
    })
}

pub fn queue_nxm_link(app: &tauri::AppHandle, value: &str) {
    let accepted_scheme = Url::parse(value)
        .ok()
        .is_some_and(|url| url.scheme() == "nxm");
    if !accepted_scheme || value.len() > 4_096 {
        return;
    }
    let queued = if let Ok(mut pending) = pending_nxm_links().lock() {
        if pending.iter().any(|existing| existing == value) {
            true
        } else if pending.len() >= 10 {
            false
        } else {
            pending.push_back(value.to_string());
            true
        }
    } else {
        false
    };
    if !queued {
        let _ = app.emit(
            "gameatlas:nxm-link-error",
            "The Nexus download queue is full. Finish or dismiss a pending request, then select Mod Manager Download again.",
        );
        return;
    }
    let _ = app.emit("gameatlas:nxm-link", ());
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

#[cfg(target_os = "linux")]
fn archive_signature_matches(file_name: &str, signature: &[u8]) -> bool {
    let extension = Path::new(file_name)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match extension.as_str() {
        "zip" => {
            signature.starts_with(b"PK\x03\x04")
                || signature.starts_with(b"PK\x05\x06")
                || signature.starts_with(b"PK\x07\x08")
        }
        "rar" => signature.starts_with(b"Rar!\x1a\x07"),
        "7z" => signature.starts_with(b"7z\xbc\xaf\x27\x1c"),
        _ => false,
    }
}

fn same_file_category(left: &FileResponse, right: &FileResponse) -> bool {
    match (left.category_id, right.category_id) {
        (Some(left_id), Some(right_id)) => left_id == right_id,
        _ => left
            .category_name
            .trim()
            .eq_ignore_ascii_case(right.category_name.trim()),
    }
}

fn update_candidates(
    files: &[FileResponse],
    current_file_id: u64,
) -> Option<Vec<NexusFileMetadata>> {
    let current = files.iter().find(|file| file.file_id == current_file_id)?;
    let mut candidates = files
        .iter()
        .filter(|file| {
            file.file_id != current.file_id
                && file.uploaded_timestamp > current.uploaded_timestamp
                && supported_archive_name(&file.file_name)
                && same_file_category(file, current)
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
pub fn inspect_nxm_link(request: NxmLinkRequest) -> Result<NxmLinkInfo, String> {
    Ok(parse_nxm_url(&request.nxm_url)?.info)
}

#[tauri::command]
pub fn get_pending_nxm_links() -> Result<Vec<String>, String> {
    Ok(pending_nxm_links()
        .lock()
        .map_err(|_| "The pending Nexus download links could not be accessed.".to_string())?
        .iter()
        .cloned()
        .collect())
}

#[tauri::command]
pub fn dismiss_nxm_link(request: NxmLinkRequest) -> Result<(), String> {
    let mut pending = pending_nxm_links()
        .lock()
        .map_err(|_| "The pending Nexus download links could not be updated.".to_string())?;
    pending.retain(|value| value != request.nxm_url.trim());
    Ok(())
}

#[tauri::command]
pub async fn lookup_nexus_mod(request: NexusLookupRequest) -> Result<NexusModMetadata, String> {
    let (game_domain, mod_id) = parse_nexus_mod_url(&request.nexus_url)?;
    let active = current_session()?;
    ensure_quota_capacity(&active.account, 2, "look up this mod")?;
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
    update_quota(&quota)?;

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
        daily_reset: quota.daily_reset,
        hourly_reset: quota.hourly_reset,
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
    let required_requests = request
        .mods
        .iter()
        .map(|tracked| (tracked.game_domain.to_ascii_lowercase(), tracked.mod_id))
        .collect::<std::collections::HashSet<_>>()
        .len() as u64;
    ensure_quota_capacity(
        &active.account,
        required_requests,
        "check these mod updates",
    )?;
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
            update_quota(&quota)?;
            cache.insert(key.clone(), response.files);
        }
        let files = cache.get(&key).expect("Nexus file cache was populated");
        let current_file = files
            .iter()
            .find(|file| file.file_id == tracked.file_id)
            .cloned()
            .map(file_metadata);
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
                "No newer supported archives were found in the installed file's Nexus category."
                    .to_string(),
                candidates,
            ),
            Some(candidates) => (
                "update-available".to_string(),
                format!(
                    "{} newer file{} found in the installed file's Nexus category. This is not a compatibility guarantee; review the file before replacing the installed payload.",
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
            current_file,
            status,
            message,
            candidates,
        });
    }

    let update_count = results
        .iter()
        .filter(|result| result.status == "update-available")
        .count();
    let quota_status = get_nexus_account_status()?;
    Ok(NexusUpdateReport {
        is_premium: active.account.is_premium,
        checked_count: results.len(),
        update_count,
        results,
        daily_remaining: quota_status.daily_remaining,
        hourly_remaining: quota_status.hourly_remaining,
        daily_reset: quota_status.daily_reset,
        hourly_reset: quota_status.hourly_reset,
    })
}

#[tauri::command]
pub fn cancel_nexus_download(request: CancelNexusDownloadRequest) -> Result<bool, String> {
    let download_id = validate_download_id(&request.download_id)?;
    let active = active_nexus_downloads()
        .lock()
        .map_err(|_| "The active Nexus downloads could not be accessed.".to_string())?;
    let Some(cancellation) = active.get(&download_id) else {
        return Ok(false);
    };
    cancellation.store(true, Ordering::Relaxed);
    Ok(true)
}

#[tauri::command]
pub async fn download_nexus_file(
    app: tauri::AppHandle,
    request: NexusDownloadRequest,
) -> Result<NexusDownloadResult, String> {
    #[cfg(target_os = "linux")]
    {
        let download_id = validate_download_id(&request.download_id)?;
        let (_active_download, cancellation) = register_nexus_download(download_id.clone())?;
        if request.mod_id == 0 || request.file_id == 0 {
            return Err("The Nexus mod or file identifier is invalid.".to_string());
        }
        let game_name = request.game_name.trim();
        if game_name.is_empty() || game_name.len() > 240 {
            return Err("The game name is invalid.".to_string());
        }
        let domain = validate_game_domain(&request.game_domain)?;
        let file_name = safe_archive_name(&request.file_name, request.mod_id, request.file_id)?;
        emit_download_progress(&app, &download_id, &file_name, "", "resolving", 0, None, 0);
        let active = current_session()?;
        ensure_quota_capacity(&active.account, 1, "resolve this download")?;
        let nxm = request.nxm_url.as_deref().map(parse_nxm_url).transpose()?;
        if let Some(link) = nxm.as_ref() {
            if link.info.game_domain != domain
                || link.info.mod_id != request.mod_id
                || link.info.file_id != request.file_id
            {
                return Err(
                    "The nxm link does not match the selected Nexus game, mod, and file."
                        .to_string(),
                );
            }
            if let (Some(link_user_id), Some(account_user_id)) =
                (link.user_id, active.account.user_id)
            {
                if link_user_id != account_user_id {
                    return Err(
                        "This nxm link belongs to a different Nexus Mods account. Request a new link while signed into the connected account."
                            .to_string(),
                    );
                }
            }
        }
        if !active.account.is_premium && !nxm.as_ref().is_some_and(|link| link.info.authenticated) {
            return Err(
                "A free Nexus account requires a fresh Mod Manager Download link. Return to the file page and choose Mod Manager Download again."
                    .to_string(),
            );
        }

        let api_client = client()?;
        let mut download_link_url = Url::parse(&format!(
            "{NEXUS_API_ROOT}/games/{domain}/mods/{}/files/{}/download_link.json",
            request.mod_id, request.file_id
        ))
        .map_err(|_| "Could not construct the Nexus download request.".to_string())?;
        if let Some(link) = nxm.as_ref().filter(|link| link.info.authenticated) {
            let mut query = download_link_url.query_pairs_mut();
            query.append_pair("key", link.key.as_deref().unwrap_or_default());
            query.append_pair(
                "expires",
                &link.info.expires_unix.unwrap_or_default().to_string(),
            );
            query.append_pair("user_id", &link.user_id.unwrap_or_default().to_string());
        }
        let (links, quota) = get_json::<Vec<DownloadLinkResponse>>(
            &api_client,
            download_link_url.to_string(),
            &active.api_key,
        )
        .await?;
        update_quota(&quota)?;
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
        if cancellation.load(Ordering::Relaxed) {
            return Err("Nexus download canceled. No archive was saved.".to_string());
        }

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
            .map_err(|error| request_error(&error, "starting the file download"))?;
        if cancellation.load(Ordering::Relaxed) {
            return Err("Nexus download canceled. No archive was saved.".to_string());
        }
        if !response.status().is_success() {
            return Err(match response.status() {
                StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                    "The Nexus download link was denied or expired. Request a fresh Mod Manager Download link and try again."
                        .to_string()
                }
                StatusCode::NOT_FOUND => {
                    "The selected Nexus file is no longer available from this download mirror. Refresh the mod catalog before retrying."
                        .to_string()
                }
                status if status.is_server_error() => {
                    "The Nexus download mirror is temporarily unavailable. No archive was saved; try again later."
                        .to_string()
                }
                status => format!(
                    "The Nexus download mirror returned HTTP {}. No archive was saved.",
                    status.as_u16()
                ),
            });
        }
        let total_bytes = response.content_length();
        if total_bytes.is_some_and(|length| length > MAX_NEXUS_DOWNLOAD_BYTES) {
            return Err("The Nexus archive exceeds the 32 GiB safety limit.".to_string());
        }

        let mut output = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)
            .map_err(|error| format!("Could not create the temporary Nexus download: {error}"))?;
        let destination_text = destination.to_string_lossy().to_string();
        emit_download_progress(
            &app,
            &download_id,
            &finalized_name,
            &destination_text,
            "downloading",
            0,
            total_bytes,
            0,
        );
        let result: Result<(u64, Vec<u8>, u64), String> = async {
            let mut bytes_downloaded = 0_u64;
            let mut signature = Vec::with_capacity(8);
            let started = Instant::now();
            let mut last_progress = Instant::now();
            while let Some(chunk) = response
                .chunk()
                .await
                .map_err(|error| request_error(&error, "downloading the archive"))?
            {
                if cancellation.load(Ordering::Relaxed) {
                    emit_download_progress(
                        &app,
                        &download_id,
                        &finalized_name,
                        &destination_text,
                        "canceled",
                        bytes_downloaded,
                        total_bytes,
                        0,
                    );
                    return Err(
                        "Nexus download canceled. The partial file was removed.".to_string()
                    );
                }
                if signature.len() < 8 {
                    signature.extend(chunk.iter().take(8_usize.saturating_sub(signature.len())));
                }
                bytes_downloaded = bytes_downloaded.saturating_add(chunk.len() as u64);
                if bytes_downloaded > MAX_NEXUS_DOWNLOAD_BYTES {
                    return Err("The Nexus archive exceeded the 32 GiB safety limit.".to_string());
                }
                output
                    .write_all(&chunk)
                    .map_err(|error| format!("Could not write the Nexus archive: {error}"))?;
                if last_progress.elapsed() >= Duration::from_millis(200) {
                    let elapsed = started.elapsed().as_secs_f64();
                    let bytes_per_second = if elapsed > 0.0 {
                        (bytes_downloaded as f64 / elapsed).round() as u64
                    } else {
                        0
                    };
                    emit_download_progress(
                        &app,
                        &download_id,
                        &finalized_name,
                        &destination_text,
                        "downloading",
                        bytes_downloaded,
                        total_bytes,
                        bytes_per_second,
                    );
                    last_progress = Instant::now();
                }
            }
            if cancellation.load(Ordering::Relaxed) {
                emit_download_progress(
                    &app,
                    &download_id,
                    &finalized_name,
                    &destination_text,
                    "canceled",
                    bytes_downloaded,
                    total_bytes,
                    0,
                );
                return Err("Nexus download canceled. The partial file was removed.".to_string());
            }
            output
                .sync_all()
                .map_err(|error| format!("Could not finalize the Nexus archive: {error}"))?;
            let elapsed = started.elapsed().as_secs_f64();
            let bytes_per_second = if elapsed > 0.0 {
                (bytes_downloaded as f64 / elapsed).round() as u64
            } else {
                0
            };
            Ok((bytes_downloaded, signature, bytes_per_second))
        }
        .await;
        drop(output);

        let (bytes_downloaded, signature, bytes_per_second) = match result {
            Ok((value, signature, bytes_per_second)) if value > 0 => {
                (value, signature, bytes_per_second)
            }
            Ok(_) => {
                let _ = fs::remove_file(&temporary);
                return Err("The Nexus download completed without any file data.".to_string());
            }
            Err(error) => {
                let _ = fs::remove_file(&temporary);
                return Err(error);
            }
        };
        if !archive_signature_matches(&file_name, &signature) {
            let _ = fs::remove_file(&temporary);
            return Err(
                "Nexus returned data that does not match the selected archive type. The temporary file was removed; request a fresh download link and try again."
                    .to_string(),
            );
        }
        if cancellation.load(Ordering::Relaxed) {
            let _ = fs::remove_file(&temporary);
            emit_download_progress(
                &app,
                &download_id,
                &finalized_name,
                &destination_text,
                "canceled",
                bytes_downloaded,
                total_bytes,
                0,
            );
            return Err("Nexus download canceled. The partial file was removed.".to_string());
        }
        if let Err(error) = fs::hard_link(&temporary, &destination) {
            let _ = fs::remove_file(&temporary);
            return Err(format!(
                "Could not commit the Nexus archive to VortexMods: {error}"
            ));
        }
        let _ = fs::remove_file(&temporary);
        emit_download_progress(
            &app,
            &download_id,
            &finalized_name,
            &destination_text,
            "downloaded",
            bytes_downloaded,
            total_bytes,
            bytes_per_second,
        );

        return Ok(NexusDownloadResult {
            success: true,
            download_id,
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
        let _ = (app, request);
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
    fn parses_authenticated_nxm_mod_file_links() {
        let parsed = parse_nxm_url(
            "nxm://godofwar/mods/89/files/202?key=test%2Ftoken%2Bvalue&expires=4102444800&user_id=42",
        )
        .unwrap();
        assert_eq!(parsed.info.game_domain, "godofwar");
        assert_eq!(parsed.info.mod_id, 89);
        assert_eq!(parsed.info.file_id, 202);
        assert_eq!(parsed.info.expires_unix, Some(4_102_444_800));
        assert!(parsed.info.authenticated);
        assert_eq!(parsed.key.as_deref(), Some("test/token+value"));
        assert_eq!(parsed.user_id, Some(42));
    }

    #[test]
    fn accepts_tokenless_nxm_links_for_premium_resolution() {
        let parsed = parse_nxm_url("nxm://cyberpunk2077/mods/123/files/456").unwrap();
        assert_eq!(parsed.info.game_domain, "cyberpunk2077");
        assert_eq!(parsed.info.mod_id, 123);
        assert_eq!(parsed.info.file_id, 456);
        assert!(!parsed.info.authenticated);
    }

    #[test]
    fn rejects_incomplete_or_unsupported_nxm_links() {
        assert!(
            parse_nxm_url("nxm://godofwar/mods/89/files/202?key=token&expires=4102444800").is_err()
        );
        assert!(parse_nxm_url("nxm://godofwar/collections/example/revisions/latest").is_err());
        assert!(parse_nxm_url("https://godofwar/mods/89/files/202").is_err());
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

    #[test]
    fn reads_remaining_quota_and_reset_headers() {
        let mut headers = HeaderMap::new();
        headers.insert("x-rl-hourly-remaining", "0".parse().unwrap());
        headers.insert("x-rl-daily-remaining", "17".parse().unwrap());
        headers.insert(
            "x-rl-hourly-reset",
            "2026-09-22T18:00:00+00:00".parse().unwrap(),
        );

        let quota = quota_from_headers(&headers);
        assert_eq!(quota.hourly_remaining, Some(0));
        assert_eq!(quota.daily_remaining, Some(17));
        assert_eq!(
            quota.hourly_reset.as_deref(),
            Some("2026-09-22T18:00:00+00:00")
        );
    }

    #[test]
    fn refuses_an_action_that_exceeds_known_quota() {
        let account = NexusAccountStatus {
            connected: true,
            hourly_remaining: Some(1),
            daily_remaining: Some(20),
            hourly_reset: Some("2026-09-22T18:00:00+00:00".to_string()),
            ..NexusAccountStatus::default()
        };

        let error = ensure_quota_capacity(&account, 2, "look up this mod").unwrap_err();
        assert!(error.contains("2 requests are required"));
        assert!(error.contains("1 remaining"));
        assert!(error.contains("Select Refresh"));
    }

    #[test]
    fn rate_limit_errors_include_the_known_reset() {
        let quota = NexusQuota {
            hourly_remaining: Some(0),
            hourly_reset: Some("2026-09-22T18:00:00+00:00".to_string()),
            ..NexusQuota::default()
        };

        let error = api_error(StatusCode::TOO_MANY_REQUESTS, &quota);
        assert!(error.contains("rate limit"));
        assert!(error.contains("2026-09-22T18:00:00+00:00"));
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

    #[cfg(target_os = "linux")]
    #[test]
    fn validates_supported_archive_signatures() {
        assert!(archive_signature_matches("mod.zip", b"PK\x03\x04payload"));
        assert!(archive_signature_matches(
            "mod.rar",
            b"Rar!\x1a\x07\x01\x00"
        ));
        assert!(archive_signature_matches("mod.7z", b"7z\xbc\xaf\x27\x1c"));
        assert!(!archive_signature_matches("mod.zip", b"<html>denied"));
        assert!(!archive_signature_matches("mod.exe", b"MZpayload"));
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
    fn obsolete_installed_file_does_not_assume_main_file_compatibility() {
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
        assert!(candidates.is_empty());
    }
}
