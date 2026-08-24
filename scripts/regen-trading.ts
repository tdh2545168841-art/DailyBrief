import "./_env";

import fs from "node:fs";
import path from "node:path";

import type { DailyReport, TradingSection } from "../lib/ai/pipeline";
import { generateTradingCommentary } from "../lib/ai/trading-commentary";
import { validateBackendCredentials } from "../lib/ai/llm";
import { fetchAshareSentiment } from "../lib/trading/ashare-sentiment";
import { analyzeWatchlist } from "../lib/trading/runner";
import { todayKey } from "../lib/utils";

const OUTPUT_DIR = "daily_reports";

/**
 * Re-run ONLY the trading section (Yahoo + F&G + CoinGecko + Sonnet
 * commentary) and patch the result into the existing <date>.json.
 *
 * Use this when the main digest is fine but trading commentary failed
 * to parse / produced empty fields, so you don't have to spend the
 * full daily run (~5min, 5 LLM calls) again.
 *
 * Usage:
 *   npm run regen-trading
 *   npm run regen-trading -- 2026-05-15
 *
 * Follow up with `npm run render` to refresh the HTML.
 */
async function main() {
  validateBackendCredentials();

  const date = process.argv[2] || todayKey();
  const base = path.join(OUTPUT_DIR, date, date);
  const jsonPath = `${base}.json`;
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Report JSON not found: ${jsonPath}`);
  }
  const report = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as DailyReport;

  console.log(`[regen-trading] fetching tickers + A股 情绪快照…`);
  const t0 = Date.now();
  const [tickers, sentiment] = await Promise.all([
    analyzeWatchlist(),
    fetchAshareSentiment(),
  ]);
  const totalTurn = sentiment
    ? sentiment.indices.reduce((s, i) => s + (i.turnoverYuan ?? 0), 0)
    : 0;
  console.log(
    `[regen-trading] data ready in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${tickers.length} tickers` +
      (sentiment
        ? `, 三大指成交约 ${(totalTurn / 1e11).toFixed(1)} 千亿`
        : ", sentiment ✗"),
  );

  console.log(`[regen-trading] calling commentary…`);
  const t1 = Date.now();
  const commentary = await generateTradingCommentary({
    tickers,
    ashareSentiment: sentiment ?? undefined,
  });
  console.log(
    `[regen-trading] commentary ready in ${((Date.now() - t1) / 1000).toFixed(1)}s` +
      ` (overview ${commentary.market_overview.length} 字, ${commentary.watchlist.length} picks)`,
  );

  const trading: TradingSection = {
    ...commentary,
    tickers,
    ashare_sentiment: sentiment ?? undefined,
    generated_at: new Date().toISOString(),
  };
  report.trading = trading;
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`[regen-trading] patched ${jsonPath}`);
  console.log(`[regen-trading] now run \`npm run render\` to refresh HTML.`);
}

main().catch((e) => {
  console.error("[regen-trading] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
