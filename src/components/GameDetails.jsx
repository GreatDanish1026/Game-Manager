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

import VortexCard from "./VortexCard";
import FluffyCard from "./FluffyCard";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";

import FeatureCard from "./FeatureCard";
import StoreBadge from "./StoreBadge";
import RenoDxCard from "./RenoDxCard";
import ControllerCompatibility from "./ControllerCompatibility";
import EssentialImprovements from "./EssentialImprovements";


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


function combineFeatureDescription(
  technology,
  notes
) {
  const parts = [];

  if (technology) {
    parts.push(
      `Technology: ${technology}`
    );
  }

  if (notes) {
    parts.push(
      notes
    );
  }

  return parts.length > 0
    ? parts.join(" — ")
    : null;
}


function PcgwMatch({
  game,
}) {
  async function handleOpenPcgw() {
    if (
      !game?.pcgwPageUrl
    ) {
      return;
    }

    try {
      await openUrl(
        game.pcgwPageUrl
      );
    } catch (error) {
      console.error(
        "[PCGW] Failed to open page:",
        error
      );
    }
  }


  if (
    game.pcgwLoading
  ) {
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


  if (
    game.pcgwError
  ) {
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
            text-red-200/50
          "
        >
          {game.pcgwError}
        </div>
      </div>
    );
  }


  if (
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
          text-sm
          text-white/40
        "
      >
        No PCGamingWiki match found.
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
      <div>
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
              text-emerald-400
            "
          />

          <div
            className="
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
        className="
          inline-flex
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
          hover:bg-white/[0.08]
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


function WsgfInfo({
  features,
}) {
  const awards =
    features?.wsgfAwards;

  if (
    !features?.wsgfLink &&
    !awards?.widescreen &&
    !awards?.multimonitor &&
    !awards?.ultrawide &&
    !awards?.fourK
  ) {
    return null;
  }


  async function openWsgf() {
    if (
      !features?.wsgfLink
    ) {
      return;
    }

    try {
      await openUrl(
        features.wsgfLink
      );
    } catch (error) {
      console.error(
        "[WSGF] Failed to open:",
        error
      );
    }
  }


  return (
    <div
      className="
        mt-5
        rounded-xl
        border
        border-white/10
        bg-white/[0.025]
        p-5
      "
    >
      <div
        className="
          flex
          flex-col
          gap-4
          lg:flex-row
          lg:items-center
          lg:justify-between
        "
      >
        <div>
          <div
            className="
              font-semibold
              text-white
            "
          >
            Widescreen Gaming Forum
          </div>

          <div
            className="
              mt-2
              flex
              flex-wrap
              gap-x-5
              gap-y-2
              text-xs
              text-white/55
            "
          >
            {awards?.widescreen ? (
              <span>
                Widescreen:{" "}
                {awards.widescreen}
              </span>
            ) : null}

            {awards?.multimonitor ? (
              <span>
                Multi-monitor:{" "}
                {awards.multimonitor}
              </span>
            ) : null}

            {awards?.ultrawide ? (
              <span>
                Ultrawide:{" "}
                {awards.ultrawide}
              </span>
            ) : null}

            {awards?.fourK ? (
              <span>
                4K:{" "}
                {awards.fourK}
              </span>
            ) : null}
          </div>
        </div>


        {features?.wsgfLink ? (
          <button
            type="button"
            onClick={
              openWsgf
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-white/10
              bg-white/[0.04]
              px-4
              py-2
              text-sm
              text-white/75
              hover:bg-white/[0.08]
            "
          >
            View WSGF

            <ExternalLink
              className="h-4 w-4"
            />
          </button>
        ) : null}
      </div>
    </div>
  );
}


export default function GameDetails({
  game,
}) {
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
              text-white/40
            "
          >
            Choose an installed game
            from the sidebar.
          </p>
        </div>
      </main>
    );
  }


  const features =
    game.features ?? {};


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

        {/* ====================================================
            HEADER
        ==================================================== */}

        <section
          className="
            mb-10
          "
        >
          <div
            className="
              flex
              flex-col
              gap-6
              sm:flex-row
              sm:items-start
              sm:justify-between
            "
          >
            <div
              className="
                min-w-0
                flex-1
              "
            >
              <StoreBadge
                store={
                  game.store
                }
              />

              <h1
                className="
                  mt-3
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
                  gap-5
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
              </div>
            </div>


            {game.coverImageUrl ? (
              <div
                data-pcgw-cover
                className="
                  shrink-0
                  self-start
                "
              >
                <div
                  className="
                    overflow-hidden
                    rounded-xl
                    border
                    border-white/10
                    bg-white/[0.025]
                    shadow-2xl
                    shadow-black/25
                  "
                >
                  <img
                    src={
                      game.coverImageUrl
                    }
                    alt={
                      `${game.name} cover`
                    }
                    className="
                      h-[210px]
                      w-[145px]
                      object-cover
                      md:h-[240px]
                      md:w-[165px]
                      xl:h-[270px]
                      xl:w-[185px]
                    "
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={
                      (event) => {
                        console.error(
                          "[PCGW] Cover image failed to load:",
                          game.coverImageUrl
                        );

                        event.currentTarget
                          .closest(
                            "[data-pcgw-cover]"
                          )
                          ?.remove();
                      }
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>


        {/* ====================================================
            OVERVIEW
        ==================================================== */}

        <section
          className="
            mb-10
          "
        >
          <SectionHeader
            title="Overview"
            description="General game information reported by PCGamingWiki."
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


        {/* ====================================================
            PC FEATURES
        ==================================================== */}

        <section
          className="
            mb-10
          "
        >
          <SectionHeader
            title="PC Features"
            description="Graphics, display, frame-rate, and video-feature information from PCGamingWiki."
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
              title="Widescreen Resolution"
              value={
                features.widescreen
              }
              description={
                features.widescreenNotes
              }
            />

            <FeatureCard
              icon={Monitor}
              title="Multi-Monitor"
              value={
                features.multimonitor
              }
              description={
                features.multimonitorNotes
              }
            />

            <FeatureCard
              icon={Monitor}
              title="Ultrawide"
              value={
                features.ultrawide
              }
              description={
                features.ultrawideNotes
              }
            />

            <FeatureCard
              icon={Monitor}
              title="4K Ultra HD"
              value={
                features.fourK
              }
              description={
                features.fourKNotes
              }
            />

            <FeatureCard
              icon={Monitor}
              title="Field of View (FOV)"
              value={
                features.fov
              }
              description={
                features.fovNotes
              }
            />

            <FeatureCard
              icon={Monitor}
              title="Windowed Mode"
              value={
                features.windowed
              }
              description={
                features.windowedNotes
              }
            />

            <FeatureCard
              icon={Monitor}
              title="Borderless Windowed"
              value={
                features.borderless
              }
              description={
                features.borderlessNotes
              }
            />

            <FeatureCard
              icon={Gauge}
              title="Anisotropic Filtering"
              value={
                features.anisotropic
              }
              description={
                features.anisotropicNotes
              }
            />

            <FeatureCard
              icon={Sparkles}
              title="Anti-Aliasing"
              value={
                features.antialiasing
              }
              description={
                features.antialiasingNotes
              }
            />

            <FeatureCard
              icon={WandSparkles}
              title="Upscaling"
              value={
                features.upscaling
              }
              description={
                combineFeatureDescription(
                  features.upscalingTech,
                  features.upscalingNotes
                )
              }
            />

            <FeatureCard
              icon={Gauge}
              title="Frame Generation"
              value={
                features.frameGeneration
              }
              description={
                combineFeatureDescription(
                  features.frameGenerationTech,
                  features.frameGenerationNotes
                )
              }
            />

            <FeatureCard
              icon={Monitor}
              title="Vsync"
              value={
                features.vsync
              }
              description={
                features.vsyncNotes
              }
            />

            <FeatureCard
              icon={Gauge}
              title="60 FPS"
              value={
                features.sixtyFps
              }
              description={
                features.sixtyFpsNotes
              }
            />

            <FeatureCard
              icon={Gauge}
              title="120+ FPS"
              value={
                features.oneTwentyFps
              }
              description={
                features.oneTwentyFpsNotes
              }
            />

            <FeatureCard
              icon={Sparkles}
              title="HDR"
              value={
                features.hdr
              }
              description={
                features.hdrNotes
              }
            />

            <FeatureCard
              icon={Sparkles}
              title="Ray Tracing"
              value={
                features.rayTracing
              }
              description={
                features.rayTracingNotes
              }
            />

            <FeatureCard
              icon={Monitor}
              title="Color Blind Mode"
              value={
                features.colorBlind
              }
              description={
                features.colorBlindNotes
              }
            />
          </div>


          <WsgfInfo
            features={
              features
            }
          />
        </section>


        {/* ====================================================
            CONTROLLERS
        ==================================================== */}

        <ControllerCompatibility
          game={
            game
          }
        />


        {/* ====================================================
            RENODX
        ==================================================== */}

        <section
  className="
    mb-10
    mt-10
  "
>
  <SectionHeader
    title="Mods & Enhancements"
    description="HDR enhancement and mod-management support available for this game."
  />

  <RenoDxCard
    game={
      game
    }
  />

  <VortexCard
    game={
      game
    }
  />

  <FluffyCard
    game={
      game
    }
  />
</section>


        {/* ====================================================
            NEW: ESSENTIAL IMPROVEMENTS
        ==================================================== */}

        <EssentialImprovements
          game={
            game
          }
        />


        {/* ====================================================
            TECHNICAL
        ==================================================== */}

        <section
          className="
            mb-10
          "
        >
          <SectionHeader
            title="Technical Information"
            description="Engine, graphics API, installation, configuration, and save data."
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
                game.technical
                  ?.configLocation
              }
            />

            <InfoRow
              icon={FolderOpen}
              label="Save Location"
              value={
                game.technical
                  ?.saveLocation
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


        {/* ====================================================
            PCGAMINGWIKI
        ==================================================== */}

        <section
          className="
            pb-10
          "
        >
          <SectionHeader
            title="PCGamingWiki"
            description={
              game.pcgwPageName
                ? `${game.pcgwPageName} matched to this installed game.`
                : "PCGamingWiki match information."
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