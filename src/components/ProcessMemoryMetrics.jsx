const formatMemory = (bytes) => bytes == null
  ? "Not reported"
  : `${Math.round(bytes / 1048576).toLocaleString()} MiB`;

export default function ProcessMemoryMetrics({ row, showShared = false }) {
  return <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[15rem]" aria-label={`VRAM ${formatMemory(row.dedicatedBytes)}, RAM ${formatMemory(row.ramBytes)}`}>
    <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] px-2.5 py-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-cyan-200/75">VRAM</span>
      <span className="block whitespace-nowrap text-sm font-semibold tabular-nums text-cyan-100">{formatMemory(row.dedicatedBytes)}</span>
    </div>
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/55">RAM</span>
      <span className="block whitespace-nowrap text-sm font-semibold tabular-nums text-white/90">{formatMemory(row.ramBytes)}</span>
    </div>
    <span className="col-span-2 truncate text-[11px] text-white/45" title={row.gpuLabel ?? "GPU not identified"}>
      {row.gpuLabel ?? "GPU not identified"}{showShared ? ` · Shared GPU: ${formatMemory(row.sharedBytes)}` : ""}
    </span>
  </div>;
}
