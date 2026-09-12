import {
  ChevronDown,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";


function loadPreference(
  storageKey,
  defaultOpen
) {
  if (!storageKey) {
    return defaultOpen;
  }

  try {
    const value =
      localStorage.getItem(
        storageKey
      );

    if (value === null) {
      return defaultOpen;
    }

    return value === "true";
  } catch {
    return defaultOpen;
  }
}


export default function CollapsibleSection({
  id,
  title,
  description,
  icon: Icon,
  defaultOpen = false,
  summary = null,
  children,
  className = "",
}) {
  const storageKey =
    id
      ? `game-manager-section-${id}`
      : null;

  const [
    open,
    setOpen,
  ] =
    useState(
      () =>
        loadPreference(
          storageKey,
          defaultOpen
        )
    );


  useEffect(
    () => {
      if (!storageKey) {
        return;
      }

      try {
        localStorage.setItem(
          storageKey,
          String(open)
        );
      } catch {
        // UI preferences should never break the page.
      }
    },
    [
      open,
      storageKey,
    ]
  );


  useEffect(
    () => {
      function handleOpenSection(
        event
      ) {
        if (
          event?.detail?.id
          === id
        ) {
          setOpen(
            true
          );
        }
      }

      window.addEventListener(
        "game-manager-open-section",
        handleOpenSection
      );

      return () =>
        window.removeEventListener(
          "game-manager-open-section",
          handleOpenSection
        );
    },
    [
      id,
    ]
  );


  return (
    <section
      id={
        id
          ? `game-section-${id}`
          : undefined
      }
      className={`
        mb-5
        scroll-mt-16
        overflow-hidden
        rounded-2xl
        border
        border-white/10
        bg-white/[0.02]
        ${className}
      `}
    >
      <button
        type="button"
        onClick={
          () =>
            setOpen(
              (current) =>
                !current
            )
        }
        aria-expanded={
          open
        }
        className="
          flex
          w-full
          items-center
          gap-4
          px-5
          py-4
          text-left
          transition
          hover:bg-white/[0.025]
        "
      >
        {Icon ? (
          <div
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-cyan-500/10
              text-cyan-300
            "
          >
            <Icon
              className="h-5 w-5"
            />
          </div>
        ) : null}

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-x-3
              gap-y-1
            "
          >
            <h2
              className="
                text-lg
                font-semibold
                text-white
              "
            >
              {title}
            </h2>

            {summary ? (
              <div
                className="
                  text-xs
                  text-white/35
                "
              >
                {summary}
              </div>
            ) : null}
          </div>

          {description ? (
            <p
              className="
                mt-1
                text-sm
                leading-relaxed
                text-white/40
              "
            >
              {description}
            </p>
          ) : null}
        </div>

        <ChevronDown
          className={`
            h-5
            w-5
            shrink-0
            text-white/35
            transition-transform
            duration-200
            ${
              open
                ? "rotate-180"
                : ""
            }
          `}
        />
      </button>

      {open ? (
        <div
          className="
            border-t
            border-white/[0.07]
            px-5
            pb-5
            pt-5
          "
        >
          {/* GAMEATLAS_LAZY_COLLAPSIBLE_CHILDREN_PHASE3 */}
        {open ? children : null}
        </div>
      ) : null}
    </section>
  );
}
