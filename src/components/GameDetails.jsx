import {
  BadgeCheck,
  CalendarDays,
  Code2,
  Cpu,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Gamepad2,
  Gauge,
  Monitor,
  Package,
  Radio,
  Sparkles,
  Store,
  UserRoundCog,
  WandSparkles,
} from "lucide-react";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";

import FeatureCard from "./FeatureCard";
import StoreBadge from "./StoreBadge";
import RenoDxCard from "./RenoDxCard";
import ControllerCompatibility from "./ControllerCompatibility";


function InfoRow({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div
      className="
        flex
        items-start
        gap-3
        rounded-xl
        border
        border-white/10
        bg-white/[0.025]
        p-4
      "
    >
      <div
        className="
          flex
          h-10
          w-10
          shrink-0
          items-center
          justify-center
          rounded-lg
          bg-cyan-500/10
          text-cyan-400
        "
      >
        <Icon
          className="h-5 w-5"
        />
      </div>

      <div
        className="
          min-w-0
          flex-1
        "
      >
        <div
          className="
            text-xs
            font-semibold
            uppercase
            tracking-wide
            text-white/40
          "
        >
          {label}
        </div>

        <div
          className="
            mt-2
            break-words
            text-sm
            leading-relaxed
            text-white/85
          "
        >
          {value || "Unknown"}
        </div>
      </div>
    </div>
  );
}


