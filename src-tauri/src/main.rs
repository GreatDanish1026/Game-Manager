#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn configure_linux_appimage_runtime() {
    /*
     * WebKitGTK can render a blank/white window on some NVIDIA systems
     * when GPU compositing is enabled inside an AppImage.
     *
     * Apply the workaround only to AppImage launches and only when the
     * user has not explicitly chosen a WEBKIT_DISABLE_COMPOSITING_MODE
     * value themselves.
     */
    if std::env::var_os("APPIMAGE").is_some()
        && std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none()
    {
        // This runs before Tauri/WebKit creates worker threads.
        unsafe {
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
    }
}

fn main() {
    #[cfg(target_os = "linux")]
    configure_linux_appimage_runtime();

    gamemanager_lib::run();
}
