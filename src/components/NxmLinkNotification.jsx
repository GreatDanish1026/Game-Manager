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
  selectedGame,
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

  const eligibleGames = useMemo(
    () => (games ?? []).filter((game) => game?.installPath),
    [games]
  );

  useEffect(
    () => {
      let active = true;
      let stopListening = null;

      async function refresh() {
        let nxmUrl = null;
        try {
          const links = await getPendingNxmLinks();
          nxmUrl = links?.[0];
          if (!active) {
            return;
          }
          if (!nxmUrl) {
            setPending(null);
            return;
          }
          const info = await inspectNxmLink(nxmUrl);
          if (active) {
            if (document.getElementById("gameatlas-nexus-integration")) {
              setPending(null);
              return;
            }
            setPending({
              nxmUrl,
              info,
            });
            setError(null);
          }
        } catch (loadError) {
          if (nxmUrl) {
            await dismissNxmLink(nxmUrl).catch(() => {});
          }
          if (active) {
            setError(`${String(loadError)} The invalid or expired link was discarded.`);
          }
        }
      }

      listen(
        "gameatlas:nxm-link",
        refresh
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
      refresh();

      return () => {
        active = false;
        stopListening?.();
      };
    },
    []
  );

  useEffect(
    () => {
      if (!pending || targetId) {
        return;
      }
      const domain = normalized(pending.info.gameDomain);
      const matched = eligibleGames.find(
        (game) => normalized(game.name) === domain
      );
      setTargetId(
        String(
          matched?.id
          ?? selectedGame?.id
          ?? eligibleGames[0]?.id
          ?? ""
        )
      );
    },
    [
      pending?.nxmUrl,
      targetId,
      selectedGame?.id,
      eligibleGames,
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

  if (!pending && !error) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[120] w-[min(28rem,calc(100vw-2.5rem))] rounded-xl border border-violet-300/20 bg-[#111621]/95 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200/70">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white/75">
            Nexus download received
          </div>
          {pending ? (
            <div className="mt-1 text-[11px] leading-relaxed text-white/38">
              {pending.info.gameDomain} · mod {pending.info.modId} · file {pending.info.fileId}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={pending ? dismiss : () => setError(null)}
          aria-label={pending ? "Dismiss Nexus download" : "Dismiss Nexus error"}
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
          <div className="mt-2 text-[10px] leading-relaxed text-amber-100/45">
            Confirm the destination game. Nexus domain names do not always match installed-game names exactly.
          </div>
          <button
            type="button"
            onClick={continueToGame}
            disabled={!targetId}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-300/20 bg-violet-300/[0.07] px-3 py-2 text-xs font-semibold text-violet-100/70 hover:bg-violet-300/[0.11] disabled:opacity-35"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open GameAtlas mod manager
          </button>
        </>
      ) : null}
    </div>
  );
}
