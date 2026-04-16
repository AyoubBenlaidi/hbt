"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export const Header: React.FC = () => {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <nav className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/households" className="text-2xl font-bold text-blue-600">
            HBT
          </Link>
          <div className="hidden md:flex gap-6">
            <Link
              href="/dashboard"
              className={`font-medium transition ${
                isActive("/dashboard")
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/households"
              className={`font-medium transition ${
                isActive("/households")
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              Households
            </Link>
            <Link
              href="/expenses"
              className={`font-medium transition ${
                isActive("/expenses")
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              Expenses
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="font-medium text-gray-900">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
          >
            Sign Out
          </button>
        </div>
      </nav>
    </header>
  );
};
