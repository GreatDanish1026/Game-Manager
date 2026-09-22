import {
  Cpu,
  FolderOpen,
  HardDrive,
  Info,
  MonitorCog,
  Puzzle,
  Settings2,
  UserRoundCog,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";


const SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    icon: Info,
    group: "Game",
  },
  {
    id: "my-game",
    label: "My Game",
    icon: UserRoundCog,
    group: "Game",
  },
  {
    id: "compatibility-performance",
    label: "Performance",
    icon: MonitorCog,
    group: "Play",
  },
  {
    id: "pc-features",
    label: "PC Features",
    icon: Cpu,
    group: "Play",
  },
  {
    id: "mods",
    label: "Mods",
    icon: Puzzle,
    group: "Manage",
  },
  {
    id: "files-installation",
    label: "Files",
    icon: FolderOpen,
    group: "Manage",
  },
  {
    id: "saves-screenshots",
    label: "Saves",
    icon: HardDrive,
    group: "Manage",
  },
  {
    id: "technical-troubleshooting",
    label: "Help & Tools",
    icon: Settings2,
    group: "Support",
  },
];


export default function GameSectionNavigator() {
  const [
    activeId,
    setActiveId,
  ] = useState(
    "overview"
  );

  const groups =
    useMemo(
      () =>
        Array.from(
          new Set(
            SECTIONS.map(
              (section) =>
                section.group
            )
          )
        ),
      []
    );


  useEffect(
    () => {
      const elements =
        SECTIONS
          .map(
            (section) =>
              document.getElementById(
                `game-section-${section.id}`
              )
          )
          .filter(Boolean);

      const observer =
        new IntersectionObserver(
          (entries) => {
            const visible =
              entries
                .filter(
                  (entry) =>
                    entry.isIntersecting
                )
                .sort(
                  (left, right) =>
                    left.boundingClientRect.top
                    - right.boundingClientRect.top
                );

            const id =
              visible[0]
                ?.target
                ?.id
                ?.replace(
                  "game-section-",
                  ""
                );

            if (id) {
              setActiveId(
                id
              );
            }
          },
          {
            rootMargin:
              "-15% 0px -70% 0px",
            threshold:
              0,
          }
        );

      elements.forEach(
        (element) =>
          observer.observe(
            element
          )
      );

      return () =>
        observer.disconnect();
    },
    []
  );


  function jumpTo(
    id
  ) {
    setActiveId(
      id
    );

    window.dispatchEvent(
      new CustomEvent(
        "game-manager-open-section",
        {
          detail: {
            id,
          },
        }
      )
    );

    window.setTimeout(
      () => {
        document
          .getElementById(
            `game-section-${id}`
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      },
      40
    );
  }


  return (
    <nav
      aria-label="Game detail sections"
      className="
        sticky
        top-0
        z-20
        mb-5
        -mx-2
        border-y
        border-white/[0.06]
        bg-[#0b0f17]/95
        px-2
        py-2.5
        backdrop-blur-xl
      "
    >
      <div
        className="
          hidden
          flex-nowrap
          items-center
          gap-2
          2xl:flex
        "
      >
        {SECTIONS.map(
          (section) => {
            const Icon =
              section.icon;

            const active =
              activeId ===
              section.id;

            return (
              <button
                key={
                  section.id
                }
                type="button"
                aria-current={
                  active
                    ? "location"
                    : undefined
                }
                onClick={
                  () =>
                    jumpTo(
                      section.id
                    )
                }
                className={`
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  border
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  whitespace-nowrap
                  transition
                  hover:border-cyan-400/20
                  hover:bg-cyan-400/[0.06]
                  hover:text-cyan-100/80
                  ${
                    active
                      ? "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-100/90"
                      : "border-white/[0.07] bg-white/[0.025] text-white/45"
                  }
                `}
              >
                <Icon
                  className="
                    h-3.5
                    w-3.5
                  "
                />

                {section.label}
              </button>
            );
          }
        )}
      </div>

      <label
        className="
          flex
          items-center
          gap-3
          2xl:hidden
        "
      >
        <span
          className="
            shrink-0
            text-xs
            font-semibold
            text-white/40
          "
        >
          Jump to
        </span>

        <select
          value={
            activeId
          }
          onChange={
            (event) =>
              jumpTo(
                event.target.value
              )
          }
          aria-label="Jump to game section"
          className="
            min-w-0
            flex-1
            rounded-lg
            border
            border-white/[0.09]
            bg-white/[0.04]
            px-3
            py-2
            text-sm
            font-medium
            text-white/80
            outline-none
            focus:border-cyan-400/30
          "
        >
          {groups.map(
            (group) => (
              <optgroup
                key={
                  group
                }
                label={
                  group
                }
              >
                {SECTIONS
                  .filter(
                    (section) =>
                      section.group ===
                      group
                  )
                  .map(
                    (section) => (
                      <option
                        key={
                          section.id
                        }
                        value={
                          section.id
                        }
                      >
                        {section.label}
                      </option>
                    )
                  )}
              </optgroup>
            )
          )}
        </select>
      </label>
    </nav>
  );
}
