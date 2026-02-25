import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FeatureGenChat } from "@/components/FeatureGenChat";

export default async function FeatureGenPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex shrink-0 items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h1 className="text-lg font-semibold text-charcoal dark:text-gray-100">Feature Gen</h1>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          — Outline new features with evidence from PostHog and customer feedback. Attach PDFs or videos from interviews.
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <FeatureGenChat />
      </div>
    </div>
  );
}
