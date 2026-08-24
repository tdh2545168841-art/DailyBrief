import { fetchTickerData } from "../lib/trading/tencent";
import { analyzeTicker, type TickerAnalysis } from "../lib/trading/signals";
import type { TickerDef } from "../lib/trading/watchlist";

const codes = ["sh000001", "sh510300", "sh600519", "sz399006"];

async function main() {
  for (const c of codes) {
    const r = await fetchTickerData(c);
    if (!r) {
      console.log(`${c}  → NULL`);
      continue;
    }
    const sum = (v: number) => v.toFixed(3);
    console.log(
      `${c}  sym=${r.symbol} cur=${r.currency} exch=${r.exchangeName} ` +
        `price=${sum(r.regularMarketPrice)} hi52=${sum(r.fiftyTwoWeekHigh)} lo52=${sum(r.fiftyTwoWeekLow)} ` +
        `candles=${r.candles.length} ` +
        `first=${r.candles[0].date.toISOString().slice(0, 10)} ` +
        `last=${r.candles[r.candles.length - 1].date.toISOString().slice(0, 10)}`,
    );
  }

  // Integration de-risk: analyzeTicker over tencent data (T3 prerequisite)
  const def: TickerDef = { symbol: "sh600519", displayName: "贵州茅台", group: "stock" };
  const raw = await fetchTickerData(def.symbol);
  if (raw) {
    const a: TickerAnalysis = analyzeTicker(def, raw);
    console.log(
      `\n[analyze] ${a.displayName} price=${a.currentPrice} ` +
        `pct1d=${a.pct1Day.toFixed(2)}% pct52H=${a.pct52WeekHigh.toFixed(1)}% ` +
        `trend=${a.trend} rsi=${a.rsi14?.toFixed(1)} sma50=${a.sma50?.toFixed(2)} sma200=${a.sma200?.toFixed(2)} ` +
        `macd=${a.macd?.toFixed(3)} signals=${a.signals.map((s) => s.type).join(",") || "(无)"}`,
    );
  }
}

main();