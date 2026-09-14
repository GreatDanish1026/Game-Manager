import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function SteamLaunchOptionsPanel({ game, launchOptions }) {
  if (String(game?.store ?? "").toLowerCase() !== "steam") return null;
  const appId = String(game?.launcherId ?? game?.launcher_id ?? String(game?.id ?? "").replace(/^steam:/, ""));
  const installPath = String(game?.installPath ?? game?.install_path ?? "");
  if (!/^[1-9]\d*$/.test(appId) || !installPath) {
    return <p className="text-xs text-amber-200/70">Steam saving requires a detected Steam AppID and install folder. Refresh your game library.</p>;
  }
  return <AccountControls key={`${appId}:${installPath}`} appId={appId} installPath={installPath} launchOptions={launchOptions} />;
}

function AccountControls({ appId, installPath, launchOptions }) {
  const [state, setState] = useState(null);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  const active = useRef(true);

  async function load(preferred = "") {
    const request = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await invoke("get_steam_launch_options", { appId, installPath });
      if (!active.current || request !== generation.current) return;
      setState(result);
      setAccountId(result.accounts.some((a) => a.id === preferred)
        ? preferred : result.accounts.length === 1 ? result.accounts[0].id : "");
    } catch (e) {
      if (active.current && request === generation.current) { setState(null); setError(String(e)); }
    } finally {
      if (active.current && request === generation.current) setBusy(false);
    }
  }

  useEffect(() => {
    active.current = true;
    load();
    return () => { active.current = false; generation.current += 1; };
  }, []);

  const account = state?.accounts.find((a) => a.id === accountId);
  const blocked = busy || !account || Boolean(state?.writeBlockReason) || state?.running;
  async function write(value) {
    if (blocked) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await invoke("set_steam_launch_options", {
        appId, installPath, accountId, expected: account.current, value,
      });
      if (!active.current) return;
      const outcome = value === "" ? "Steam launch options cleared." : "Saved to Steam.";
      setMessage(result.backupPath ? `${outcome} Backup: ${result.backupPath}` : `${outcome} No file change was needed.`);
      await load(accountId);
    } catch (e) {
      if (active.current) { setError(String(e)); setState(null); setBusy(false); }
    }
  }
  const buttonClass = "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10 disabled:opacity-40";
  return (
    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
      <div className="text-sm font-semibold text-white/75">Stored Steam Launch Options · AppID {appId}</div>
      <label className="block text-xs text-white/60">
        Steam account
        <select className="mt-1 block w-full rounded-lg border border-white/10 bg-[#101722] p-2 text-white/80 [color-scheme:dark]" value={accountId} disabled={busy || !state} onChange={(e) => { setAccountId(e.target.value); setMessage(""); }}>
          <option value="">Select an account</option>
          {state?.accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>
      {account && <pre className="whitespace-pre-wrap break-all rounded-lg bg-[#0b1018] p-3 text-xs text-white/65">{account.current === null ? "No LaunchOptions entry stored." : account.current === "" ? "LaunchOptions is empty." : account.current}</pre>}
      <p className="text-xs text-white/40">Save replaces this account’s launch options for this game with the generated command above. Clear empties the Steam field. Your performance settings remain saved in GameAtlas.</p>
      {state?.writeBlockReason && <p role="status" className="text-xs text-amber-200/75">{state.writeBlockReason}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={blocked} onClick={() => write(launchOptions)}>Save to Steam</button>
        <button type="button" className={buttonClass} disabled={blocked} onClick={() => write("")}>Clear Steam Launch Options</button>
        <button type="button" className={buttonClass} disabled={busy} onClick={() => { setMessage(""); load(accountId); }}>{busy ? "Working…" : "Refresh Steam Options"}</button>
      </div>
      {error && <p role="alert" className="break-all text-xs text-red-200/80">{error}</p>}
      {message && <p role="status" className="break-all text-xs text-emerald-200/80">{message}</p>}
    </div>
  );
}
