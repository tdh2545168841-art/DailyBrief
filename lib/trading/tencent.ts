import type { OHLC, TickerRawData } from "./yahoo";

/**
 * Tencent fqkline data source (A / A 股), drop-in replacement for Yahoo.
 *
 * Endpoint: https://web.ifzq.gtimg.cn/appstock/app/fqkline/get
 *   param = {code},day,,,320,qfq   →  up to 320 daily candles, 前复权
 *
 * Response shape (verified 2026-08-24):
 *   { code:0, data: { [code]: {
 *       day?:    Row[],   // indices
 *       qfqday?: Row[],   // stocks / ETFs
 *       qt: { [code]: string[] }  // live quote, [3]=现价 [4]=昨收 [5]=今开 [6]=量
 *   }}}
 *   Row = [日期, 开盘, 收盘, 最高, 最低, 成交量]  (strings)
 *   Indices use day; stocks/ETFs use qfqday. Last row may be the live
 *   (intraday / same-price) candle with trimmed decimals — coerce with Number().
 */

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
} as const;

const K_LINES = 320;

function parseLocalDate(dateStr: string): Date {
  // "2026-08-10" → local midnight, avoids UTC shift from new Date(str)
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Fetch daily OHLCV + meta for an A-share symbol (e.g. "sh000001", "sh510300").
 * Non-fatal: returns null on any failure so the caller can drop the ticker.
 */
export async function fetchTickerData(
  symbol: string,
): Promise<TickerRawData | null> {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(
    symbol,
  )},day,,,${K_LINES},qfq`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let payload: any;
  try {
    payload = await res.json();
  } catch {
    return null;
  }
  if (!payload || payload.code !== 0) return null;

  const node = payload.data?.[symbol];
  if (!node) return null;

  // Stocks / ETFs expose 前复权 under qfqday; indices under day.
  const rows: unknown = node.qfqday ?? node.day;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const candles: OHLC[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const date = parseLocalDate(String(row[0]));
    const open = num(row[1]);
    const close = num(row[2]);
    const high = num(row[3]);
    const low = num(row[4]);
    const volume = num(row[5]);
    if (!open && !close) continue; // malformed / empty row
    candles.push({ date, open, high, low, close, volume });
  }
  if (candles.length === 0) return null;

  // Live price from the embedded quote; fall back to last close.
  const qtArr: unknown = node.qt?.[symbol];
  let livePrice = Number.NaN;
  if (Array.isArray(qtArr) && qtArr[3] !== undefined) {
    livePrice = Number(qtArr[3]);
  }
  const regularMarketPrice = Number.isNaN(livePrice)
    ? candles[candles.length - 1].close
    : livePrice;

  const fiftyTwoWeekHigh = Math.max(...candles.map((c) => c.high));
  const fiftyTwoWeekLow = Math.min(...candles.map((c) => c.low));
  const exchangeName = symbol.startsWith("sz")
    ? "SZSE"
    : symbol.startsWith("bj")
      ? "BSE"
      : "SSE";

  return {
    symbol,
    currency: "CNY",
    exchangeName,
    regularMarketPrice,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    candles,
  };
}