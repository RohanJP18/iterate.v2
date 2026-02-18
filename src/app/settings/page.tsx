"use client";

import { useSession, signOut } from "next-auth/react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-gray-500 font-mono text-sm">// SETTINGS</h1>
      </div>
      <div className="max-w-xl space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-charcoal">Account</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-[#7dd3fc]/30 flex items-center justify-center text-lg font-medium text-charcoal">
              {initials}
            </div>
            <div>
              <div className="font-medium text-charcoal">{user?.name ?? "User"}</div>
              <div className="text-sm text-gray-500">{user?.email}</div>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ACCOUNT
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              SIGN OUT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
