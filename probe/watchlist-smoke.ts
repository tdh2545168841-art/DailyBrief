import { analyzeWatchlist } from "../lib/trading/runner";

async function main() {
  const out: Record<string, Array<Record<string, unknown>>> = {};
  for (const t of await analyzeWatchlist()) {
    (out[t.group] ??= []).push({
      sym: t.symbol,
      name: t.displayName,
      price: t.currentPrice,
      pct1d: Number(t.pct1Day.toFixed(2)),
      rsi: t.rsi14?.toFixed(1),
      trend: t.trend,
      sig: t.signals.length,
    });
  }
  for (const [g, rows] of Object.entries(out)) {
    console.log(`\n[${g}] (${rows.length})`);
    for (const r of rows) console.log(JSON.stringify(r));
  }
}

main();