"use client";

import { useSession, signOut } from "next-auth/react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="mb-6 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-charcoal dark:text-gray-100">Settings</h1>
      </div>
      <div className="flex justify-center">
        <div className="w-full max-w-xl">
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#252525] p-6">
            <h2 className="text-base font-semibold text-charcoal dark:text-gray-100">Account</h2>
            <div className="mt-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg font-medium text-charcoal dark:text-gray-200">
                {initials}
              </div>
              <div>
                <div className="font-medium text-charcoal dark:text-gray-100">{user?.name ?? "User"}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Account
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
