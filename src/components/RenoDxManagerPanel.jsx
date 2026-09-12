import {
  useEffect,
  useState,
} from "react";

import {
  getRenoDxReadiness,
} from "../services/renodxManager";

import {
  downloadReShadeAddonInstaller,
  getReShadeAddonInstallerInfo,
  installReShadeAddonsForCurrentPlatform,
} from "../services/reshadeManager";

import {
  getRenoDxPackageInfo,
  installRenoDxPackageLinux,
  uninstallRenoDxPackageLinux,
  getLatestRenoDxBackup,
  restoreLatestRenoDxBackupLinux,
  getRenoDxUpdateStatusLinux,
} from "../services/renodxInstaller";

function badgeClass(state) {
  switch (state) {
    case "supported":
    case "installed":
    case "confirmed":
    case "ready-for-renodx":
      return "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-100/70";
    case "partial":
    case "unknown":
    case "verify-addon-support":
    case "reshade-needs-attention":
      return "border-amber-400/20 bg-amber-400/[0.06] text-amber-100/70";
    case "not-supported":
    case "unsupported":
      return "border-white/[0.08] bg-white/[0.025] text-white/35";
    default:
      return "border-cyan-400/15 bg-cyan-400/[0.04] text-cyan-100/60";
  }
}

function StatusRow({
  label,
  value,
  state,
}) {
return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
      <div className="text-[11px] text-white/45">
        {label}
      </div>

      <div
        className={
          `rounded-md border px-2 py-1 text-[10px] font-semibold ${badgeClass(
            state ?? value
          )}`
        }
      >
        {value}
      </div>
    </div>
  );
}

