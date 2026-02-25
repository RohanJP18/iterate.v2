import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex shrink-0 items-center justify-between gap-4 mb-8">
        <h1 className="text-lg font-semibold text-charcoal">// EXISTING PRDS</h1>
        <Link
          href="/prd"
          className="rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          + NEW PRD
        </Link>
      </div>

      {drafts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#7dd3fc]/20 text-[#0ea5e9] mb-6">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-charcoal mb-2">No PRDs yet</h2>
          <p className="text-gray-500 text-center max-w-sm mb-8">
            Generate your first PRD from customer feedback and usage data.
          </p>
          <Link
            href="/prd"
            className="rounded-lg bg-charcoal px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            CREATE FIRST PRD
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-4 hover:border-gray-300 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/prd?draftId=${d.id}`}
                  className="font-medium text-charcoal hover:text-gray-800 truncate block"
                >
                  {d.title || "Untitled"}
                </Link>
                <p className="text-xs text-gray-500 mt-0.5">
                  Updated {new Date(d.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/prd?draftId=${d.id}`}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Open
                </Link>
                <a
                  href={`/api/prd/drafts/${d.id}/export`}
                  download={`prd-${d.id}.json`}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Export
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
