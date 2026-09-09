import {
  RotateCcw,
  Save,
  Settings2,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  clearLibraryOverride,
  getLibraryOverride,
  setLibraryOverride,
} from "../services/libraryOverrides";


const STORE_OPTIONS = [
  {
    value:
      "",

    label:
      "Use detected store",
  },
  {
    value:
      "Steam",

    label:
      "Steam",
  },
  {
    value:
      "Epic Games",

    label:
      "Epic Games",
  },
  {
    value:
      "EA App",

    label:
      "EA App",
  },
  {
    value:
      "GOG Galaxy",

    label:
      "GOG Galaxy",
  },
  {
    value:
      "Ubisoft Connect",

    label:
      "Ubisoft Connect",
  },
];


function fieldValue(
  override,
  key
) {
  return String(
    override?.[
      key
    ]
    ?? ""
  );
}


export default function LibraryEntryEditor({
  game,
}) {
  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    name,
    setName,
  ] =
    useState("");

  const [
    store,
    setStore,
  ] =
    useState("");

  const [
    launcherId,
    setLauncherId,
  ] =
    useState("");

  const [
    installPath,
    setInstallPath,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState(null);


  function loadCurrent() {
    const override =
      getLibraryOverride(
        game
      );

    setName(
      fieldValue(
        override,
        "name"
      )
    );

    setStore(
      fieldValue(
        override,
        "store"
      )
    );

    setLauncherId(
      fieldValue(
        override,
        "launcherId"
      )
    );

    setInstallPath(
      fieldValue(
        override,
        "installPath"
      )
    );
  }


  useEffect(
    () => {
      loadCurrent();
      setMessage(
        null
      );
    },
    [
      game?.id,
    ]
  );


  function save() {
    setLibraryOverride(
      game,
      {
        name,
        store,
        launcherId,
        installPath,
      }
    );

    setMessage(
      "Library override saved."
    );
  }


  function reset() {
    const confirmed =
      window.confirm(
        "Remove all library overrides for this game and return to detected values?"
      );

    if (!confirmed) {
      return;
    }

    clearLibraryOverride(
      game
    );

    loadCurrent();

    setMessage(
      "Detected library values restored."
    );
  }


  const hasOverride =
    Boolean(
      getLibraryOverride(
        game
      )
    );


  return (
    <div
      className="
        rounded-xl
        border
        border-white/[0.08]
        bg-black/10
      "
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
        className="
          flex
          w-full
          items-center
          justify-between
          gap-3
          px-4
          py-3
          text-left
        "
      >
        <div
          className="
            flex
            min-w-0
            items-center
            gap-3
          "
        >
          <Settings2
            className="
              h-4
              w-4
              shrink-0
              text-cyan-300/60
            "
          />

          <div>
            <div
              className="
                text-xs
                font-semibold
                text-white/65
              "
            >
              Library Entry Override
            </div>

            <div
              className="
                mt-0.5
                text-[10px]
                text-white/28
              "
            >
              Correct a detected name, store, launcher ID, or install path.
            </div>
          </div>
        </div>

        <span
          className="
            shrink-0
            rounded-full
            bg-white/[0.04]
            px-2
            py-1
            text-[9px]
            font-semibold
            uppercase
            tracking-wide
            text-white/30
          "
        >
          {hasOverride
            ? "Customized"
            : "Detected"}
        </span>
      </button>

      {open ? (
        <div
          className="
            border-t
            border-white/[0.06]
            p-4
          "
        >
          <div
            className="
              grid
              grid-cols-1
              gap-3
              lg:grid-cols-2
            "
          >
            <label>
              <div
                className="
                  mb-1
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-white/30
                "
              >
                Display Name
              </div>

              <input
                value={
                  name
                }
                onChange={
                  (event) =>
                    setName(
                      event.target.value
                    )
                }
                placeholder={
                  game.name
                }
                className="
                  w-full
                  rounded-lg
                  border
                  border-white/[0.08]
                  bg-[#111823]
                  px-3
                  py-2
                  text-xs
                  text-white/65
                  outline-none
                  placeholder:text-white/20
                  focus:border-cyan-500/25
                "
              />
            </label>

            <label>
              <div
                className="
                  mb-1
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-white/30
                "
              >
                Store / Launcher
              </div>

              <select
                value={
                  store
                }
                onChange={
                  (event) =>
                    setStore(
                      event.target.value
                    )
                }
                className="
                  w-full
                  rounded-lg
                  border
                  border-white/[0.08]
                  bg-[#111823]
                  px-3
                  py-2
                  text-xs
                  text-white/65
                  outline-none
                "
              >
                {STORE_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                        || "detected"
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <div
                className="
                  mb-1
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-white/30
                "
              >
                Launcher ID
              </div>

              <input
                value={
                  launcherId
                }
                onChange={
                  (event) =>
                    setLauncherId(
                      event.target.value
                    )
                }
                placeholder={
                  game.launcherId
                  || "Detected launcher ID"
                }
                className="
                  w-full
                  rounded-lg
                  border
                  border-white/[0.08]
                  bg-[#111823]
                  px-3
                  py-2
                  text-xs
                  text-white/65
                  outline-none
                  placeholder:text-white/20
                  focus:border-cyan-500/25
                "
              />
            </label>

            <label>
              <div
                className="
                  mb-1
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-white/30
                "
              >
                Install Path
              </div>

              <input
                value={
                  installPath
                }
                onChange={
                  (event) =>
                    setInstallPath(
                      event.target.value
                    )
                }
                placeholder={
                  game.installPath
                  || "Detected install path"
                }
                className="
                  w-full
                  rounded-lg
                  border
                  border-white/[0.08]
                  bg-[#111823]
                  px-3
                  py-2
                  text-xs
                  text-white/65
                  outline-none
                  placeholder:text-white/20
                  focus:border-cyan-500/25
                "
              />
            </label>
          </div>

          <div
            className="
              mt-4
              flex
              flex-col
              gap-2
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div
              className="
                text-[10px]
                leading-relaxed
                text-white/25
              "
            >
              Leave a field blank to keep GameAtlas&apos;s detected value.
            </div>

            <div
              className="
                flex
                flex-wrap
                gap-2
              "
            >
              <button
                type="button"
                onClick={
                  reset
                }
                disabled={
                  !hasOverride
                }
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  border
                  border-white/[0.08]
                  bg-white/[0.025]
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-white/45
                  transition
                  hover:bg-white/[0.06]
                  disabled:opacity-25
                "
              >
                <RotateCcw
                  className="h-3.5 w-3.5"
                />

                Restore Detected
              </button>

              <button
                type="button"
                onClick={
                  save
                }
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  border
                  border-cyan-500/20
                  bg-cyan-500/[0.07]
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-cyan-100/70
                  transition
                  hover:bg-cyan-500/[0.12]
                "
              >
                <Save
                  className="h-3.5 w-3.5"
                />

                Save Override
              </button>
            </div>
          </div>

          {message ? (
            <div
              className="
                mt-3
                rounded-lg
                border
                border-emerald-500/10
                bg-emerald-500/[0.03]
                px-3
                py-2
                text-[10px]
                text-emerald-200/60
              "
            >
              {message}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
