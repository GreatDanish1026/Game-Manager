import {
  Cpu,
  ExternalLink,
  Gamepad2,
  Gauge,
  HardDrive,
  Maximize2,
  MonitorUp,
  Save,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";

import FeatureCard from "./FeatureCard";
import RenoDxCard from "./RenoDxCard";
import StoreBadge from "./StoreBadge";

function InfoItem({
  label,
  value,
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>

      <div className="mt-1 text-sm text-gray-200">
        {value || "Unknown"}
      </div>
    </div>
  );
}

function TechnicalCard({
  icon: Icon,
  title,
  value,
}) {
  return (
    <div
      className="
        rounded-xl
        border border-white/[0.06]
        bg-white/[0.025]
        p-4
      "
    >
      <div className="flex items-start gap-3">
        <div
          className="
            flex h-9 w-9
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-white/[0.05]
            text-gray-400
          "
        >
          <Icon
            size={18}
            strokeWidth={1.8}
          />
        </div>

        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {title}
          </div>

          <div
            className="
              mt-1
              break-words
              text-sm
              text-gray-200
            "
          >
            {value || "Unknown"}
          </div>
        </div>
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
          flex flex-1
          items-center
          justify-center
          overflow-hidden
          bg-[#090b10]
        "
      >
        <div className="max-w-md px-8 text-center">
          <div
            className="
              mx-auto
              flex h-16 w-16
              items-center
              justify-center
              rounded-2xl
              border border-white/[0.06]
              bg-white/[0.025]
              text-gray-500
            "
          >
            <Gamepad2
              size={30}
              strokeWidth={1.5}
            />
          </div>

          <h1 className="mt-5 text-2xl font-semibold text-white">
            Select a Game
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Choose an installed game from the library to view
            installation details and PCGamingWiki compatibility
            information.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="
        flex-1
        overflow-y-auto
        bg-[#090b10]
      "
    >
      <div className="mx-auto max-w-7xl px-8 py-8">
        <header
          className="
            mb-8
            flex
            items-start
            justify-between
            gap-6
          "
        >
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-3">
              <StoreBadge
                store={game.store}
              />

              {game.pcgwLoaded && !game.pcgwError && (
                <span
                  className="
                    rounded-full
                    border border-emerald-500/10
                    bg-emerald-500/[0.06]
                    px-2.5 py-1
                    text-[11px]
                    font-medium
                    text-emerald-400
                  "
                >
                  PCGamingWiki loaded
                </span>
              )}
            </div>

            <h1
              className="
                truncate
                text-3xl
                font-semibold
                tracking-tight
                text-white
              "
            >
              {game.name}
            </h1>

            <p
              className="
                mt-2
                max-w-3xl
                text-sm
                leading-6
                text-gray-500
              "
            >
              {game.description ||
                "Installed game information and PC compatibility details."}
            </p>
          </div>

          <button
            type="button"
            disabled={!game.pcgwPageUrl}
            onClick={() => {
              if (game.pcgwPageUrl) {
                window.open(
                  game.pcgwPageUrl,
                  "_blank"
                );
              }
            }}
            className="
              flex
              shrink-0
              items-center
              gap-2
              rounded-lg
              border border-white/[0.06]
              bg-white/[0.03]
              px-3
              py-2
              text-xs
              text-gray-400
              transition
              hover:bg-white/[0.06]
              hover:text-white
              disabled:cursor-not-allowed
              disabled:opacity-30
            "
          >
            <ExternalLink
              size={14}
            />

            PCGamingWiki
          </button>
        </header>

        {game.pcgwLoading && (
          <div
            className="
              mb-6
              rounded-xl
              border border-sky-500/10
              bg-sky-500/[0.05]
              px-4
              py-3
              text-sm
              text-sky-300
            "
          >
            Loading PCGamingWiki data...
          </div>
        )}

        {game.pcgwError && (
          <div
            className="
              mb-6
              rounded-xl
              border border-amber-500/10
              bg-amber-500/[0.05]
              px-4
              py-3
              text-sm
              text-amber-300
            "
          >
            {game.pcgwError}
          </div>
        )}

        <section
          className="
            mb-8
            rounded-2xl
            border border-white/[0.06]
            bg-white/[0.02]
            p-6
          "
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              Overview
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Basic game and installation information.
            </p>
          </div>

          <div
            className="
              grid
              grid-cols-1
              gap-6
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >
            <InfoItem
              label="Developer"
              value={game.developer}
            />

            <InfoItem
              label="Publisher"
              value={game.publisher}
            />

            <InfoItem
              label="Release Date"
              value={game.releaseDate}
            />

            <InfoItem
              label="Store"
              value={game.store}
            />
          </div>

          {game.genres &&
            game.genres.length > 0 && (
              <div className="mt-6">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Genres
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {game.genres.map(
                    (genre) => (
                      <span
                        key={genre}
                        className="
                          rounded-full
                          border border-white/[0.06]
                          bg-white/[0.04]
                          px-2.5
                          py-1
                          text-xs
                          text-gray-400
                        "
                      >
                        {genre}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
        </section>

        <section className="mb-8">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              PC Features
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Display, performance, and input support reported by
              PCGamingWiki.
            </p>
          </div>

          <div
            className="
              grid
              grid-cols-1
              gap-4
              sm:grid-cols-2
              lg:grid-cols-3
              xl:grid-cols-6
            "
          >
            <FeatureCard
              icon={Sun}
              title="HDR"
              supported={
                game.features?.hdr
              }
            />

            <FeatureCard
              icon={Maximize2}
              title="Ultrawide"
              supported={
                game.features
                  ?.ultrawide
              }
            />

            <FeatureCard
              icon={Gamepad2}
              title="Controller"
              supported={
                game.features
                  ?.controller
              }
            />

            <FeatureCard
              icon={Sparkles}
              title="Ray Tracing"
              supported={
                game.features
                  ?.rayTracing
              }
            />

            <FeatureCard
              icon={Gauge}
              title="Frame Generation"
              supported={
                game.features
                  ?.frameGeneration
              }
            />

            <FeatureCard
              icon={MonitorUp}
              title="Upscaling"
              supported={
                game.features
                  ?.upscaling
              }
            />
          </div>
        </section>

<section className="mb-8">
  <div className="mb-5">
    <h2 className="text-lg font-semibold text-white">
      Mods & Enhancements
    </h2>

    <p className="mt-1 text-sm text-gray-500">
      Compatibility with community graphics and HDR
      enhancements.
    </p>
  </div>

  <RenoDxCard
    game={game}
  />
</section>

        <section>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              Technical Information
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Engine, installation, configuration, and save-game
              locations.
            </p>
          </div>

          <div
            className="
              grid
              grid-cols-1
              gap-4
              md:grid-cols-2
              xl:grid-cols-3
            "
          >
            <TechnicalCard
              icon={Cpu}
              title="Engine"
              value={
                game.technical
                  ?.engine
              }
            />

            <TechnicalCard
              icon={MonitorUp}
              title="Graphics API"
              value={
                game.technical
                  ?.api
              }
            />

            <TechnicalCard
              icon={HardDrive}
              title="Install Location"
              value={
                game.installPath
              }
            />

            <TechnicalCard
              icon={Settings}
              title="Configuration Location"
              value={
                game.technical
                  ?.configLocation
              }
            />

            <TechnicalCard
              icon={Save}
              title="Save Location"
              value={
                game.technical
                  ?.saveLocation
              }
            />

            <TechnicalCard
              icon={Gamepad2}
              title="Launcher ID"
              value={
                game.launcherId
              }
            />
          </div>
        </section>

        {game.pcgwPageName && (
          <section
            className="
              mt-8
              rounded-xl
              border border-white/[0.06]
              bg-white/[0.02]
              px-4
              py-4
            "
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  PCGamingWiki Match
                </div>

                <div className="mt-1 text-sm text-gray-300">
                  {game.pcgwPageName}
                </div>
              </div>

              {game.pcgwPageUrl && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      game.pcgwPageUrl,
                      "_blank"
                    )
                  }
                  className="
                    flex
                    items-center
                    gap-2
                    rounded-lg
                    border border-white/[0.06]
                    bg-white/[0.03]
                    px-3
                    py-2
                    text-xs
                    text-gray-400
                    transition
                    hover:bg-white/[0.06]
                    hover:text-white
                  "
                >
                  <ExternalLink
                    size={14}
                  />

                  Open Page
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}