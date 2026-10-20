import {
  Archive,
  HeartPulse,
  Puzzle,
  TriangleAlert,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getInstallationHealthRecords,
  healthGameKey,
} from "../services/installationHealth";
import { getSaveBackupStatus } from "../services/saveBackups";
import { getPcgwKnownIssues } from "../services/pcgwKnownIssues";
import { openGameSection } from "../services/gameSections";
import { formatRelativeDay } from "../services/relativeTime";


const TONES = {
  good: "bg-emerald-400",
  warning: "bg-amber-400",
  bad: "bg-red-400",
  neutral: "bg-white/25",
};


function StatusItem({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-start gap-3 rounded-xl border border-white/[0.08] bg-black/25 p-3 text-left backdrop-blur-sm transition hover:border-cyan-300/25 hover:bg-black/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300/70" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/40">{label}</span>
        <span className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-white/85">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONES[tone]}`} aria-hidden="true" />
          <span className="truncate">{value}</span>
        </span>
        {detail ? <span className="mt-0.5 block truncate text-xs text-white/45">{detail}</span> : null}
      </span>
    </button>
  );
}


function useWindowEvent(name, handler) {
  useEffect(() => {
    window.addEventListener(name, handler);
    return () => window.removeEventListener(name, handler);
  }, [name, handler]);
}


function useHealthRecord(game) {
  const read = () => getInstallationHealthRecords()[healthGameKey(game)] ?? null;
  const [record, setRecord] = useState(read);
  const [refresh] = useState(() => () => setRecord(read()));

  useEffect(() => setRecord(read()), [game?.id]);
  useWindowEvent("game-manager-installation-health-changed", refresh);
  return record;
}


function useBackupStatus(game) {
  const [state, setState] = useState({ loading: true });
  const [revision, setRevision] = useState(0);
  const [refresh] = useState(() => () => setRevision((value) => value + 1));
  const saveLocation = game?.technical?.saveLocation;

  useWindowEvent("game-manager-save-backups-changed", refresh);

  useEffect(() => {
    if (!saveLocation) {
      setState({ loading: false, unknown: true });
      return undefined;
    }

    let cancelled = false;
    getSaveBackupStatus(game)
      .then((status) => {
        if (cancelled) return;
        const latest = Math.max(0, ...(status?.backups ?? []).map((backup) => Number(backup.createdUnix) || 0));
        setState({ loading: false, count: status?.backupCount ?? 0, latest: latest > 0 ? new Date(latest * 1000) : null });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, error: true });
      });

    return () => { cancelled = true; };
  }, [game?.id, saveLocation, revision]);

  return state;
}


// PCGamingWiki issue sections are free-form HTML; each issue is normally its
// own heading, so headings are a reasonable count.
function countIssues(html) {
  if (!html?.trim()) return 0;
  const document = new DOMParser().parseFromString(html, "text/html");
  return document.querySelectorAll("h2, h3, h4, h5").length;
}


function useKnownIssues(game, networkOnline) {
  const [state, setState] = useState({ loading: true });
  const pageName = game?.pcgwPageName;

  useEffect(() => {
    if (!pageName) {
      setState({ loading: false, none: true });
      return undefined;
    }

    let cancelled = false;
    setState({ loading: true });
    getPcgwKnownIssues(pageName)
      .then((data) => {
        if (cancelled) return;
        const listed = Boolean(data?.unresolvedHtml?.trim());
        setState({ loading: false, listed, count: countIssues(data?.unresolvedHtml) });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, error: true });
      });

    return () => { cancelled = true; };
  }, [pageName, networkOnline]);

  return state;
}


function healthItem(record) {
  if (!record) {
    return { value: "Not checked", detail: "Run a health check", tone: "neutral" };
  }

  const toReview = Number(record.actionable) || Number(record.warnings) || 0;
  const tone = { excellent: "good", good: "good", "needs-attention": "warning", incomplete: "bad" }[record.category] ?? "neutral";

  return {
    value: `${record.score}%`,
    detail: toReview > 0 ? `${toReview} ${toReview === 1 ? "item" : "items"} to review` : "No issues found",
    tone,
  };
}


function backupItem(state) {
  if (state.loading) return { value: "Checking…", tone: "neutral" };
  if (state.unknown) return { value: "Not available", detail: "No save location detected", tone: "neutral" };
  if (state.error) return { value: "Unavailable", detail: "Could not read backups", tone: "neutral" };
  if (!state.count) return { value: "No backups yet", detail: "Back up before modding", tone: "warning" };

  return {
    value: state.latest ? `Last ${formatRelativeDay(state.latest)}` : `${state.count} saved`,
    detail: `${state.count} ${state.count === 1 ? "backup" : "backups"}`,
    tone: "good",
  };
}


function issuesItem(state) {
  if (state.loading) return { value: "Checking…", tone: "neutral" };
  if (state.none) return { value: "No PCGamingWiki page", tone: "neutral" };
  if (state.error) return { value: "Unavailable", detail: "PCGamingWiki could not be reached", tone: "neutral" };
  if (!state.listed) return { value: "None listed", detail: "From PCGamingWiki", tone: "good" };

  return {
    value: state.count > 0 ? `${state.count} unresolved` : "Issues listed",
    detail: "Fixes and workarounds on PCGamingWiki",
    tone: "warning",
  };
}


function modsItem(game) {
  const available = [
    game?.renodx?.renodx?.available ? "RenoDX" : null,
    game?.renodx?.luma?.available ? "Luma" : null,
    game?.vortex?.supported ? "Vortex" : null,
    game?.fluffy?.supported ? "Fluffy" : null,
  ].filter(Boolean);

  return available.length > 0
    ? { value: available.join(", "), detail: "Known enhancements", tone: "good" }
    : { value: "None known", detail: "Local mods and tools", tone: "neutral" };
}


export default function GameStatusRow({
  game,
  networkOnline = true,
}) {
  const health = healthItem(useHealthRecord(game));
  const backups = backupItem(useBackupStatus(game));
  const issues = issuesItem(useKnownIssues(game, networkOnline));
  const mods = modsItem(game);

  return (
    <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <StatusItem
        icon={HeartPulse}
        label="Health"
        {...health}
        onClick={() => openGameSection("compatibility-performance", "game-health-check")}
      />
      <StatusItem
        icon={Archive}
        label="Save backups"
        {...backups}
        onClick={() => openGameSection("saves-screenshots", "game-save-backups")}
      />
      <StatusItem
        icon={TriangleAlert}
        label="Known issues"
        {...issues}
        onClick={() => openGameSection("overview", "game-known-issues")}
      />
      <StatusItem
        icon={Puzzle}
        label="Mods"
        {...mods}
        onClick={() => openGameSection("mods")}
      />
    </div>
  );
}
