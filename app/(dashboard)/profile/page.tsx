"use client";

import { Suspense } from "react";
import ProfilePageInner from "./ProfileInner";

export default function ProfilePage() {
  return (
    <Suspense fallback={<div>Laster...</div>}>
      <ProfilePageInner />
    </Suspense>
  );
}
