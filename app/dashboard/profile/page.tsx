"use client";

import { Suspense } from "react";
import ProfilePageInner from "./ProfileInner";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="sk-page text-sm text-muted">Laster...</div>
      }
    >
      <ProfilePageInner />
    </Suspense>
  );
}
