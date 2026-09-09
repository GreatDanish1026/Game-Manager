import {
  Check,
  ExternalLink,
  Loader2,
  PackageOpen,
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


export default function FluffyCard({
  game,
}) {
  const fluffy =
    game?.fluffy ?? {
      supported: false,
    };


  async function handleOpenPage() {
    if (!fluffy?.pageUrl) {
      return;
    }


    try {
      await openUrl(
        fluffy.pageUrl
      );
    } catch (error) {
      console.error(
        "[Fluffy] Failed to open page:",
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
              bg-violet-500/10
              text-violet-300
            "
          >
            <PackageOpen
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
              Fluffy Mod Manager
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
              Checks whether this title is known
              to be supported by Fluffy Mod Manager.
            </p>
          </div>
        </div>


        <SupportBadge
          supported={
            fluffy.supported
          }
          loading={
            game?.fluffyLoading
          }
        />
      </div>


      {game?.fluffyError ? (
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
          {game.fluffyError}
        </div>
      ) : null}


      {!game?.fluffyLoading &&
      !game?.fluffyError ? (
        fluffy.supported ? (
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
                <Check
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
                  Fluffy Mod Manager Support
                </div>


                {fluffy.matchedGameName ? (
                  <div
                    className="
                      mt-2
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
                      {fluffy.matchedGameName}
                    </span>
                  </div>
                ) : null}


                {fluffy.notes ? (
                  <div
                    className="
                      mt-3
                      text-xs
                      leading-relaxed
                      text-white/50
                    "
                  >
                    {fluffy.notes}
                  </div>
                ) : null}
              </div>
            </div>


            {fluffy.pageUrl ? (
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
                    border-violet-500/20
                    bg-violet-500/[0.07]
                    px-3
                    py-2
                    text-xs
                    font-medium
                    text-violet-200
                    transition
                    hover:border-violet-500/30
                    hover:bg-violet-500/10
                  "
                >
                  <ExternalLink
                    className="h-3.5 w-3.5"
                  />

                  View Fluffy Mod Manager
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
                No Fluffy support detected
              </div>

              <div
                className="
                  mt-1
                  text-xs
                  leading-relaxed
                  text-white/35
                "
              >
                Game Manager did not find this title
                in its known Fluffy Mod Manager
                compatibility list.
              </div>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
