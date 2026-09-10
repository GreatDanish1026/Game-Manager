import {
  Bookmark,
  Check,
  Clock3,
  FileText,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearPlayStatusNotes,
  getPlayStatusNotes,
  PLAY_STATUSES,
  playStatusLabel,
  savePlayStatusNotes,
} from "../services/playStatusNotes";


function statusIcon(
  id
) {
  switch (
    id
  ) {
    case "playing":
      return PlayCircle;

    case "completed":
      return Check;

    case "on_hold":
      return PauseCircle;

    case "dropped":
      return XCircle;

    case "replay":
      return RotateCcw;

    default:
      return Bookmark;
  }
}


function formatUpdated(
  value
) {
  if (!value) {
    return "Not saved yet";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Saved";
  }

  return date.toLocaleString();
}


export default function PlayStatusNotesPanel({
  game,
}) {
  const [
    saved,
    setSaved,
  ] =
    useState(
      () =>
        getPlayStatusNotes(
          game
        )
    );

  const [
    draft,
    setDraft,
  ] =
    useState(
      () =>
        getPlayStatusNotes(
          game
        )
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      null
    );


  useEffect(
    () => {
      const next =
        getPlayStatusNotes(
          game
        );

      setSaved(
        next
      );

      setDraft(
        next
      );

      setMessage(
        null
      );
    },
    [
      game?.id,
      game?.store,
      game?.launcherId,
      game?.name,
    ]
  );


  const dirty =
    useMemo(
      () =>
        draft.status
          !== saved.status
        || draft.progress
          !== saved.progress
        || draft.notes
          !== saved.notes,
      [
        draft,
        saved,
      ]
    );


  function selectStatus(
    status
  ) {
    const next = {
      ...draft,

      status,
    };

    setDraft(
      next
    );

    const result =
      savePlayStatusNotes(
        game,
        next
      );

    setSaved(
      result
    );

    setDraft(
      result
    );

    setMessage(
      `Status changed to ${playStatusLabel(
        status
      )}.`
    );
  }


  function save() {
    const result =
      savePlayStatusNotes(
        game,
        draft
      );

    setSaved(
      result
    );

    setDraft(
      result
    );

    setMessage(
      "Progress and personal notes saved."
    );
  }


  function clearAll() {
    const confirmed =
      window.confirm(
        "Clear the play status, progress, and personal notes for this game?"
      );

    if (!confirmed) {
      return;
    }

    const result =
      clearPlayStatusNotes(
        game
      );

    setSaved(
      result
    );

    setDraft(
      result
    );

    setMessage(
      "Play status and notes cleared."
    );
  }


  return (
    <div>
      <div
        className="
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
          p-4
        "
      >
        <div
          className="
            flex
            flex-col
            gap-3
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div>
            <div
              className="
                text-sm
                font-semibold
                text-white/75
              "
            >
              Play Status
            </div>

            <div
              className="
                mt-1
                text-xs
                text-white/30
              "
            >
              Track where this game currently sits in your library.
            </div>
          </div>

          <div
            className="
              inline-flex
              items-center
              gap-2
              text-[10px]
              text-white/25
            "
          >
            <Clock3
              className="h-3.5 w-3.5"
            />

            {formatUpdated(
              saved.updatedAt
            )}
          </div>
        </div>


        <div
          className="
            mt-4
            grid
            grid-cols-2
            gap-2
            sm:grid-cols-3
            xl:grid-cols-6
          "
        >
          {PLAY_STATUSES.map(
            (
              status
            ) => {
              const Icon =
                statusIcon(
                  status.id
                );

              const selected =
                draft.status
                  === status.id;

              return (
                <button
                  key={
                    status.id
                  }
                  type="button"
                  onClick={
                    () =>
                      selectStatus(
                        status.id
                      )
                  }
                  className={`
                    flex
                    items-center
                    justify-center
                    gap-2
                    rounded-lg
                    border
                    px-3
                    py-2.5
                    text-xs
                    font-semibold
                    transition
                    ${
                      selected
                        ? "border-cyan-400/30 bg-cyan-500/12 text-cyan-100/85"
                        : "border-white/[0.07] bg-white/[0.02] text-white/35 hover:bg-white/[0.05] hover:text-white/60"
                    }
                  `}
                >
                  <Icon
                    className="h-3.5 w-3.5"
                  />

                  {status.label}
                </button>
              );
            }
          )}
        </div>
      </div>


      <div
        className="
          mt-3
          grid
          grid-cols-1
          gap-3
          xl:grid-cols-[0.7fr_1.3fr]
        "
      >
        <div
          className="
            rounded-xl
            border
            border-white/[0.08]
            bg-black/10
            p-4
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <Bookmark
              className="
                h-4
                w-4
                text-cyan-300/70
              "
            />

            <div
              className="
                text-sm
                font-semibold
                text-white/70
              "
            >
              Progress
            </div>
          </div>

          <div
            className="
              mt-1
              text-xs
              text-white/30
            "
          >
            A short reminder of where you left off.
          </div>

          <input
            value={
              draft.progress
            }
            onChange={
              (
                event
              ) =>
                setDraft({
                  ...draft,

                  progress:
                    event.target
                      .value,
                })
            }
            placeholder='Example: "Chapter 7", "Act 2", "NG+ boss 4"'
            maxLength={180}
            className="
              mt-4
              w-full
              rounded-lg
              border
              border-white/[0.08]
              bg-[#101722]
              px-3
              py-2.5
              text-sm
              text-white/70
              outline-none
              placeholder:text-white/15
              focus:border-cyan-400/30
            "
          />

          <div
            className="
              mt-2
              text-right
              text-[10px]
              text-white/20
            "
          >
            {draft.progress.length}/180
          </div>
        </div>


        <div
          className="
            rounded-xl
            border
            border-white/[0.08]
            bg-black/10
            p-4
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <FileText
              className="
                h-4
                w-4
                text-cyan-300/70
              "
            />

            <div
              className="
                text-sm
                font-semibold
                text-white/70
              "
            >
              Personal Notes
            </div>
          </div>

          <div
            className="
              mt-1
              text-xs
              text-white/30
            "
          >
            Keep private notes about the game, mods, settings, builds, objectives, or anything else you want to remember.
          </div>

          <textarea
            value={
              draft.notes
            }
            onChange={
              (
                event
              ) =>
                setDraft({
                  ...draft,

                  notes:
                    event.target
                      .value,
                })
            }
            placeholder="Write your notes here…"
            rows={7}
            maxLength={12000}
            className="
              mt-4
              w-full
              resize-y
              rounded-lg
              border
              border-white/[0.08]
              bg-[#101722]
              px-3
              py-3
              text-sm
              leading-relaxed
              text-white/70
              outline-none
              placeholder:text-white/15
              focus:border-cyan-400/30
            "
          />

          <div
            className="
              mt-2
              text-right
              text-[10px]
              text-white/20
            "
          >
            {draft.notes.length.toLocaleString()}/12,000
          </div>
        </div>
      </div>


      <div
        className="
          mt-3
          flex
          flex-col
          gap-3
          rounded-xl
          border
          border-white/[0.07]
          bg-white/[0.015]
          p-3
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <div
          className="
            min-h-[18px]
            text-xs
            text-emerald-200/55
          "
        >
          {message}
        </div>

        <div
          className="
            flex
            shrink-0
            gap-2
          "
        >
          <button
            type="button"
            onClick={
              clearAll
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-red-500/15
              bg-red-500/[0.035]
              px-3
              py-2
              text-xs
              font-semibold
              text-red-200/40
              hover:bg-red-500/[0.07]
              hover:text-red-200/65
            "
          >
            <Trash2
              className="h-3.5 w-3.5"
            />

            Clear
          </button>

          <button
            type="button"
            onClick={
              save
            }
            disabled={
              !dirty
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-cyan-400/25
              bg-cyan-500/10
              px-4
              py-2
              text-xs
              font-semibold
              text-cyan-100/80
              hover:bg-cyan-500/15
              disabled:cursor-not-allowed
              disabled:opacity-30
            "
          >
            <Save
              className="h-3.5 w-3.5"
            />

            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
}
