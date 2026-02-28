import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DeleteDraftButton } from "@/components/DeleteDraftButton";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) {
    redirect("/login");
  }

  const drafts = await prisma.pRDDraft.findMany({
    where: { organizationId: orgId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex shrink-0 items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-charcoal dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <h1 className="text-lg font-semibold text-charcoal dark:text-gray-100">Home</h1>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          — Your PRDs and quick access to tools.
        </span>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Your PRDs
          </h2>
          <Link
            href="/prd"
            className="rounded-lg bg-charcoal dark:bg-gray-100 dark:text-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            + New PRD
          </Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          <Link
            href="/prd"
            className="rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600 bg-white dark:bg-[#252525] hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 min-h-[160px] flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-charcoal dark:hover:text-gray-200 transition-colors"
          >
            <span className="text-3xl font-light leading-none">+</span>
            <span className="text-sm font-medium">New PRD</span>
          </Link>
          {drafts.map((d) => (
            <div
              key={d.id}
              className="relative rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-[#252525] overflow-hidden hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm transition-all min-h-[160px] flex flex-col"
            >
              <DeleteDraftButton draftId={d.id} />
              <Link href={`/prd?draftId=${d.id}`} className="flex-1 flex flex-col">
                <div className="h-20 shrink-0 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="p-3 flex-1 flex flex-col min-w-0">
                  <span className="font-semibold text-charcoal dark:text-gray-100 truncate">
                    {d.title || "Untitled"}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Updated {new Date(d.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }).toUpperCase()}
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-auto pt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <Link href="/feature-gen" className="underline hover:text-charcoal dark:hover:text-gray-300">
            Go to Feature Gen
          </Link>
          {" "}to send a conversation here.
        </p>
      </div>
    </div>
  );
}
