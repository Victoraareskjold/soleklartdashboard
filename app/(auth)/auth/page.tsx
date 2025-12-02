"use client";

import LoadingScreen from "@/app/components/LoadingScreen";

import AuthPageContent from "./AuthPageContent";
import { Suspense } from "react";

export default function AuthPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthPageContent />
    </Suspense>
  );
}
