"use client";

import { useAuth } from "@/context/AuthProvider";
import Link from "next/link";

export default function Home() {
  const { user } = useAuth();
  const isAuth = user;
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-blue-200 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16  rounded-full mx-auto mb-4 flex items-center justify-center">
            <img src="/soleklartlogo.png" />
          </div>
          <div className="flex flex-row items-center gap-2 justify-center">
            <img src="/soleklartstorlogo.png" className="h-6" />
            <h1 className="text-3xl font-medium text-[#FAA31A]">Dashbord</h1>
          </div>
          <p className="text-gray-600">Arbeidsflyt gjort enkelt</p>
        </div>

        <Link
          href={isAuth ? "/pricetable" : "/auth"}
          className="inline-block w-full bg-white text-blue-600 font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          {isAuth ? "Gå til Dashboard" : "Logg inn"}
        </Link>
      </div>
    </div>
  );
}
