"use client";

import { Sidebar } from "./Sidebar";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 bg-dot-grid">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <>{children}</>;
  }

  const user = session?.user;
  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="min-h-screen flex bg-gray-50/80 bg-dot-grid">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-gray-200 bg-white/90 flex items-center justify-between px-6">
          <div />
          <div className="flex items-center gap-4">
            <button type="button" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg" aria-label="Search">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button type="button" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg" aria-label="Notifications">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
              <div className="text-right">
                <div className="text-sm font-medium text-charcoal">{user?.name ?? "User"}</div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
              <div className="h-9 w-9 rounded-full bg-[#7dd3fc]/30 flex items-center justify-center text-sm font-medium text-charcoal">
                {initials}
              </div>
            </div>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
