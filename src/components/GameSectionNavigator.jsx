import {
  Cpu,
  FolderOpen,
  Gamepad2,
  HardDrive,
  Info,
  MonitorCog,
  Puzzle,
  Settings2,
  UserRoundCog,
} from "lucide-react";




const GAMEATLAS_IS_LINUX =
  typeof navigator !== "undefined"
  && /linux/i.test(
    [
      navigator.userAgent,
      navigator.platform,
    ]
      .filter(Boolean)
      .join(" ")
  );


const SECTIONS = [
  {
  id: "overview",
  label: "Overview",
  icon: Info,
  },
  {
  id: "compatibility-performance",
  label: "Performance",
  icon: MonitorCog,
  },
  {
  id: "pc-features",
  label: "PC Features",
  icon: Cpu,
  },
  {
  id: "mods",
  label: "Mods",
  icon: Puzzle,
  },
  {
  id: "files-installation",
  label: "Files",
  icon: FolderOpen,
  },
  {
  id: "saves-screenshots",
  label: "Saves",
  icon: HardDrive,
  },
  {
  id: "technical-troubleshooting",
  label: "Technical",
  icon: Settings2,
  },
  {
  id: "my-game",
  label: "My Game",
  icon: UserRoundCog,
  },
  {
  id: "proton-toolbox",
  label: "Proton Toolbox",
  icon: Settings2,
  linuxOnly: true,
  }
];


export default function GameSectionNavigator() {
  function jumpTo(
    id
  ) {
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
        overflow-x-auto
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
          flex
          min-w-max
          items-center
          gap-2
        "
      >
        {SECTIONS
          .filter(
            (item) =>
              !item.linuxOnly
              || GAMEATLAS_IS_LINUX
          )
          .map(
          (
            section
          ) => {
            const Icon =
              section.icon;

            return (
              <button
                key={
                  section.id
                }
                type="button"
                onClick={
                  () =>
                    jumpTo(
                      section.id
                    )
                }
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  border
                  border-white/[0.07]
                  bg-white/[0.025]
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-white/45
                  transition
                  hover:border-cyan-400/20
                  hover:bg-cyan-400/[0.06]
                  hover:text-cyan-100/80
                "
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
    </nav>
  );
}
