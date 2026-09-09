export default function StoreBadge({ store }) {
  const styles = {
    Steam: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    Epic: "bg-zinc-400/10 text-zinc-300 border-zinc-400/20",
    GOG: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    Ubisoft: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-md border
        px-2 py-0.5 text-[10px] font-semibold uppercase
        tracking-wider
        ${styles[store] || styles.Steam}
      `}
    >
      {store}
    </span>
  );
}