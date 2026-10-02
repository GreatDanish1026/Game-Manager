import { useEffect, useMemo, useState } from "react";
import { closeLaunchProcesses, getLaunchProcesses, sortLaunchProcessesByVram } from "../services/launchCleanup";

const formatMemory = (bytes) => bytes == null ? "Not reported" : `${(bytes / 1048576).toFixed(0)} MiB`;
const samePath = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();

export default function PreLaunchReview({ request, onFinish }) {
  const [processes, setProcesses] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [force, setForce] = useState(false);
  const [closedCount, setClosedCount] = useState(0);
  const [refreshId, setRefreshId] = useState(0);

  useEffect(() => {
    let active = true;
    getLaunchProcesses().then((items) => {
      if (!active) return;
      const rows = Array.isArray(items) ? items : [];
      const preset = rows.filter((row) => request.settings.launchCleanupPaths.some((path) => samePath(path, row.path)));
      setProcesses(rows);
      setSelected((current) => refreshId === 0
        ? (request.settings.launchCleanupEnabled ? preset.map((row) => row.pid) : [])
        : current.filter((pid) => rows.some((row) => row.pid === pid)));
      setLoading(false);
      if (!request.settings.preLaunchMemoryReview && preset.length === 0) onFinish(true);
    }).catch((failure) => {
      if (!active) return;
      setError(`Process review is unavailable: ${String(failure)}`);
      setLoading(false);
    });
    return () => { active = false; };
  }, [request, onFinish, refreshId]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortLaunchProcessesByVram(processes
      .filter((row) => !term || row.name.toLowerCase().includes(term) || row.path.toLowerCase().includes(term)))
      .slice(0, 75);
  }, [processes, search]);

  async function closeAndLaunch() {
    setClosing(true);
    setError("");
    try {
      const targets = processes.filter((row) => selected.includes(row.pid)).map((row) => ({
        pid: row.pid, path: row.path, startedAt: row.startedAt, force,
      }));
      const result = await closeLaunchProcesses(targets);
      if (result.restorableCount > 0) window.dispatchEvent(new CustomEvent("gameatlas-launch-apps-closed", { detail: { count: result.restorableCount } }));
      setClosedCount((result.stopped ?? []).length);
      if (result.failures?.length) {
        setError(`Some apps could not be closed: ${result.failures.join(" • ")}. You can launch anyway or cancel.`);
      } else {
        onFinish(true);
      }
    } catch (failure) {
      setError(`Could not close the selected apps: ${String(failure)}`);
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="prelaunch-title">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-cyan-400/20 bg-[#111923] p-5 shadow-2xl">
        <h2 id="prelaunch-title" className="text-lg font-semibold text-white">Before launching {request.gameName}</h2>
        <p className="mt-1 text-sm text-white/60">Review running apps. VRAM and RAM are estimates; closing an app may not free the full amounts shown.</p>
        <p className="mt-1 text-xs text-white/40">Your app-wide cleanup list is preselected. Nothing closes until you choose “Close selected & launch.” Apps can be reopened during this GameAtlas session, but their prior state may not be restored.</p>

        <div className="mt-4 flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter running apps" aria-label="Filter running apps" /><button type="button" onClick={() => { setLoading(true); setRefreshId((value) => value + 1); }} disabled={loading || closing} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 disabled:opacity-40">Refresh</button></div>
        <p className="mt-2 text-xs text-white/45">Sorted by dedicated VRAM, highest first. Unreported readings appear last.</p>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10">
          {loading ? <p className="p-4 text-sm text-white/55">Checking running apps and GPU memory…</p> : rows.length === 0 ? <p className="p-4 text-sm text-white/55">No matching user apps found. You can launch without closing anything.</p> : rows.map((row) => (
            <label key={`${row.pid}-${row.startedAt}`} className="flex cursor-pointer items-center gap-3 border-b border-white/[0.06] px-3 py-2 last:border-0 hover:bg-white/[0.04]">
              <input type="checkbox" checked={selected.includes(row.pid)} onChange={() => setSelected((current) => current.includes(row.pid) ? current.filter((pid) => pid !== row.pid) : [...current, row.pid])} className="accent-cyan-400" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm text-white/85">{row.name}</span><span className="block truncate text-[11px] text-white/40" title={row.path}>{row.path}</span></span>
              <span className="shrink-0 text-right text-xs text-white/60"><span className="block text-white/40">{row.gpuLabel ?? "GPU not identified"}</span><span className="block">VRAM: {formatMemory(row.dedicatedBytes)}</span><span className="block text-white/40">Shared GPU: {formatMemory(row.sharedBytes)}</span><span className="block">RAM: {formatMemory(row.ramBytes)}</span></span>
            </label>
          ))}
        </div>
        {processes.length > 75 && !search ? <p className="mt-1 text-xs text-white/40">Showing the first 75 apps; use the filter to find others.</p> : null}
        <label className="mt-3 flex items-center gap-2 text-xs text-amber-200/75"><input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} className="accent-amber-400" />Force-close selected apps instead of requesting a normal close. Unsaved work may be lost.</label>
        {closedCount > 0 ? <p className="mt-2 text-xs text-emerald-300/75">{closedCount} app(s) closed. You can reopen them from Settings → Launch.</p> : null}
        {error ? <p className="mt-2 text-sm text-red-200" role="alert">{error}</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => onFinish(false)} disabled={closing} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 disabled:opacity-40">Cancel launch</button>
          <button type="button" onClick={() => onFinish(true)} disabled={closing || loading} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 disabled:opacity-40">Launch without closing</button>
          <button type="button" onClick={closeAndLaunch} disabled={closing || loading || selected.length === 0} className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40">{closing ? "Closing apps…" : `Close ${selected.length} selected & launch`}</button>
        </div>
      </div>
    </div>
  );
}
