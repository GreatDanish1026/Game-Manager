import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, Plus, X } from "lucide-react";
import { addManualGame } from "../services/manualGames";

function dirname(path) {
  const normalized = String(path ?? "").replaceAll("/", "\\");
  const index = normalized.lastIndexOf("\\");
  return index > 0 ? normalized.slice(0, index) : "";
}

function stem(path) {
  const file = String(path ?? "").replaceAll("/", "\\").split("\\").pop() ?? "";
  return file.replace(/\.(exe|bat|cmd)$/i, "").replace(/[_-]+/g, " ").trim();
}

export default function AddGameModal({ open, onClose }) {
  const [name, setName] = useState("");
  const [executablePath, setExecutablePath] = useState("");
  const [installPath, setInstallPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setExecutablePath("");
    setInstallPath("");
    setBusy(false);
    setError(null);
  }, [open]);

  const canSave = useMemo(() => name.trim() && executablePath.trim() && !busy, [name, executablePath, busy]);

  if (!open) return null;

  async function browseExecutable() {
    setError(null);
    try {
      const result = await invoke("pick_manual_game_executable");
      if (!result?.path) return;
      setExecutablePath(result.path);
      setInstallPath(result.installPath ?? dirname(result.path));
      if (!name.trim()) setName(result.suggestedName ?? stem(result.path));
    } catch (e) {
      setError(String(e));
    }
  }

  function save() {
    try {
      setBusy(true);
      setError(null);
      addManualGame({ name, executablePath, installPath: installPath || dirname(executablePath) });
      onClose();
    } catch (e) {
      setBusy(false);
      setError(String(e));
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111722] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <div className="text-base font-bold text-white">Add Game</div>
            <div className="mt-1 text-xs text-white/40">Add an installed game that GameAtlas did not discover automatically.</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-5">
          <label className="block">
            <div className="mb-1.5 text-xs font-semibold text-white/55">Game name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Example Game" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-cyan-400/35" />
          </label>

          <label className="block">
            <div className="mb-1.5 text-xs font-semibold text-white/55">Executable</div>
            <div className="flex gap-2">
              <input value={executablePath} onChange={(e) => { const value = e.target.value; setExecutablePath(value); if (!installPath) setInstallPath(dirname(value)); }} placeholder="C:\\Games\\Example\\Example.exe" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-cyan-400/35" />
              <button type="button" onClick={browseExecutable} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm font-semibold text-white/65 transition hover:bg-white/[0.07] hover:text-white"><FolderOpen className="h-4 w-4" />Browse</button>
            </div>
          </label>

          <label className="block">
            <div className="mb-1.5 text-xs font-semibold text-white/55">Install folder</div>
            <input value={installPath} onChange={(e) => setInstallPath(e.target.value)} placeholder="Filled from the executable automatically" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-cyan-400/35" />
          </label>

          <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.045] px-3 py-2.5 text-xs leading-relaxed text-cyan-100/60">PCGamingWiki, mod compatibility, local inspection, launch profiles, tags, favorites, and other GameAtlas features will use this entry the same way they use launcher-discovered games whenever the required local data is available.</div>

          {error ? <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-xs text-red-200/80">{error}</div> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/55 transition hover:bg-white/[0.05]">Cancel</button>
          <button type="button" onClick={save} disabled={!canSave} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.10] px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/[0.16] disabled:cursor-not-allowed disabled:opacity-35"><Plus className="h-4 w-4" />Add Game</button>
        </div>
      </div>
    </div>
  );
}
