type TopBarProps = {
  title: string | null;
  version: number | null;
  /** e.g. "Writing your video plan…" or "Ready". */
  status: string | null;
  running: boolean;
  canStartOver: boolean;
  onStartOver: () => void;
};

export function TopBar({
  title,
  version,
  status,
  running,
  canStartOver,
  onStartOver,
}: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-4">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <span
          aria-hidden="true"
          className="size-5 rounded-md bg-linear-to-br from-indigo-400 to-violet-500"
        />
        promptMotion
      </div>

      <div className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
        <span className="truncate text-zinc-300">{title ?? "Untitled video"}</span>
        {version ? (
          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
            v{version}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        {status ? (
          <span className="flex items-center gap-1.5 text-xs text-zinc-400" role="status">
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${running ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`}
            />
            <span className="hidden sm:inline">{status}</span>
          </span>
        ) : null}
        <button
          type="button"
          onClick={onStartOver}
          disabled={!canStartOver}
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          New video
        </button>
      </div>
    </header>
  );
}