function SectionHeader({
  title,
  description,
}) {
  return (
    <div
      className="
        mb-6
      "
    >
      <h2
        className="
          text-2xl
          font-semibold
          text-white
        "
      >
        {title}
      </h2>

      {description ? (
        <p
          className="
            mt-2
            text-sm
            leading-relaxed
            text-white/40
          "
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}


function PcgwMatch({
  game,
}) {
  async function handleOpenPcgw() {
    if (!game?.pcgwPageUrl) {
      console.warn(
        "[PCGW] No page URL available."
      );

      return;
    }

    try {
      console.log(
        "[PCGW] Opening:",
        game.pcgwPageUrl
      );

      await openUrl(
        game.pcgwPageUrl
      );
    } catch (error) {
      console.error(
        "[PCGW] Failed to open PCGamingWiki page:",
        error
      );
    }
  }


  if (game.pcgwLoading) {
    return (
      <div
        className="
          rounded-xl
          border
          border-white/10
          bg-white/[0.025]
          p-5
          text-sm
          text-white/45
        "
      >
        Loading PCGamingWiki information...
      </div>
    );
  }


  if (game.pcgwError) {
    return (
      <div
        className="
          rounded-xl
          border
          border-red-500/20
          bg-red-500/[0.06]
          p-5
        "
      >
        <div
          className="
            text-sm
            font-semibold
            text-red-300
          "
        >
          PCGamingWiki lookup failed
        </div>

        <div
          className="
            mt-2
            text-sm
            leading-relaxed
            text-red-200/50
          "
        >
          {game.pcgwError}
        </div>
      </div>
    );
  }


  if (
    game.pcgwLoaded &&
    !game.pcgwPageName
  ) {
    return (
      <div
        className="
          rounded-xl
          border
          border-white/10
          bg-white/[0.025]
          p-5
        "
      >
        <div
          className="
            text-sm
            font-semibold
            text-white/70
          "
        >
          No PCGamingWiki match found
        </div>

        <div
          className="
            mt-2
            text-sm
            text-white/35
          "
        >
          No matching PCGamingWiki page
          was found for this installed game.
        </div>
      </div>
    );
  }


  if (!game.pcgwPageName) {
    return (
      <div
        className="
          rounded-xl
          border
          border-white/10
          bg-white/[0.025]
          p-5
          text-sm
          text-white/40
        "
      >
        Select a game to load its PCGamingWiki match.
      </div>
    );
  }


  return (
    <div
      className="
        flex
        flex-col
        gap-5
        rounded-xl
        border
        border-white/10
        bg-white/[0.025]
        p-5
        lg:flex-row
        lg:items-center
        lg:justify-between
      "
    >
      <div
        className="
          min-w-0
        "
      >
        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <BadgeCheck
            className="
              h-5
              w-5
              shrink-0
              text-emerald-400
            "
          />

          <div
            className="
              text-base
              font-semibold
              text-white
            "
          >
            PCGamingWiki Match
          </div>
        </div>

        <div
          className="
            mt-3
            break-words
            text-sm
            text-white/55
          "
        >
          {game.pcgwPageName}
        </div>
      </div>


      <button
        type="button"
        onClick={
          handleOpenPcgw
        }
        disabled={
          !game.pcgwPageUrl
        }
        className="
          inline-flex
          shrink-0
          items-center
          justify-center
          gap-2
          rounded-lg
          border
          border-white/10
          bg-white/[0.04]
          px-4
          py-2.5
          text-sm
          font-medium
          text-white/80
          transition
          hover:border-white/20
          hover:bg-white/[0.08]
          hover:text-white
          disabled:cursor-not-allowed
          disabled:opacity-40
        "
      >
        View on PCGamingWiki

        <ExternalLink
          className="h-4 w-4"
        />
      </button>
    </div>
  );
}


export default function GameDetails({
  game,
}) {
  console.log(
    "[GAME DETAILS] Received game:",
    game
  );


  if (!game) {
    return (
      <main
        className="
          flex
          min-w-0
          flex-1
          items-center
          justify-center
          overflow-y-auto
          bg-[#0b0f17]
        "
      >
        <div
          className="
            max-w-md
            px-8
            text-center
          "
        >
          <div
            className="
              mx-auto
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-2xl
              bg-cyan-500/10
              text-cyan-400
            "
          >
            <Gamepad2
              className="h-8 w-8"
            />
          </div>

          <h1
            className="
              mt-5
              text-2xl
              font-semibold
              text-white
            "
          >
            Select a Game
          </h1>

          <p
            className="
              mt-2
              text-sm
              leading-relaxed
              text-white/40
            "
          >
            Choose an installed game from
            the sidebar to view its
            PCGamingWiki information,
            controller support, technical
            details, and available mods.
          </p>
        </div>
      </main>
    );
  }


  return (
    <main
      className="
        min-w-0
        flex-1
        overflow-y-auto
        bg-[#0b0f17]
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-[1500px]
          px-6
          py-7
          xl:px-8
        "
      >
        {/* Header */}
        <section
          className="
            mb-10
          "
        >
          <div
            className="
              flex
              flex-col
              gap-5
              xl:flex-row
              xl:items-start
              xl:justify-between
            "
          >
            <div
              className="
                min-w-0
              "
            >
              <div
                className="
                  mb-3
                  flex
                  flex-wrap
                  items-center
                  gap-2
                "
              >
                <StoreBadge
                  store={
                    game.store
                  }
                />

                {game.pcgwLoading ? (
                  <span
                    className="
                      rounded-full
                      border
                      border-cyan-500/20
                      bg-cyan-500/10
                      px-2.5
                      py-1
                      text-xs
                      font-medium
                      text-cyan-300
                    "
                  >
                    Loading PCGW
                  </span>
                ) : null}

                {game.renodxLoading ? (
                  <span
                    className="
                      rounded-full
                      border
                      border-violet-500/20
                      bg-violet-500/10
                      px-2.5
                      py-1
                      text-xs
                      font-medium
                      text-violet-300
                    "
                  >
                    Checking RenoDX
                  </span>
                ) : null}
              </div>

              <h1
                className="
                  break-words
                  text-3xl
                  font-bold
                  tracking-tight
                  text-white
                  xl:text-4xl
                "
              >
                {game.name}
              </h1>

              <div
                className="
                  mt-3
                  flex
                  flex-wrap
                  items-center
                  gap-x-5
                  gap-y-2
                  text-sm
                  text-white/40
                "
              >
                {game.developer ? (
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <UserRoundCog
                      className="h-4 w-4"
                    />

                    {game.developer}
                  </div>
                ) : null}

                {game.releaseDate ? (
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <CalendarDays
                      className="h-4 w-4"
                    />

                    {game.releaseDate}
                  </div>
                ) : null}

                {game.technical?.engine ? (
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <Cpu
                      className="h-4 w-4"
                    />

                    {game.technical.engine}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>


        {/* Overview */}
        <section
          className="
            mb-10
          "
        >
          <SectionHeader
            title="Overview"
            description="Game information reported by PCGamingWiki."
          />

          <div
            className="
              grid
              grid-cols-1
              gap-4
              md:grid-cols-2
              xl:grid-cols-4
            "
          >
            <InfoRow
              icon={UserRoundCog}
              label="Developer"
              value={
                game.developer
              }
            />

            <InfoRow
              icon={Package}
              label="Publisher"
              value={
                game.publisher
              }
            />

            <InfoRow
              icon={CalendarDays}
              label="Release Date"
              value={
                game.releaseDate
              }
            />

            <InfoRow
              icon={Store}
              label="Store"
              value={
                game.store
              }
            />
          </div>
        </section>


        {/* PC Features */}
        <section
          className="
            mb-10
          "
        >
          <SectionHeader
            title="PC Features"
            description="PC-specific graphics and display features reported by PCGamingWiki."
          />

          <div
            className="
              grid
              grid-cols-1
              gap-4
              md:grid-cols-2
              xl:grid-cols-3
            "
          >
            <FeatureCard
              icon={Monitor}
              title="HDR"
              value={
                game.features?.hdr
              }
            />

            <FeatureCard
              icon={Monitor}
              title="Ultrawide"
              value={
                game.features?.ultrawide
              }
            />

            <FeatureCard
              icon={Gamepad2}
              title="Controller"
              value={
                game.features?.controller
              }
            />

            <FeatureCard
              icon={Sparkles}
              title="Ray Tracing"
              value={
                game.features?.rayTracing
              }
            />

            <FeatureCard
              icon={Gauge}
              title="Frame Generation"
              value={
                game.features?.frameGeneration
              }
            />

            <FeatureCard
              icon={WandSparkles}
              title="Upscaling"
              value={
                game.features?.upscaling
              }
            />
          </div>
        </section>


        {/* Controller Compatibility */}
        <ControllerCompatibility
          game={
            game
          }
        />


        {/* Mods */}
        <section
          className="
            mt-10
            mb-10
          "
        >
          <SectionHeader
            title="Mods & Enhancements"
            description="Available enhancement and modification support for this game."
          />

          <RenoDxCard
            game={
              game
            }
          />
        </section>


        {/* Technical Information */}
        <section
          className="
            mb-10
          "
        >
          <SectionHeader
            title="Technical Information"
            description="Engine, installation, configuration, and save-data information."
          />

          <div
            className="
              grid
              grid-cols-1
              gap-4
              xl:grid-cols-2
            "
          >
            <InfoRow
              icon={Cpu}
              label="Engine"
              value={
                game.technical?.engine
              }
            />

            <InfoRow
              icon={Code2}
              label="Graphics API"
              value={
                game.technical?.api
              }
            />

            <InfoRow
              icon={FolderOpen}
              label="Install Location"
              value={
                game.installPath
              }
            />

            <InfoRow
              icon={FileCode2}
              label="Configuration Location"
              value={
                game.technical?.configLocation
              }
            />

            <InfoRow
              icon={FolderOpen}
              label="Save Location"
              value={
                game.technical?.saveLocation
              }
            />

            <InfoRow
              icon={Radio}
              label="Launcher ID"
              value={
                game.launcherId
              }
            />
          </div>
        </section>


        {/* PCGamingWiki */}
        <section
          className="
            pb-10
          "
        >
          <SectionHeader
            title="PCGamingWiki"
            description={
              game.pcgwPageName
                ? `The page ${game.pcgwPageName} matched to this installed game.`
                : "PCGamingWiki match information for this installed game."
            }
          />

          <PcgwMatch
            game={
              game
            }
          />
        </section>
      </div>
    </main>
  );
}