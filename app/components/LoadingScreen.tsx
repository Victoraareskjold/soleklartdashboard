"use client";

export default function LoadingScreen() {
  return (
    <div className="flex min-h-[70vh] w-full flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="relative flex size-10 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-orange-300/40" />
          <span className="size-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_0_24px_rgba(250,163,26,0.55)]" />
        </span>
        <p className="text-xs font-medium text-muted">Laster…</p>
      </div>
    </div>
  );
}
