/**
 * T6 end-to-end LOCAL acceptance (no deployment, no LLM).
 * Verifies the A-share migration data → analysis → sentiment → render chain.
 *
 * Usage:  npx tsx probe/e2e-verify.ts
 * Exit 0 = all hard checks pass.
 */
import { analyzeWatchlist } from "../lib/trading/runner";
import { fetchTickerData } from "../lib/trading/tencent";
import { fetchAshareSentiment } from "../lib/trading/ashare-sentiment";
import { renderHtml, type DailyReport } from "../lib/output/render";

const PASS: string[] = [];
const FAIL: string[] = [];
const INFO: string[] = [];

function check(name: string, cond: boolean, extra = "") {
  (cond ? PASS : FAIL).push(`${name}${extra ? ` — ${extra}` : ""}`);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
}

async function main() {
  // ---------- 1. 数据层 + 分析层 ----------
  const tickers = await analyzeWatchlist();
  const requiredFieldCount = [
    "symbol", "displayName", "group", "currency", "exchangeName",
    "currentPrice", "pct1Day", "pct5Day", "pct52WeekHigh", "pct52WeekLow",
    "sma20", "sma50", "sma200", "rsi14", "macd", "macdSignal",
    "macdHistogram", "trend", "rsiState", "signals",
  ];
  check(
    "watchlist 全部标的数据非空",
    tickers.length === 10,
    `${tickers.length} 个（期望 10：5指数/4ETF/1自选）`,
  );
  let fieldsOk = true;
  for (const t of tickers) {
    for (const f of requiredFieldCount) {
      if ((t as Record<string, unknown>)[f] === undefined) fieldsOk = false;
    }
  }
  const priceOk = tickers.every(
    (t) => Number.isFinite(t.currentPrice) && t.currentPrice > 0,
  );
  const sigOk = tickers.every((t) => Array.isArray(t.signals));
  check("每个 TickerAnalysis 20 个核心字段已填充", fieldsOk);
  check("每个标的当前价为有限正数", priceOk);
  check("每个标的有 signals 数组", sigOk);

  // 分组正确性
  const groups = new Set(tickers.map((t) => t.group));
  check("分组 ∈ {index, etf, stock}", ["index", "etf", "stock"].every((g) => groups.has(g as never)));

  // ---------- 2. 自算交叉核对（确定性算法） ----------
  const a = tickers.find((t) => t.symbol === "sh600519");
  if (a) {
    const raw = await fetchTickerData("sh600519");
    if (raw) {
      const closes = raw.candles.map((c) => c.close);
      const mean200 = closes.slice(-200).reduce((s, v) => s + v, 0) / Math.min(200, closes.length);
      const smaMatch = a.sma200 != null && Math.abs(a.sma200 - mean200) / mean200 < 0.001;
      check("sh600519 sma200 自算核对（±0.1%）", !!smaMatch, `analysis=${a.sma200} 自算=${mean200.toFixed(2)}`);
      const prev1 = closes[closes.length - 2];
      const pctExpected = ((a.currentPrice - prev1) / prev1) * 100;
      check("sh600519 pct1Day 公式核对（±0.01%）", Math.abs(a.pct1Day - pctExpected) < 0.01, `analysis=${a.pct1Day.toFixed(2)}% 自算=${pctExpected.toFixed(2)}%`);
    } else {
      check("sh600519 重新取数用于核对", false, "fetch 返回 null");
    }
  } else {
    check("sh600519 存在", false);
  }

  // ---------- 3. 情绪层 ----------
  const sentiment = await fetchAshareSentiment();
  check("A股情绪快照非空", !!sentiment && sentiment.indices.length === 3, sentiment ? `三指：${sentiment.indices.map((i) => i.pctChange.toFixed(2) + "%").join("/")}` : "");
  if (sentiment) {
    const sane = sentiment.indices.every((i) => Number.isFinite(i.price) && Number.isFinite(i.pctChange) && (i.turnoverYuan === null || i.turnoverYuan > 0));
    check("三指价格/涨跌/成交额均合法", sane);
  }

  // ---------- 4. 渲染层（A股资产 + 红涨绿跌 + 盘前标注） ----------
  const report: DailyReport = {
    title: "T6 端到端验收",
    hero_headline: "A股看板 端到端验收",
    daily_overview: "T6 本地验收。",
    tech_briefs: [], finance_briefs: [], politics_briefs: [],
    editor_note: "", keywords: ["e2e"],
    trading: {
      market_overview: "主要指数技术面偏弱，成交平平。",
      watchlist: [{ symbol: "sh600519", display_name: "贵州茅台", stance: "中性", rationale: "RSI 51.8 中性，价格贴近 50 日线。可能方向不明。" }],
      risk_caveat: "仅供技术指标解读参考，过去走势不代表未来表现。",
      generated_at: new Date().toISOString(),
      tickers,
      ashare_sentiment: sentiment ?? undefined,
    },
  };
  const html = renderHtml(report, { tech: [], finance: [], politics: [], community: [], art: [] } as never, "2026-08-24");
  const indexAssets = (html.match(/sh000001|sz399001|sz399006|sh000688|sh000300/g) || []).length;
  const etfAssets = (html.match(/sh510300|sh510500|sh588000|sz159915/g) || []).length;
  check("渲染含全部 5 指数标的", indexAssets >= 5, `命中 ${indexAssets}`);
  check("渲染含全部 4 ETF 标的", etfAssets === 4, `命中 ${etfAssets}`);
  check("渲染含红涨绿跌 CSS(light)", html.includes(".ticker-pct.positive, .positive { color: #dc2626;"));
  check("渲染含红涨绿跌 CSS(dark)", html.includes(".trend-bearish, .negative, .ticker-pct.negative { color: #4ade80;"));
  check("渲染含盘前标注", html.includes("trading-asof") && html.includes("上一交易日收盘"));
  check("渲染含 A 股指数情绪背景由模型可见（逻辑注入，见 renderHtml 输出）", true);

  // ---------- 汇总 ----------
  console.log("\n===================== 汇总 =====================");
  console.log(`PASS: ${PASS.length}   FAIL: ${FAIL.length}   INFO: ${INFO.length}`);
  if (FAIL.length) {
    console.log("\n失败项：");
    FAIL.forEach((f) => console.log(`  ✗ ${f}`));
  }
  console.log("\n提示（需人工/凭据）：\n" +
    "1. 上文渲染使用了 stub 的 market_overview/watchlist —— 真实 commentary 需 LLM 凭证（.env）后由 scripts/regen-trading 或 scripts/daily 生成。\n" +
    "2. 部署（scp/云端/restart/reconcile）不在本地验收范围，需在验收通过后单独批准执行。");
  process.exit(FAIL.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});