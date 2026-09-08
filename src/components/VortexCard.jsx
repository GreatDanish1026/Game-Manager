import {
  Check,
  ExternalLink,
  Loader2,
  PackageOpen,
  Puzzle,
  X,
} from "lucide-react";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";


function SupportBadge({
  supported,
  loading,
}) {
  if (loading) {
    return (
      <div
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          border
          border-white/10
          bg-white/[0.04]
          px-2.5
          py-1
          text-xs
          font-semibold
          text-white/45
        "
      >
        <Loader2
          className="
            h-3.5
            w-3.5
            animate-spin
          "
        />

        Checking
      </div>
    );
  }


  if (supported) {
    return (
      <div
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          border
          border-emerald-500/30
          bg-emerald-500/10
          px-2.5
          py-1
          text-xs
          font-semibold
          text-emerald-300
        "
      >
        <Check
          className="h-3.5 w-3.5"
        />

        Supported
      </div>
    );
  }


  return (
    <div
      className="
        inline-flex
        items-center
        gap-1.5
        rounded-full
        border
        border-white/10
        bg-white/[0.04]
        px-2.5
        py-1
        text-xs
        font-semibold
        text-white/40
      "
    >
      <X
        className="h-3.5 w-3.5"
      />

      Not Detected
    </div>
  );
}


function supportTypeLabel(
  supportType
) {
  switch (supportType) {
    case "built_in":
      return "Built-in Vortex Support";

    case "extension":
      return "Vortex Game Extension";

    default:
      return "Unknown";
  }
}


export default function VortexCard({
  game,
}) {
  const vortex =
    game?.vortex ?? {
      supported: false,
    };


  async function handleOpenPage() {
    if (!vortex?.pageUrl) {
      return;
    }


    try {
      await openUrl(
        vortex.pageUrl
      );
    } catch (error) {
      console.error(
        "[Vortex] Failed to open support page:",
        error
      );
    }
  }


  return (
    <div
      className="
        mt-4
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
          lg:items-start
          lg:justify-between
        "
      >
        <div
          className="
            flex
            items-start
            gap-4
          "
        >
          <div
            className="
              flex
              h-12
              w-12
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-orange-500/10
              text-orange-300
            "
          >
            <Puzzle
              className="h-6 w-6"
            />
          </div>


          <div>
            <h3
              className="
                text-base
                font-semibold
                text-white
              "
            >
              Vortex Mod Manager
            </h3>

            <p
              className="
                mt-1
                max-w-2xl
                text-sm
                leading-relaxed
                text-white/40
              "
            >
              Checks whether Vortex has
              game-management support for
              this title.
            </p>
          </div>
        </div>


        <SupportBadge
          supported={
            vortex.supported
          }
          loading={
            game?.vortexLoading
          }
        />
      </div>


      {game?.vortexError ? (
        <div
          className="
            mt-5
            rounded-lg
            border
            border-red-500/20
            bg-red-500/[0.06]
            px-4
            py-3
            text-sm
            text-red-300
          "
        >
          {game.vortexError}
        </div>
      ) : null}


      {!game?.vortexLoading &&
      !game?.vortexError ? (
        vortex.supported ? (
          <div
            className="
              mt-5
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
                items-start
                gap-3
              "
            >
              <div
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-emerald-500/10
                  text-emerald-300
                "
              >
                <PackageOpen
                  className="h-4 w-4"
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
                    text-sm
                    font-semibold
                    text-white
                  "
                >
                  {
                    vortex.extensionName ??
                    vortex.matchedGameName ??
                    "Vortex Support"
                  }
                </div>


                <div
                  className="
                    mt-1
                    text-xs
                    font-medium
                    text-emerald-300/80
                  "
                >
                  {
                    supportTypeLabel(
                      vortex.supportType
                    )
                  }
                </div>


                {vortex.matchedGameName ? (
                  <div
                    className="
                      mt-3
                      text-xs
                      text-white/40
                    "
                  >
                    Matched Game:{" "}

                    <span
                      className="
                        text-white/65
                      "
                    >
                      {
                        vortex.matchedGameName
                      }
                    </span>
                  </div>
                ) : null}


                {vortex.author ? (
                  <div
                    className="
                      mt-1
                      text-xs
                      text-white/40
                    "
                  >
                    Author:{" "}

                    <span
                      className="
                        text-white/65
                      "
                    >
                      {vortex.author}
                    </span>
                  </div>
                ) : null}


                {vortex.version ? (
                  <div
                    className="
                      mt-1
                      text-xs
                      text-white/40
                    "
                  >
                    Extension Version:{" "}

                    <span
                      className="
                        text-white/65
                      "
                    >
                      {vortex.version}
                    </span>
                  </div>
                ) : null}


                {vortex.description ? (
                  <div
                    className="
                      mt-3
                      text-xs
                      leading-relaxed
                      text-white/50
                    "
                  >
                    {vortex.description}
                  </div>
                ) : null}
              </div>
            </div>


            {vortex.pageUrl ? (
              <div
                className="
                  mt-4
                  flex
                  flex-wrap
                  gap-2
                "
              >
                <button
                  type="button"
                  onClick={
                    handleOpenPage
                  }
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    border
                    border-orange-500/20
                    bg-orange-500/[0.07]
                    px-3
                    py-2
                    text-xs
                    font-medium
                    text-orange-200
                    transition
                    hover:border-orange-500/30
                    hover:bg-orange-500/10
                  "
                >
                  <ExternalLink
                    className="h-3.5 w-3.5"
                  />

                  {
                    vortex.supportType ===
                    "extension"
                      ? "View Extension"
                      : "View Vortex Support"
                  }
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className="
              mt-5
              flex
              items-center
              gap-4
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
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-lg
                bg-white/[0.04]
                text-white/30
              "
            >
              <X
                className="h-4 w-4"
              />
            </div>


            <div>
              <div
                className="
                  text-sm
                  font-medium
                  text-white/60
                "
              >
                No Vortex game extension detected
              </div>

              <div
                className="
                  mt-1
                  text-xs
                  leading-relaxed
                  text-white/35
                "
              >
                Game Manager did not find
                this title in the Vortex game
                extension manifest.
              </div>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}