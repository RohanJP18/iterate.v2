import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";

const GITHUB_API = "https://api.github.com";

export type LinkedRepo = { owner: string; repo: string };

function parseMetadata(metadata: unknown): { linkedRepo?: LinkedRepo } | null {
  if (metadata === null || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const lr = m.linkedRepo;
  if (lr === null || typeof lr !== "object") return null;
  const o = (lr as Record<string, unknown>).owner;
  const r = (lr as Record<string, unknown>).repo;
  if (typeof o !== "string" || typeof r !== "string" || !o.trim() || !r.trim())
    return null;
  return { linkedRepo: { owner: o.trim(), repo: r.trim() } };
}

export async function getGitHubToken(orgId: string): Promise<string | null> {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: "github" } },
  });
  if (!integration?.encryptedAccessToken) return null;
  try {
    return decrypt(integration.encryptedAccessToken);
  } catch {
    return null;
  }
}

export async function getLinkedRepo(orgId: string): Promise<LinkedRepo | null> {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: "github" } },
  });
  if (!integration?.metadata) return null;
  const parsed = parseMetadata(integration.metadata);
  return parsed?.linkedRepo ?? null;
}

async function fetchGitHub(
  token: string,
  path: string,
  opts?: { accept?: string }
): Promise<unknown> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: opts?.accept ?? "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

const MAX_REPO_CONTEXT_CHARS = 12_000;

/**
 * Builds a string summary of the linked repo (file tree, README, package.json) for LLM context.
 * Returns empty string if no linked repo or token, or on fetch error.
 */
export async function getRepoContext(orgId: string): Promise<string> {
  const token = await getGitHubToken(orgId);
  const linked = await getLinkedRepo(orgId);
  if (!token || !linked) return "";

  const { owner, repo } = linked;
  const parts: string[] = [];

  try {
    const repoInfo = (await fetchGitHub(token, `/repos/${owner}/${repo}`)) as {
      default_branch?: string;
      full_name?: string;
    };
    const defaultBranch = repoInfo.default_branch ?? "main";

    parts.push(`## Codebase: ${owner}/${repo}`);
    parts.push(`Default branch: ${defaultBranch}\n`);

    const tree = (await fetchGitHub(
      token,
      `/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`
    )) as { tree?: { path?: string; type?: string }[] };
    const files = (tree.tree ?? []).filter((n) => n.type === "blob").map((n) => n.path).filter(Boolean) as string[];
    const treeLines = files.slice(0, 200).map((p) => `  ${p}`);
    if (files.length > 200) treeLines.push(`  ... and ${files.length - 200} more files`);
    parts.push("### File tree\n");
    parts.push(treeLines.join("\n"));
    parts.push("");

    const readmeNames = ["README.md", "README.MD", "readme.md"];
    let readmeContent: string | null = null;
    for (const name of readmeNames) {
      if (!files.some((f) => f.toUpperCase() === name.toUpperCase())) continue;
      try {
        const file = (await fetchGitHub(
          token,
          `/repos/${owner}/${repo}/contents/${name}`
        )) as { content?: string; encoding?: string };
        if (file.content) {
          readmeContent =
            file.encoding === "base64"
              ? Buffer.from(file.content, "base64").toString("utf8")
              : file.content;
          break;
        }
      } catch {
        continue;
      }
    }
    if (readmeContent) {
      parts.push("### README.md\n");
      parts.push(readmeContent.slice(0, 4000));
      if (readmeContent.length > 4000) parts.push("\n...(truncated)");
      parts.push("");
    }

    if (files.some((f) => f === "package.json")) {
      try {
        const file = (await fetchGitHub(
          token,
          `/repos/${owner}/${repo}/contents/package.json`
        )) as { content?: string; encoding?: string };
        if (file.content) {
          const raw =
            file.encoding === "base64"
              ? Buffer.from(file.content, "base64").toString("utf8")
              : file.content;
          parts.push("### package.json\n");
          parts.push(raw.slice(0, 2000));
          if (raw.length > 2000) parts.push("\n...(truncated)");
          parts.push("");
        }
      } catch {
        // ignore
      }
    }
  } catch (e) {
    console.error("getRepoContext error:", e);
    return "";
  }

  const out = parts.join("\n");
  return out.length > MAX_REPO_CONTEXT_CHARS ? out.slice(0, MAX_REPO_CONTEXT_CHARS) + "\n...(truncated)" : out;
}
