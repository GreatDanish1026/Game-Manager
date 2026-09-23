import SteamLaunchOptionsEditor from "./SteamLaunchOptionsEditor";

export default function SteamLaunchOptionsPanel({ game, launchOptions }) {
  if (String(game?.store ?? "").toLowerCase() !== "steam") return null;
  const appId = String(game?.launcherId ?? game?.launcher_id ?? String(game?.id ?? "").replace(/^steam:/, ""));
  const installPath = String(game?.installPath ?? game?.install_path ?? "");
  if (!/^[1-9]\d*$/.test(appId) || !installPath) {
    return <p className="text-xs text-amber-200/70">Steam saving requires a detected Steam AppID and install folder. Refresh your game library.</p>;
  }
  return <SteamLaunchOptionsEditor key={`${appId}:${installPath}`} appId={appId} installPath={installPath} launchOptions={launchOptions} />;
}
