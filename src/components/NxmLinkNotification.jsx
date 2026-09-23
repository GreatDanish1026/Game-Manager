import {
  Download,
  ExternalLink,
  X,
} from "lucide-react";
import {
  listen,
} from "@tauri-apps/api/event";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  dismissNxmLink,
  getPendingNxmLinks,
  inspectNxmLink,
} from "../services/nexusIntegration";


function normalized(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}


export default function NxmLinkNotification({
  games,
  onSelectGame,
}) {
  const [
    pending,
    setPending,
  ] = useState(null);
  const [
    targetId,
    setTargetId,
  ] = useState("");
  const [
    error,
    setError,
  ] = useState(null);
  const [
    queueRevision,
    setQueueRevision,
  ] = useState(0);
  const [
    queueMessage,
    setQueueMessage,
  ] = useState(null);

  const eligibleGames = useMemo(
    () => (games ?? []).filter((game) => game?.installPath),
    [games]
  );

  useEffect(
    () => {
      let active = true;
      let stopListening = null;
      let stopErrorListening = null;

      listen(
        "gameatlas:nxm-link",
        () => setQueueRevision(
          (current) => current + 1
        )
      )
        .then(
          (unlisten) => {
            if (active) {
              stopListening = unlisten;
            } else {
              unlisten();
            }
          }
        )
        .catch(
          (listenError) => {
            if (active) {
              setError(String(listenError));
            }
          }
        );
      listen(
        "gameatlas:nxm-link-error",
        (event) => {
          if (
            active
            && !document.getElementById("gameatlas-nexus-integration")
          ) {
            setError(String(event.payload));
          }
        }
      )
        .then(
          (unlisten) => {
            if (active) {
              stopErrorListening = unlisten;
            } else {
              unlisten();
            }
          }
        )
        .catch(
          (listenError) => {
            if (active) {
              setError(String(listenError));
            }
          }
        );
      function handleQueueChange() {
        setQueueRevision(
          (current) => current + 1
        );
      }
      window.addEventListener(
        "gameatlas:nxm-queue-changed",
        handleQueueChange
      );

      return () => {
        active = false;
        stopListening?.();
        stopErrorListening?.();
        window.removeEventListener(
          "gameatlas:nxm-queue-changed",
          handleQueueChange
        );
      };
    },
    []
  );

  useEffect(
    () => {
      let active = true;

      async function loadPendingLink() {
        let discardedCount = 0;
        let lastDiscardedError = null;
        try {
          while (active) {
            const links = await getPendingNxmLinks();
            if (!active) {
              return;
            }
            if (document.getElementById("gameatlas-nexus-integration")) {
              setPending(null);
              setQueueMessage(null);
              setError(null);
              return;
            }
            const nxmUrl = links?.[0];
            if (!nxmUrl) {
              setPending(null);
              setQueueMessage(
                discardedCount > 0
                  ? `${discardedCount} invalid or expired Nexus request${discardedCount === 1 ? " was" : "s were"} discarded${lastDiscardedError ? `: ${lastDiscardedError}` : "."}`
                  : null
              );
              return;
            }
            try {
              const info = await inspectNxmLink(nxmUrl);
              if (!active) {
                return;
              }
              setPending({
                nxmUrl,
                info,
                queueCount: links.length,
              });
              setQueueMessage(
                discardedCount > 0
                  ? `${discardedCount} invalid or expired Nexus request${discardedCount === 1 ? " was" : "s were"} discarded. Showing the next request.`
                  : null
              );
              setError(null);
              return;
            } catch (loadError) {
              lastDiscardedError = String(loadError);
              await dismissNxmLink(nxmUrl);
              discardedCount += 1;
            }
          }
        } catch (loadError) {
          if (active) {
            setError(String(loadError));
          }
        }
      }

      loadPendingLink();
      return () => {
        active = false;
      };
    },
    [queueRevision]
  );

  useEffect(
    () => {
      if (!pending) {
        setTargetId("");
        return;
      }
      const domain = normalized(pending.info.gameDomain);
      const matches = eligibleGames.filter(
        (game) => normalized(game.name) === domain
      );
      setTargetId(
        matches.length === 1
          ? String(matches[0].id)
          : ""
      );
    },
    [
      pending?.nxmUrl,
      eligibleGames,
    ]
  );


  useEffect(
    () => {
      const expiresUnix = Number(
        pending?.info.expiresUnix
      );
      if (!Number.isFinite(expiresUnix) || expiresUnix <= 0) {
        return undefined;
      }
      const delay = Math.min(
        Math.max(
          (expiresUnix * 1000) - Date.now() + 250,
          0
        ),
        2_147_000_000
      );
      const timer = window.setTimeout(
        () => setQueueRevision(
          (current) => current + 1
        ),
        delay
      );
      return () => window.clearTimeout(timer);
    },
    [
      pending?.nxmUrl,
      pending?.info.expiresUnix,
    ]
  );


  async function dismiss() {
    if (!pending) {
      return;
    }
    try {
      await dismissNxmLink(pending.nxmUrl);
      setPending(null);
      setTargetId("");
      setError(null);
      window.dispatchEvent(
        new CustomEvent("gameatlas:nxm-queue-changed")
      );
    } catch (dismissError) {
      setError(String(dismissError));
    }
  }

  function continueToGame() {
    const target = eligibleGames.find(
      (game) => String(game.id) === targetId
    );
    if (!target) {
      setError("Select an installed game before continuing.");
      return;
    }
    try {
      localStorage.setItem(
        "game-manager-section-mods",
        "true"
      );
    } catch {
      // Section preference is optional; the event below still opens it.
    }
    onSelectGame?.(target);
    window.setTimeout(
      () => {
        window.dispatchEvent(
          new CustomEvent(
            "game-manager-open-section",
            {
              detail: {
                id: "mods",
              },
            }
          )
        );
        document
          .getElementById("game-section-mods")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      },
      250
    );
    setPending(null);
    setTargetId("");
  }

  if (!pending && !error && !queueMessage) {
    return null;
  }

  const targetGame = eligibleGames.find(
    (game) => String(game.id) === targetId
  );
  const targetMatchesDomain = Boolean(
    targetGame
    && normalized(targetGame.name) === normalized(pending?.info.gameDomain)
  );

  return (
    <div className="fixed bottom-5 right-5 z-[120] w-[min(28rem,calc(100vw-2.5rem))] rounded-xl border border-violet-300/20 bg-[#111621]/95 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200/70">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white/75">
            <span>{pending ? "Nexus download received" : "Nexus queue updated"}</span>
            {pending ? (
              <span className="rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-wide text-violet-100/55">
                {pending.queueCount > 1
                  ? `1 of ${pending.queueCount} pending`
                  : "1 pending"
                }
              </span>
            ) : null}
          </div>
          {pending ? (
            <div className="mt-1 text-[11px] leading-relaxed text-white/38">
              {pending.info.gameDomain} · mod {pending.info.modId} · file {pending.info.fileId}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={
            pending
              ? dismiss
              : () => {
                  setError(null);
                  setQueueMessage(null);
                }
          }
          aria-label={pending ? "Dismiss Nexus download" : "Dismiss Nexus message"}
          className="rounded-md p-1.5 text-white/35 hover:bg-white/[0.06] hover:text-white/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-md border border-red-400/10 bg-red-400/[0.04] px-2.5 py-2 text-[10px] leading-relaxed text-red-100/65">
          {error}
        </div>
      ) : null}

      {queueMessage ? (
        <div className="mt-3 rounded-md border border-amber-300/12 bg-amber-300/[0.04] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100/60">
          {queueMessage}
        </div>
      ) : null}

      {pending ? (
        <>
          <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-white/30">
            Stage for game
          </label>
          <select
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/65 outline-none focus:border-violet-300/25"
          >
            <option value="">Select an installed game</option>
            {eligibleGames.map((game) => (
              <option key={game.id} value={String(game.id)}>
                {game.name}
              </option>
            ))}
          </select>
          <div className={`mt-2 text-[10px] leading-relaxed ${targetMatchesDomain ? "text-emerald-100/50" : "text-amber-100/55"}`}>
            {targetMatchesDomain
              ? `Matched the Nexus domain to ${targetGame.name}. Confirm this destination before continuing.`
              : targetGame
                ? `You selected ${targetGame.name}, but its name does not exactly match the Nexus domain “${pending.info.gameDomain}”. Confirm that this is the intended game.`
                : "GameAtlas could not confidently match this Nexus domain to one installed game. Select the destination explicitly to continue."
            }
          </div>
          <button
            type="button"
            onClick={continueToGame}
            disabled={!targetId}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-300/20 bg-violet-300/[0.07] px-3 py-2 text-xs font-semibold text-violet-100/70 hover:bg-violet-300/[0.11] disabled:opacity-35"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {targetGame
              ? `Continue with ${targetGame.name}`
              : "Select a destination game"
            }
          </button>
        </>
      ) : null}
    </div>
  );
}
