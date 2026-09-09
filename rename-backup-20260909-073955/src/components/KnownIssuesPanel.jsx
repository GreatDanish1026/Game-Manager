import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCcw,
} from "lucide-react";

import DOMPurify from "dompurify";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";

import {
  getPcgwKnownIssues,
} from "../services/pcgwKnownIssues";

function IssueHtml({
  html,
}) {
  const safeHtml =
    useMemo(
      () =>
        DOMPurify.sanitize(
          html ?? ""
        ),
      [
        html,
      ]
    );

  async function handleClick(
    event
  ) {
    const anchor =
      event.target.closest("a");

    if (!anchor) {
      return;
    }

    event.preventDefault();

    const href =
      anchor.getAttribute("href");

    if (!href) {
      return;
    }

    let target =
      href;

    if (
      href.startsWith("//")
    ) {
      target =
        `https:${href}`;
    } else if (
      href.startsWith("/")
    ) {
      target =
        `https://www.pcgamingwiki.com${href}`;
    }

    if (
      target.startsWith("http://")
      || target.startsWith("https://")
    ) {
      await openUrl(target);
    }
  }

  return (
    <div
      onClick={
        handleClick
      }
      className="
        text-sm
        leading-7
        text-white/58
        [&_a]:text-cyan-300/85
        [&_a]:underline
        [&_h2]:my-3
        [&_h2]:text-lg
        [&_h2]:font-semibold
        [&_h2]:text-white/80
        [&_h3]:my-2
        [&_h3]:font-semibold
        [&_h3]:text-white/75
        [&_li]:my-1
        [&_p]:my-2
        [&_table]:w-full
        [&_td]:border
        [&_td]:border-white/[0.07]
        [&_td]:p-2
        [&_th]:border
        [&_th]:border-white/[0.07]
        [&_th]:p-2
        [&_ul]:ml-5
        [&_ul]:list-disc
      "
      dangerouslySetInnerHTML={{
        __html:
          safeHtml,
      }}
    />
  );
}

function IssueGroup({
  title,
  icon: Icon,
  html,
  emptyText,
  success = false,
}) {
  return (
    <div
      className="
        overflow-hidden
        rounded-xl
        border
        border-white/[0.08]
        bg-black/10
      "
    >
      <div
        className="
          flex
          items-center
          gap-2
          border-b
          border-white/[0.06]
          px-4
          py-3.5
        "
      >
        <Icon
          className={`
            h-4
            w-4
            ${
              success
                ? "text-emerald-300/80"
                : "text-amber-300/80"
            }
          `}
        />

        <div
          className="
            text-sm
            font-semibold
            text-white/72
          "
        >
          {title}
        </div>
      </div>

      <div className="p-4">
        {html ? (
          <IssueHtml
            html={
              html
            }
          />
        ) : (
          <div
            className="
              text-sm
              text-white/30
            "
          >
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KnownIssuesPanel({
  game,
}) {
  const [
    data,
    setData,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState(null);

  async function refresh(
    force = false
  ) {
    if (
      !game?.pcgwPageName
    ) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setData(
        await getPcgwKnownIssues(
          game.pcgwPageName,
          {
            force,
          }
        )
      );
    } catch (error) {
      setError(
        String(error)
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(
    () => {
      refresh(false);
    },
    [
      game?.pcgwPageName,
    ]
  );

  if (
    game?.pcgwLoading
  ) {
    return (
      <div
        className="
          flex
          items-center
          gap-3
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
          px-4
          py-5
          text-sm
          text-white/35
        "
      >
        <Loader2
          className="
            h-4
            w-4
            animate-spin
          "
        />

        Waiting for PCGamingWiki match…
      </div>
    );
  }

  if (
    !game?.pcgwPageName
  ) {
    return (
      <div
        className="
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
          p-4
          text-sm
          text-white/35
        "
      >
        No PCGamingWiki match is available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="
          flex
          items-center
          justify-between
          gap-3
        "
      >
        <div
          className="
            text-xs
            text-white/28
          "
        >
          Loaded directly from the matched PCGamingWiki page.
        </div>

        <button
          type="button"
          onClick={
            () =>
              refresh(true)
          }
          disabled={
            loading
          }
          className="
            inline-flex
            items-center
            gap-2
            rounded-lg
            border
            border-white/[0.08]
            bg-white/[0.025]
            px-3
            py-2
            text-xs
            text-white/45
            hover:bg-white/[0.06]
            hover:text-white/70
            disabled:opacity-30
          "
        >
          {loading ? (
            <Loader2
              className="
                h-3.5
                w-3.5
                animate-spin
              "
            />
          ) : (
            <RefreshCcw
              className="h-3.5 w-3.5"
            />
          )}

          Refresh
        </button>
      </div>

      {error ? (
        <div
          className="
            rounded-xl
            border
            border-red-500/20
            bg-red-500/[0.05]
            px-4
            py-3
            text-xs
            text-red-300/75
          "
        >
          {error}
        </div>
      ) : null}

      {loading
        && !data ? (
        <div
          className="
            flex
            items-center
            gap-3
            rounded-xl
            border
            border-white/[0.08]
            bg-black/10
            px-4
            py-5
            text-sm
            text-white/35
          "
        >
          <Loader2
            className="
              h-4
              w-4
              animate-spin
            "
          />

          Loading known issues…
        </div>
      ) : null}

      {data ? (
        <>
          <IssueGroup
            title="Issues Unresolved"
            icon={
              AlertTriangle
            }
            html={
              data.unresolvedHtml
            }
            emptyText="No unresolved issues section is listed."
          />

          <IssueGroup
            title="Issues Fixed"
            icon={
              CheckCircle2
            }
            html={
              data.fixedHtml
            }
            emptyText="No fixed issues section is listed."
            success
          />
        </>
      ) : null}

      {game.pcgwPageUrl ? (
        <button
          type="button"
          onClick={
            () =>
              openUrl(
                game.pcgwPageUrl
              )
          }
          className="
            inline-flex
            items-center
            gap-2
            text-xs
            font-medium
            text-cyan-300/65
            hover:text-cyan-200
          "
        >
          View full PCGamingWiki page

          <ExternalLink
            className="h-3.5 w-3.5"
          />
        </button>
      ) : null}
    </div>
  );
}
