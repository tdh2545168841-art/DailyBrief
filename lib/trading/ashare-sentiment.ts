export interface AshareIndexSnapshot {
  code: string;
  name: string;
  price: number;
  pctChange: number;
  /** 当日成交额（元）；不可用时为 null */
  turnoverYuan: number | null;
}

export interface AshareSentimentSnapshot {
  indices: AshareIndexSnapshot[];
}

// 沪 / 深 / 创业板三大综合指数，作为 A 股情绪快照的广度代理。
const TARGETS: Array<{ code: string; name: string }> = [
  { code: "sh000001", name: "上证指数" },
  { code: "sz399001", name: "深证成指" },
  { code: "sz399006", name: "创业板指" },
];

const HEADERS = { "User-Agent": "Mozilla/5.0" } as const;

/**
 * 单次请求取沪/深/创业板实时快照（s_ 变体）。
 *
 * 响应形如：
 *   v_s_sh000001="51~上证指数~000001~3873.71~-31.49~-0.81~332223571~65168660~~685617.94~ZS~";
 *   [0]=flag [1]=名称 [2]=代码 [3]=现价 [4]=涨跌额 [5]=涨跌幅 [6]=成交量(手) [7]=成交额(万)
 * 名称经 GBK 编码，Node 原生 utf-8 解码会乱码，故本地映射 name。
 */
export async function fetchAshareSentiment(): Promise<AshareSentimentSnapshot | null> {
  const syms = TARGETS.map((t) => `s_${t.code}`).join(",");
  let res: Response;
  try {
    res = await fetch(`https://qt.gtimg.cn/q=${syms}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const text = await res.text();
  const indices: AshareIndexSnapshot[] = [];
  for (const line of text.split(";")) {
    const m = /^v_s_([a-z0-9]+)="([^"]*)"$/.exec(line.trim());
    if (!m) continue;
    const code = m[1];
    const target = TARGETS.find((t) => t.code === code);
    if (!target) continue;
    const f = m[2].split("~");
    const price = Number(f[3]);
    const pct = Number(f[5]);
    if (!Number.isFinite(price)) continue;
    const turnoverWan = Number(f[7]);
    indices.push({
      code,
      name: target.name,
      price,
      pctChange: Number.isFinite(pct) ? pct : 0,
      turnoverYuan:
        Number.isFinite(turnoverWan) && turnoverWan > 0
          ? turnoverWan * 1e4
          : null,
    });
  }
  return indices.length > 0 ? { indices } : null;
}