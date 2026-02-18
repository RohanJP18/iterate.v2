import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { IssuesChart } from "@/components/IssuesChart";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const orgId = (session.user as { organizationId?: string }).organizationId;
  const [criticalCount, allCount, resolvedCount] = await Promise.all([
    prisma.issue.count({ where: { organizationId: orgId, status: "open", severity: "critical" } }),
    prisma.issue.count({ where: { organizationId: orgId } }),
    prisma.issue.count({ where: { organizationId: orgId, status: "resolved" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-gray-500 font-mono text-sm">// OVERVIEW</h1>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-500">Critical issues</div>
          <div className="mt-2 text-3xl font-semibold text-charcoal">{criticalCount}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-500">All issues</div>
          <div className="mt-2 text-3xl font-semibold text-charcoal">{allCount}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-500">Resolved</div>
          <div className="mt-2 text-3xl font-semibold text-charcoal">{resolvedCount}</div>
        </div>
      </div>
      <div className="mt-8">
        <Link
          href="/issues"
          className="inline-flex items-center rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          View all issues
        </Link>
      </div>
      <IssuesChart />
    </div>
  );
}
