"use client";

import { useAuth } from "@/context/AuthProvider";
import Link from "next/link";

export default function Home() {
  const { user } = useAuth();
  const isAuth = user;
  return (
    <div>
      <Link href={isAuth ? "/overview" : "/auth"}>Login</Link>
    </div>
  );
}
