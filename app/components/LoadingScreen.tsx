"use client";
import { Loader2 } from "lucide-react";

export default function LoadingScreen() {
  return (
    <div className="absolute top-1/2 left-1/2 z--10 h-screen text-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-slate-900" />
    </div>
  );
}
