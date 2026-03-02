"use client";

import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "next-auth/react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf9] bg-dot-grid dark:bg-[#191919] dark:bg-dot-grid">
        <div className="text-gray-500 dark:text-gray-400 text-sm">Loading...</div>
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
    <div className="h-screen flex overflow-hidden bg-[#fafaf9] bg-dot-grid dark:bg-[#191919] dark:bg-dot-grid">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#252525] flex items-center justify-between gap-4 px-6">
          <h1 className="text-xl font-semibold text-charcoal dark:text-gray-100">Iterate</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-charcoal dark:text-gray-100">
                  {user?.name ?? "User"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</div>
              </div>
              <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-charcoal dark:text-gray-200">
                {initials}
              </div>
            </div>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 bg-white dark:bg-[#191919]">{children}</main>
      </div>
    </div>
  );
}
