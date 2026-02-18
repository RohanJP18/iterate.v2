import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_DIMS = 1536;

export async function getEmbedding(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  const vec = res.data[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMS) {
    throw new Error("Invalid embedding response");
  }
  return vec as number[];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function findSimilarIssue(
  embedding: number[],
  existingIssues: { id: string; embeddingJson: string | null }[],
  threshold: number
): string | null {
  for (const issue of existingIssues) {
    if (!issue.embeddingJson) continue;
    try {
      const other = JSON.parse(issue.embeddingJson) as number[];
      if (!Array.isArray(other) || other.length !== embedding.length) continue;
      const sim = cosineSimilarity(embedding, other);
      if (sim >= threshold) return issue.id;
    } catch {
      continue;
    }
  }
  return null;
}
