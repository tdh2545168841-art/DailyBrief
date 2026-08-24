import { analyzeWatchlist } from "../lib/trading/runner";
import { fetchAshareSentiment } from "../lib/trading/ashare-sentiment";
import { renderHtml, type DailyReport } from "../lib/output/render";

async function main() {
  const tickers = await analyzeWatchlist();
  const sentiment = await fetchAshareSentiment();

  const report: DailyReport = {
    title: "A股 Daily Brief 渲染冒烟",
    hero_headline: "A股看板渲染冒烟",
    daily_overview: "示例。",
    tech_briefs: [],
    finance_briefs: [],
    politics_briefs: [],
    editor_note: "",
    keywords: ["smoke"],
    trading: {
      market_overview: "主要指数技术面偏弱，成交平平。",
      watchlist: [
        {
          symbol: "sh600519",
          display_name: "贵州茅台",
          stance: "中性",
          rationale: "RSI 51.8 中性，价格贴近 50 日线附近，未见明显方向。",
        },
      ],
      risk_caveat: "仅供技术指标解读参考，过去走势不代表未来表现。",
      generated_at: new Date().toISOString(),
      tickers,
      ashare_sentiment: sentiment ?? undefined,
    },
  };

  const html = renderHtml(
    report,
    { tech: [], finance: [], politics: [], community: [], art: [] } as never,
    "2026-08-24",
  );

  const checks: Array<[string, boolean]> = [
    ["[D6] 盘前标注 div", html.includes("trading-asof")],
    ["[D6] 盘前标注文案(ZH)", html.includes("截至上一交易日收盘")],
    ["[D7] 红涨色值(light .positive=#dc2626)", html.includes(".ticker-pct.positive, .positive { color: #dc2626;")],
    ["[D7] 绿跌色值(light .negative=#16a34a)", html.includes(".ticker-pct.negative, .negative { color: #16a34a;")],
    ["[D7] 深色红涨 #f87171", html.includes(".trend-bullish, .positive, .ticker-pct.positive { color: #f87171;")],
    ["[D7] 深色绿跌 #4ade80", html.includes(".trend-bearish, .negative, .ticker-pct.negative { color: #4ade80;")],
    ["[结构] 股票卡片渲染", html.includes("ticker-pct ")],
    ["[结构] 今日关注 picks", html.includes("stance-neutral")],
  ];

  let pass = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${checks.length} 通过`);
  process.exit(pass === checks.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});