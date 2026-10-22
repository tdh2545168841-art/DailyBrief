import fs from "node:fs";
import path from "node:path";
import type { RawArticle, SourceDef } from "./types";

/**
 * last30days (https://github.com/mvanhorn/last30days-skill) writes a scored
 * digest of Reddit / Hacker News / Polymarket discussion to
 * `data/last30days.json` before `npm run daily` starts (see .github/workflows).
 *
 * This fetcher only reads that file — it never calls the network itself, so a
 * failed collection step degrades to "source absent", never to a broken run.
 */

interface Last30daysResult {
  title?: string;
  url?: string;
  summary?: string;
  source?: string;
  engagement?: Record<string, number>;
  published_at?: string;
  relevance_score?: number;
}

interface Last30daysFile {
  results?: Last30daysResult[];
  generated_at?: string;
}

const MAX_ITEMS = 10;

function engagementLabel(source: string, engagement: Record<string, number> | undefined): string | undefined {
  if (!engagement) return undefined;
  const parts: string[] = [source];
  const score = engagement.score ?? engagement.points;
  const comments = engagement.num_comments ?? engagement.comments;
  if (typeof score === "number" && score > 0) parts.push(`${score.toLocaleString("en-US")} 赞`);
  if (typeof comments === "number" && comments > 0) parts.push(`${comments.toLocaleString("en-US")} 评论`);
  return parts.length > 1 ? parts.join(" · ") : undefined;
}

export async function fetchLast30days(source: SourceDef): Promise<RawArticle[]> {
  const file = process.env.LAST30DAYS_JSON || path.join(process.cwd(), "data", "last30days.json");
  if (!fs.existsSync(file)) return [];

  let parsed: Last30daysFile;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Last30daysFile;
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const items: RawArticle[] = [];
  for (const row of parsed.results ?? []) {
    const title = String(row.title ?? "").trim();
    const url = String(row.url ?? "").trim();
    if (!title || !url || seen.has(url)) continue;
    seen.add(url);

    items.push({
      sourceId: source.id,
      title,
      url,
      excerpt: row.summary ? String(row.summary).trim().slice(0, 280) : undefined,
      meta: engagementLabel(String(row.source ?? ""), row.engagement),
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      category: source.category,
    });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}
