import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  invoke,
} from "@tauri-apps/api/core";

import {
  CheckCircle2,
  FilePenLine,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";


const BUTTON_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/65 transition hover:bg-white/10 hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-35";


function gameArguments(value) {
  const current =
    String(value ?? "").trim();
  const marker = "%command%";
  const index =
    current.indexOf(marker);

  if (index >= 0) {
    return current
      .slice(index + marker.length)
      .trim();
  }

  return current.startsWith("-")
    ? current
    : "";
}


function inspectDraft(value) {
  const draft = String(value ?? "");
  const placeholderCount =
    draft.match(/%command%/gi)?.length
    ?? 0;
  const warnings = [];
  const blockers = [];

  if (/\r|\n/.test(draft)) {
    blockers.push("Steam launch options must be a single line.");
  }

  if (draft.length > 32768) {
    blockers.push("Launch options exceed the GameAtlas safety limit.");
  }

  if (
    draft
    && placeholderCount === 0
    && /(^|\s)(?:[A-Z_][A-Z0-9_]*=\S+\s+|mangohud\s+|gamemoderun\s+|gamescope\s+)/i.test(draft)
  ) {
    warnings.push("A wrapper or environment option was detected without %command%; the game may not launch through it.");
  }

  if (placeholderCount > 1) {
    warnings.push("%command% appears more than once. Steam may try to launch the game multiple times.");
  }

  if (/\s(?:&&|\|\||;|\|)\s/.test(draft)) {
    warnings.push("Shell operators are present. Review the command carefully before saving.");
  }

  return {
    blockers,
    warnings,
  };
}


function CommandCard({
  label,
  value,
  generated = false,
}) {
  return (
    <div className={`rounded-lg border p-3 ${generated ? "border-cyan-400/10 bg-cyan-500/[0.025]" : "border-white/[0.07] bg-black/10"}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-wide ${generated ? "text-cyan-100/40" : "text-white/30"}`}>
        {label}
      </div>
      <div className={`mt-2 break-all font-mono text-xs leading-relaxed ${generated ? "text-cyan-100/65" : "text-white/55"}`}>
        {value || "No launch options stored"}
      </div>
    </div>
  );
}


export default function SteamLaunchOptionsEditor({
  appId,
  installPath,
  launchOptions,
}) {
  const [state, setState] = useState(null);
  const [accountId, setAccountId] = useState("");
  const [draft, setDraft] = useState(launchOptions);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(null);
  const generation = useRef(0);
  const active = useRef(true);

  async function load(preferred = "") {
    const request = ++generation.current;
    setBusy(true);
    setError("");

    try {
      const result = await invoke(
        "get_steam_launch_options",
        {
          appId,
          installPath,
        }
      );

      if (!active.current || request !== generation.current) {
        return;
      }

      const selectedId = result.accounts.some((item) => item.id === preferred)
        ? preferred
        : result.accounts.length === 1
          ? result.accounts[0].id
          : "";
      const selected = result.accounts.find((item) => item.id === selectedId);

      setState(result);
      setAccountId(selectedId);
      setDraft(selected?.current || launchOptions);
      setDirty(false);
      setReview(null);
    } catch (loadError) {
      if (active.current && request === generation.current) {
        setState(null);
        setError(String(loadError));
      }
    } finally {
      if (active.current && request === generation.current) {
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    active.current = true;
    load();

    return () => {
      active.current = false;
      generation.current += 1;
    };
  }, []);

  const account = state?.accounts.find((item) => item.id === accountId);
  const stored = account?.current ?? "";
  const preservedArguments = gameArguments(stored);
  const inspection = useMemo(() => inspectDraft(draft), [draft]);
  const writeBlocked = busy
    || !account
    || Boolean(state?.writeBlockReason)
    || state?.running;
  const hasChanges = Boolean(account) && draft !== stored;

  useEffect(() => {
    if (!dirty && (!account || !stored)) {
      setDraft(launchOptions);
    }
  }, [account, dirty, launchOptions, stored]);

  function chooseAccount(id) {
    const selected = state?.accounts.find((item) => item.id === id);
    setAccountId(id);
    setDraft(selected?.current || launchOptions);
    setDirty(false);
    setReview(null);
    setMessage("");
    setError("");
  }

  function replaceDraft(value) {
    setDraft(value);
    setDirty(true);
    setReview(null);
    setMessage("");
  }

  function requestReview(value, type) {
    if (writeBlocked) {
      return;
    }

    const result = inspectDraft(value);

    if (result.blockers.length > 0) {
      setError(result.blockers.join(" "));
      return;
    }

    setError("");
    setMessage("");
    setReview({
      type,
      value,
    });
  }

  async function write(value) {
    if (writeBlocked) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await invoke(
        "set_steam_launch_options",
        {
          appId,
          installPath,
          accountId,
          expected: account.current,
          value,
        }
      );

      if (!active.current) {
        return;
      }

      const outcome = value === ""
        ? "Steam launch options cleared."
        : "Launch options saved to Steam.";

      setMessage(
        result.backupPath
          ? `${outcome} Backup: ${result.backupPath}`
          : `${outcome} No file change was needed.`
      );
      setReview(null);
      await load(accountId);
    } catch (writeError) {
      if (active.current) {
        setError(String(writeError));
        setReview(null);
        setBusy(false);
      }
    }
  }

  return (
    <section className="mt-4 space-y-3 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white/75">
            <FilePenLine className="h-4 w-4 text-cyan-300/80" />
            Steam launch-option editor
          </div>
          <div className="mt-1 text-[11px] text-white/35">
            App ID {appId} · Review changes before writing. GameAtlas backs up Steam configuration automatically.
          </div>
        </div>

        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={busy}
          onClick={() => {
            setMessage("");
            load(accountId);
          }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <label className="block text-xs text-white/60">
        Steam account
        <select
          className="mt-1 block w-full rounded-lg border border-white/10 bg-[#101722] p-2 text-white/80 [color-scheme:dark]"
          value={accountId}
          disabled={busy || !state}
          onChange={(event) => chooseAccount(event.target.value)}
        >
          <option value="">Select an account</option>
          {state?.accounts.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>

      {account ? (
        <>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <CommandCard label="Currently stored in Steam" value={stored} />
            <CommandCard label="Generated by GameAtlas" value={launchOptions} generated />
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-black/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={`steam-launch-draft-${appId}`} className="text-xs font-semibold text-white/65">
                Draft to save
              </label>
              <span className={`text-[10px] ${hasChanges ? "text-amber-200/60" : "text-white/25"}`}>
                {hasChanges ? "Unsaved changes" : "Matches Steam"}
              </span>
            </div>

            <textarea
              id={`steam-launch-draft-${appId}`}
              rows={4}
              value={draft}
              onChange={(event) => replaceDraft(event.target.value)}
              spellCheck={false}
              className="mt-2 w-full resize-y rounded-lg border border-white/[0.09] bg-[#0b1018] px-3 py-2.5 font-mono text-xs leading-relaxed text-white/75 outline-none transition focus:border-cyan-400/30"
            />

            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={BUTTON_CLASS} onClick={() => replaceDraft(launchOptions)}>
                <Sparkles className="h-3.5 w-3.5" />
                Use Generated
              </button>

              {preservedArguments ? (
                <button
                  type="button"
                  className={BUTTON_CLASS}
                  onClick={() => replaceDraft(`${launchOptions} ${preservedArguments}`)}
                  title={`Preserve: ${preservedArguments}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Generated + Game Arguments
                </button>
              ) : null}

              <button type="button" className={BUTTON_CLASS} onClick={() => replaceDraft(stored)}>
                <RotateCcw className="h-3.5 w-3.5" />
                Revert Draft
              </button>
            </div>
          </div>

          {inspection.blockers.length > 0 ? (
            <div role="alert" className="rounded-lg border border-red-400/15 bg-red-400/[0.04] px-3 py-2 text-xs text-red-100/70">
              {inspection.blockers.join(" ")}
            </div>
          ) : null}

          {inspection.warnings.length > 0 ? (
            <div className="space-y-1 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2">
              {inspection.warnings.map((warning) => (
                <div key={warning} className="flex items-start gap-2 text-xs leading-relaxed text-amber-100/65">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {warning}
                </div>
              ))}
            </div>
          ) : null}

          {state?.writeBlockReason ? (
            <p role="status" className="text-xs text-amber-200/75">{state.writeBlockReason}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={writeBlocked || !hasChanges || inspection.blockers.length > 0}
              onClick={() => requestReview(draft, "save")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100/75 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <FilePenLine className="h-3.5 w-3.5" />
              Review Save
            </button>

            <button
              type="button"
              className={BUTTON_CLASS}
              disabled={writeBlocked || stored === ""}
              onClick={() => requestReview("", "clear")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Review Clear
            </button>
          </div>

          {review ? (
            <div className={`rounded-xl border p-3 ${review.type === "clear" ? "border-red-400/20 bg-red-400/[0.04]" : "border-amber-400/20 bg-amber-400/[0.04]"}`}>
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  <div className="text-xs font-semibold text-white/75">
                    {review.type === "clear" ? "Confirm clearing Steam launch options" : "Confirm replacing Steam launch options"}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-white/40">
                    This changes only the selected account. Steam must be closed; stale data is rejected and an exact backup is created before writing.
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                <CommandCard label="Before" value={stored || "Empty"} />
                <CommandCard label="After" value={review.value || "Empty"} generated />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => write(review.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-35 ${review.type === "clear" ? "border-red-400/20 bg-red-400/[0.07] text-red-100/75 hover:bg-red-400/[0.12]" : "border-cyan-400/20 bg-cyan-500/10 text-cyan-100/75 hover:bg-cyan-500/15"}`}
                >
                  {busy ? "Working…" : review.type === "clear" ? "Confirm Clear" : "Confirm Save"}
                </button>
                <button type="button" disabled={busy} onClick={() => setReview(null)} className={BUTTON_CLASS}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <p role="alert" className="break-all text-xs text-red-200/80">{error}</p> : null}
      {message ? <p role="status" className="break-all text-xs text-emerald-200/80">{message}</p> : null}
    </section>
  );
}