export default function RenoDxManagerPanel({
  game,
}) {
  const [
    state,
    setState,
  ] = useState({
    loading: false,
    error: null,
    message: null,
    installDetails: null,
    data: null,
  });

  const [
    installer,
    setInstaller,
  ] = useState({
    loading: false,
    installing: false,
    info: null,
    error: null,
  });

  const [renodxPackage, setRenoDxPackage] = useState({ loading: false, installing: false, uninstalling: false, info: null, error: null });


  const [renodxBackup, setRenoDxBackup] = useState({
    loading: false,
    restoring: false,
    info: null,
    error: null,
  });


  const [renodxUpdate, setRenoDxUpdate] = useState({
    loading: false,
    info: null,
    error: null,
  });

  async function refreshRenoDxUpdate(
    readiness
  ) {
    if (
      !readiness?.supported
      || !readiness?.binaryDirectory
    ) {
      setRenoDxUpdate({
        loading: false,
        info: null,
        error: null,
      });

      return null;
    }

    if (
      readiness?.renodxState
      !== "installed"
    ) {
      const info = {
        checked: true,
        state: "not-installed",
        message:
          "RenoDX is not currently installed.",
      };

      setRenoDxUpdate({
        loading: false,
        info,
        error: null,
      });

      return info;
    }

    setRenoDxUpdate(
      (current) => ({
        ...current,
        loading: true,
        error: null,
      })
    );

    try {
      const info =
        await getRenoDxUpdateStatusLinux(
          game,
          readiness
        );

      setRenoDxUpdate({
        loading: false,
        info,
        error: null,
      });

      return info;
    } catch (error) {
      setRenoDxUpdate({
        loading: false,
        info: null,
        error: String(error),
      });

      return null;
    }
  }


  async function refreshBackup() {
    setRenoDxBackup(
      (current) => ({
        ...current,
        loading: true,
        error: null,
      })
    );

    try {
      const info =
        await getLatestRenoDxBackup(
          game
        );

      setRenoDxBackup(
        (current) => ({
          ...current,
          loading: false,
          info,
          error: null,
        })
      );

      return info;
    } catch (error) {
      setRenoDxBackup(
        (current) => ({
          ...current,
          loading: false,
          error: String(error),
        })
      );

      return null;
    }
  }


  async function refreshRenoDxPackage(readiness) {
    if (!readiness?.supported || !readiness?.binaryDirectory) return;
    setRenoDxPackage((current) => ({ ...current, loading: true, error: null }));
    try {
      const info = await getRenoDxPackageInfo(game, readiness);
      setRenoDxPackage((current) => ({ ...current, loading: false, info, error: null }));
    } catch (error) {
      setRenoDxPackage((current) => ({ ...current, loading: false, error: String(error) }));
    }
  }

  async function refresh() {
    setState(
      (current) => ({
        ...current,
        loading: true,
        error: null,
      })
    );

    try {
      const data =
        await getRenoDxReadiness(game);

      setState(
        (current) => ({
          ...current,
          loading: false,
          data,
          error: null,
        })
      );

      return data;
    } catch (error) {
      setState(
        (current) => ({
          ...current,
          loading: false,
          error: String(error),
        })
      );

      throw error;
    }
  }

  useEffect(
    () => {
      refresh()
        .then(
          (readiness) => {
            refreshRenoDxPackage(
              readiness
            );

            refreshRenoDxUpdate(
              readiness
            );
          }
        );
      refreshBackup();

      getReShadeAddonInstallerInfo()
        .then(
          (info) =>
            setInstaller(
              (current) => ({
                ...current,
                info,
                error: null,
              })
            )
        )
        .catch(
          (error) =>
            setInstaller(
              (current) => ({
                ...current,
                error: String(error),
              })
            )
        );
    },
    [
      game?.id,
      game?.installPath,
      game?.renodx?.renodx?.available,
    ]
  );

  const data =
    state.data;

  const busy =
    installer.loading
    || installer.installing;

  async function installReShade() {
    if (
      !window.confirm(
        [
          "Install ReShade with full add-on support?",
          "",
          `Target: ${data?.executablePath ?? "Unknown"}`,
          "",
          "GameAtlas will back up an existing target loader before replacing it.",
        ].join("\n")
      )
    ) {
      return;
    }

    setInstaller(
      (current) => ({
        ...current,
        loading: true,
        error: null,
      })
    );

    setState(
      (current) => ({
        ...current,
        message: null,
        installDetails: null,
      })
    );

    try {
      const download =
        await downloadReShadeAddonInstaller();

      setInstaller(
        (current) => ({
          ...current,
          loading: false,
          installing: true,
        })
      );

      const result =
        await installReShadeAddonsForCurrentPlatform({
          installerPath:
            download.installerPath,
          game,
          readiness:
            data,
        });

      setInstaller(
        (current) => ({
          ...current,
          installing: false,
          error: null,
        })
      );

      setState(
        (current) => ({
          ...current,
          message:
            result.message,
          installDetails:
            result,
        })
      );

      await refresh();
    } catch (error) {
      setInstaller(
        (current) => ({
          ...current,
          loading: false,
          installing: false,
          error: String(error),
        })
      );
    }
  }

  const canInstall =
    Boolean(
      data?.supported
      && data?.executablePath
      && data?.reshadeState !== "installed"
    );

  async function installRenoDx() {
    if (!data?.binaryDirectory) {
      return;
    }

    const packageName =
      renodxPackage?.info?.assetName
      ?? "RenoDX addon";

    if (
      !window.confirm(
        [
          `${data?.renodxState === "installed" ? "Update" : "Install"} RenoDX?`,
          "",
          `Package: ${packageName}`,
          `Target: ${data.binaryDirectory}`,
          "",
          "An existing same-named RenoDX file will be backed up before replacement.",
        ].join("\n")
      )
    ) {
      return;
    }

    setRenoDxPackage(
      (current) => ({
        ...current,
        installing: true,
        error: null,
      })
    );

    try {
      const result =
        await installRenoDxPackageLinux(
          game,
          data
        );

      setState(
        (current) => ({
          ...current,
          message: result.message,
          renodxInstallDetails: result,
        })
      );

      const readiness =
        await refresh();

      await refreshRenoDxPackage(
        readiness
      );

      await refreshRenoDxUpdate(
        readiness
      );

      await refreshBackup();
    } catch (error) {
      setRenoDxPackage(
        (current) => ({
          ...current,
          error: String(error),
        })
      );
    } finally {
      setRenoDxPackage(
        (current) => ({
          ...current,
          installing: false,
        })
      );
    }
  }

  async function uninstallRenoDx() {
    const assetName =
      data?.renodxFiles?.[0]?.name
      ?? null;

    if (
      !data?.binaryDirectory
      || !assetName
      || data?.renodxState !== "installed"
    ) {
      return;
    }

    if (
      !window.confirm(
        [
          "Uninstall RenoDX?",
          "",
          `Package: ${assetName}`,
          `Target: ${data.binaryDirectory}`,
          "",
          "GameAtlas will back up the RenoDX add-on before removing it.",
          "ReShade will not be removed.",
        ].join("\n")
      )
    ) {
      return;
    }

    setRenoDxPackage(
      (current) => ({
        ...current,
        uninstalling: true,
        error: null,
      })
    );

    try {
      const result =
        await uninstallRenoDxPackageLinux(
          game,
          data,
          {
            assetName,
          }
        );

      setState(
        (current) => ({
          ...current,
          message: result.message,
          renodxUninstallDetails: result,
        })
      );

      const readiness =
        await refresh();

      await refreshRenoDxPackage(
        readiness
      );

      await refreshRenoDxUpdate(
        readiness
      );

      await refreshBackup();
    } catch (error) {
      setRenoDxPackage(
        (current) => ({
          ...current,
          error: String(error),
        })
      );
    } finally {
      setRenoDxPackage(
        (current) => ({
          ...current,
          uninstalling: false,
        })
      );
    }
  }

  async function restorePreviousRenoDx() {
    if (
      !data?.binaryDirectory
      || !renodxBackup?.info?.found
    ) {
      return;
    }

    const backupName =
      renodxBackup?.info?.assetName
      ?? "previous RenoDX backup";

    if (
      !window.confirm(
        [
          "Restore previous RenoDX backup?",
          "",
          `Backup: ${backupName}`,
          `Target: ${data.binaryDirectory}`,
          "",
          "If RenoDX is currently installed, GameAtlas will back it up before restoring the previous copy.",
          "ReShade will not be changed.",
        ].join("\n")
      )
    ) {
      return;
    }

    setRenoDxBackup(
      (current) => ({
        ...current,
        restoring: true,
        error: null,
      })
    );

    try {
      const result =
        await restoreLatestRenoDxBackupLinux(
          game,
          data
        );

      setState(
        (current) => ({
          ...current,
          message: result.message,
          renodxRestoreDetails: result,
        })
      );

      const readiness =
        await refresh();

      await refreshRenoDxPackage(
        readiness
      );

      await refreshRenoDxUpdate(
        readiness
      );

      await refreshBackup();
    } catch (error) {
      setRenoDxBackup(
        (current) => ({
          ...current,
          error: String(error),
        })
      );
    } finally {
      setRenoDxBackup(
        (current) => ({
          ...current,
          restoring: false,
        })
      );
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.025] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/85">
            RenoDX Manager
          </div>

          <div className="mt-1 text-[11px] text-white/35">
            ReShade prerequisite and RenoDX readiness.
          </div>
        </div>

        <button
          type="button"
          onClick={
            refresh
          }
          disabled={
            state.loading
            || busy
          }
          className="rounded-lg border border-white/[0.09] bg-white/[0.025] px-3 py-1.5 text-[11px] text-white/55 disabled:opacity-30"
        >
          Refresh
        </button>
      </div>

      {data ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            <StatusRow
              label="RenoDX support"
              value={
                data.supported
                  ? "Supported"
                  : "Not supported"
              }
              state={
                data.supportStatus
              }
            />

            <StatusRow
              label="Architecture"
              value={
                data.architecture
              }
            />

            <StatusRow
              label="ReShade"
              value={
                data.reshadeState
              }
              state={
                data.reshadeState
              }
            />

            <StatusRow
              label="Add-on support"
              value={
                data.addonSupportState
              }
              state={
                data.addonSupportState
              }
            />

            <StatusRow
              label="RenoDX"
              value={
                data.renodxState
              }
              state={
                data.renodxState
              }
            />

            <StatusRow
              label="Readiness"
              value={
                data.readiness
              }
              state={
                data.readiness
              }
            />
          </div>

          <div className="mt-3 break-all text-[10px] text-white/35">
            <span className="text-white/20">
              Target:
            </span>{" "}
            {data.executablePath ?? "Not detected"}
          </div>

          {installer.info?.version ? (
            <div className="mt-1 text-[10px] text-white/35">
              <span className="text-white/20">
                ReShade:
              </span>{" "}
              {installer.info.version} full add-on build
            </div>
          ) : null}

          {renodxPackage.info?.releaseTag ? (<div className="mt-2 text-[10px] text-white/35"><span className="text-white/20">RenoDX build:</span>{" "}{renodxPackage.info.releaseTag}{renodxPackage.info.assetName ? ` · ${renodxPackage.info.assetName}` : ""}</div>) : null}

          {renodxBackup.info?.found ? (
            <div className="mt-1 text-[10px] text-white/35">
              <span className="text-white/20">
                Previous backup:
              </span>{" "}
              {renodxBackup.info.assetName}
            </div>
          ) : null}

          {data?.renodxState === "installed" ? (
            <div className="mt-1 text-[10px] text-white/35">
              <span className="text-white/20">
                RenoDX update:
              </span>{" "}
              {renodxUpdate.loading
                ? "Checking current official build..."
                : renodxUpdate.info?.state === "up-to-date"
                  ? "Up to date"
                  : renodxUpdate.info?.state === "update-available"
                    ? "Update available"
                    : renodxUpdate.error
                      ? "Check failed"
                      : "Not checked"}
            </div>
          ) : null}
          {renodxPackage.info && !renodxPackage.info.found ? (<div className="mt-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2 text-[10px] leading-relaxed text-amber-100/60">{renodxPackage.info.message}</div>) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                !canInstall
                || busy
              }
              onClick={
                installReShade
              }
              className="rounded-lg border border-violet-400/20 bg-violet-400/[0.08] px-3 py-2 text-xs font-semibold text-violet-100/75 disabled:opacity-30"
            >
              {installer.loading
                ? "Downloading ReShade..."
                : installer.installing
                  ? "Installing & Verifying..."
                  : data.reshadeState === "installed"
                    ? "ReShade Installed"
                    : "Install ReShade with Add-ons"}
            </button>

            <button
              type="button"
              disabled={
                !(
                  data?.supported
                  && data?.binaryDirectory
                  && data?.reshadeState === "installed"
                  && renodxPackage?.info?.found
                )
                || renodxPackage.installing
                || renodxPackage.loading
                || renodxUpdate.loading
                || (
                  data?.renodxState === "installed"
                  && renodxUpdate.info?.state === "up-to-date"
                )
              }
              onClick={installRenoDx}
              className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-2 text-xs font-semibold text-emerald-100/75 disabled:opacity-30"
            >
              {renodxPackage.installing
                ? "Installing RenoDX..."
                : renodxUpdate.loading
                  ? "Checking RenoDX..."
                  : data?.renodxState !== "installed"
                    ? "Install RenoDX"
                    : renodxUpdate.info?.state === "up-to-date"
                      ? "RenoDX Up to Date"
                      : "Update RenoDX"}
            </button>

            <button
              type="button"
              disabled={
                data?.renodxState !== "installed"
                || !data?.binaryDirectory
                || !data?.renodxFiles?.[0]?.name
                || renodxPackage.installing
                || renodxPackage.uninstalling
                || renodxPackage.loading
              }
              onClick={uninstallRenoDx}
              className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-xs font-semibold text-red-100/70 disabled:opacity-30"
            >
              {renodxPackage.uninstalling
                ? "Uninstalling RenoDX..."
                : "Uninstall RenoDX"}
            </button>

            <button
              type="button"
              disabled={
                !data?.binaryDirectory
                || !renodxBackup?.info?.found
                || renodxBackup.loading
                || renodxBackup.restoring
                || renodxPackage.installing
                || renodxPackage.uninstalling
              }
              onClick={restorePreviousRenoDx}
              className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-xs font-semibold text-cyan-100/70 disabled:opacity-30"
            >
              {renodxBackup.restoring
                ? "Restoring RenoDX..."
                : "Restore Previous RenoDX"}
            </button>
          </div>
        </>
      ) : null}

      {state.installDetails ? (
        <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-2 text-[10px] text-emerald-100/65">
          <div className="font-semibold">
            Verified installation
          </div>

          <div className="mt-1 break-all">
            Loader: {state.installDetails.loaderPath}
          </div>

          <div className="mt-1">
            Size: {state.installDetails.loaderSizeBytes} bytes
          </div>

          <div className="mt-1 break-all">
            INI: {state.installDetails.reshadeIniPath}
          </div>
        </div>
      ) : null}

      {state.message ? (
        <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-2 text-[11px] text-emerald-100/60">
          {state.message}
        </div>
      ) : null}

      {installer.error ? (
        <div className="mt-3 whitespace-pre-wrap rounded-lg border border-red-400/15 bg-red-400/[0.04] px-3 py-2 text-xs text-red-100/65">
          {installer.error}
        </div>
      ) : null}

      {renodxPackage.error ? (<div className="mt-3 whitespace-pre-wrap rounded-lg border border-red-400/15 bg-red-400/[0.04] px-3 py-2 text-xs text-red-100/65">{renodxPackage.error}</div>) : null}

      {renodxBackup.error ? (
        <div className="mt-3 whitespace-pre-wrap rounded-lg border border-red-400/15 bg-red-400/[0.04] px-3 py-2 text-xs text-red-100/65">
          {renodxBackup.error}
        </div>
      ) : null}

      {renodxUpdate.error ? (
        <div className="mt-3 whitespace-pre-wrap rounded-lg border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2 text-xs text-amber-100/65">
          RenoDX update check failed: {renodxUpdate.error}
        </div>
      ) : null}

      {state.error ? (
        <div className="mt-3 rounded-lg border border-red-400/15 bg-red-400/[0.04] px-3 py-2 text-xs text-red-100/65">
          {state.error}
        </div>
      ) : null}
    </div>
  );
}
