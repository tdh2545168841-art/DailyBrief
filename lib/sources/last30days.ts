import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { RawArticle, SourceDef } from "./types";

/**
 * last30days (https://github.com/mvanhorn/last30days-skill): Reddit / Hacker
 * News / Polymarket posts scored by real engagement instead of editorial picks.
 *
 * Collected on demand — clone the skill into a temp dir, run its Python engine
 * (stdlib only, Python 3.12+ as on ubuntu-latest), map `results` to articles.
 * Any failure returns [] so a bad day never breaks the whole report.
 */

const QUERY = process.env.LAST30DAYS_QUERY || "AI agents";

export async function fetchLast30days(source: SourceDef): Promise<RawArticle[]> {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "last30days-"));
  const out = path.join(work, "result.json");
  const items: RawArticle[] = [];
  try {
    execFileSync(
      "git",
      ["clone", "--depth", "1", "https://github.com/mvanhorn/last30days-skill", path.join(work, "skill")],
      { stdio: "ignore", timeout: 120_000 }
    );
    execFileSync(
      "python3",
      [
        path.join(work, "skill", "skills", "last30days", "scripts", "last30days.py"),
        QUERY,
        "--quick",
        "--emit",
        "json",
        "--output",
        out,
      ],
      { stdio: "ignore", timeout: 240_000 }
    );
    const rows = (JSON.parse(fs.readFileSync(out, "utf8")) as { results?: any[] }).results ?? [];
    const seen = new Set<string>();
    for (const row of rows) {
      const title = String(row?.title ?? "").trim();
      const url = String(row?.url ?? "").trim();
      if (!title || !url || seen.has(url)) continue;
      seen.add(url);

      const engagement = (row?.engagement ?? {}) as Record<string, number>;
      const score = engagement.score ?? engagement.points;
      const comments = engagement.num_comments ?? engagement.comments;
      const meta = [String(row?.source ?? "")];
      if (typeof score === "number" && score > 0) meta.push(`${score.toLocaleString("en-US")} 赞`);
      if (typeof comments === "number" && comments > 0) meta.push(`${comments.toLocaleString("en-US")} 评论`);

      items.push({
        sourceId: source.id,
        title,
        url,
        excerpt: row?.summary ? String(row.summary).trim().slice(0, 280) : undefined,
        meta: meta.filter(Boolean).join(" · "),
        publishedAt: row?.published_at ? new Date(row.published_at) : undefined,
        category: source.category,
      });
      if (items.length >= 10) break;
    }
  } catch {
    return [];
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  return items;
}
