import { useEffect, useState } from "react";
import { getLaunchProcesses, getLaunchRestoreCount, restoreLaunchApps, sortLaunchProcessesByVram } from "../services/launchCleanup";
import { updateSettings } from "../services/settings";

const bytesLabel = (bytes) => bytes == null ? "Not reported" : `${Math.round(bytes / 1048576)} MiB`;
const pathKey = (path) => String(path).toLowerCase();

export default function LaunchCleanupSettings({ settings, onSettingsChange }) {
  const [processes, setProcesses] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [restoreCount, setRestoreCount] = useState(0);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [running, count] = await Promise.all([getLaunchProcesses(), getLaunchRestoreCount()]);
      setProcesses(Array.isArray(running) ? running : []);
      setRestoreCount(count);
    } catch (failure) {
      setError(`Could not inspect running apps: ${String(failure)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  function change(patch) { onSettingsChange(updateSettings(patch)); }

  function togglePath(path) {
    const current = settings.launchCleanupPaths;
    const exists = current.some((item) => pathKey(item) === pathKey(path));
    change({ launchCleanupPaths: exists ? current.filter((item) => pathKey(item) !== pathKey(path)) : [...current, path] });
  }

  async function restore() {
    setError("");
    try {
      const result = await restoreLaunchApps();
      setRestoreCount(result.restorableCount);
      if (result.failures?.length) setError(result.failures.join(" • "));
    } catch (failure) { setError(String(failure)); }
  }

  const visible = sortLaunchProcessesByVram(processes.filter((row) => `${row.name} ${row.path}`.toLowerCase().includes(search.toLowerCase()))).slice(0, 75);

  return <div className="space-y-5 py-4">
    <p className="text-sm text-white/55">Choose apps to offer for closing before any game launch. These controls are off by default and never end a process without confirmation.</p>
    <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-3 text-sm text-white/80"><span>Enable app-wide cleanup review</span><input type="checkbox" checked={settings.launchCleanupEnabled} onChange={(event) => change({ launchCleanupEnabled: event.target.checked })} className="accent-cyan-400" /></label>
    <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-3 text-sm text-white/80"><span>Show pre-launch VRAM and RAM review</span><input type="checkbox" checked={settings.preLaunchMemoryReview} onChange={(event) => change({ preLaunchMemoryReview: event.target.checked })} className="accent-cyan-400" /></label>
    <p className="text-xs text-white/45">VRAM readings vary by GPU driver. RAM is the process working set and may include shared pages. Closing an app may not free all displayed memory; unavailable readings show “Not reported.”</p>
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white/80">App-wide cleanup list</h3><button type="button" onClick={refresh} disabled={loading} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 disabled:opacity-40">{loading ? "Refreshing…" : "Refresh running apps"}</button></div>
    {settings.launchCleanupPaths.length ? <div className="space-y-1">{settings.launchCleanupPaths.map((path) => <div key={path} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate text-white/65" title={path}>{path}</span><button type="button" onClick={() => togglePath(path)} className="text-red-200/80 hover:text-red-100">Remove</button></div>)}</div> : <p className="text-xs text-white/40">No apps selected yet. Pick a running app below.</p>}
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a running app" aria-label="Find a running app" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" />
    <p className="text-xs text-white/45">Sorted by dedicated VRAM, highest first. Unreported readings appear last.</p>
    <div className="max-h-72 overflow-y-auto rounded-lg border border-white/10">{visible.map((row) => {
      const added = settings.launchCleanupPaths.some((path) => pathKey(path) === pathKey(row.path));
      return <div key={`${row.pid}-${row.startedAt}`} className="flex items-center gap-3 border-b border-white/[0.06] p-2 last:border-0"><div className="min-w-0 flex-1"><div className="truncate text-xs text-white/80">{row.name} <span className="text-white/35">· {row.gpuLabel ?? "GPU unknown"}: {bytesLabel(row.dedicatedBytes)} VRAM · {bytesLabel(row.ramBytes)} RAM</span></div><div className="truncate text-[11px] text-white/40" title={row.path}>{row.path}</div></div><button type="button" onClick={() => togglePath(row.path)} className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-cyan-200/80">{added ? "Remove" : "Add"}</button></div>;
    })}</div>
    <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={restore} disabled={restoreCount === 0} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 disabled:opacity-40">Reopen apps closed by GameAtlas ({restoreCount})</button><span className="text-xs text-white/40">Restoration is available during this GameAtlas session and may not recreate an app’s prior state.</span></div>
    {error ? <p className="text-xs text-red-200" role="alert">{error}</p> : null}
  </div>;
}
