export type AssetGroup =
  | "index" // 主要指数
  | "etf" // 宽基ETF
  | "stock"; // 自选股

export interface TickerDef {
  symbol: string; // 腾讯行情代码，如 sh000001 / sz399001 / sh510300
  displayName: string; // 中文展示名
  displayNameEn?: string; // English display name (falls back to displayName if absent)
  group: AssetGroup;
}

export function getDisplayName(t: TickerDef, locale: "zh" | "en"): string {
  return locale === "en" ? (t.displayNameEn ?? t.displayName) : t.displayName;
}

const ASSET_GROUP_LABELS_ZH: Record<AssetGroup, string> = {
  index: "指数",
  etf: "ETF",
  stock: "自选股",
};

const ASSET_GROUP_LABELS_EN: Record<AssetGroup, string> = {
  index: "Indices",
  etf: "ETFs",
  stock: "Watchlist",
};

export function getAssetGroupLabels(
  locale: "zh" | "en",
): Record<AssetGroup, string> {
  return locale === "en" ? ASSET_GROUP_LABELS_EN : ASSET_GROUP_LABELS_ZH;
}

export const ASSET_GROUP_ORDER: AssetGroup[] = ["index", "etf", "stock"];

export const WATCHLIST: TickerDef[] = [
  // === 主要指数 ===
  { symbol: "sh000001", displayName: "上证指数", group: "index" },
  { symbol: "sz399001", displayName: "深证成指", group: "index" },
  { symbol: "sz399006", displayName: "创业板指", group: "index" },
  { symbol: "sh000688", displayName: "科创50", group: "index" },
  { symbol: "sh000300", displayName: "沪深300", group: "index" },
  // === 宽基 ETF ===
  { symbol: "sh510300", displayName: "沪深300ETF", group: "etf" },
  { symbol: "sh510500", displayName: "中证500ETF", group: "etf" },
  { symbol: "sh588000", displayName: "科创50ETF", group: "etf" },
  { symbol: "sz159915", displayName: "创业板ETF", group: "etf" },
  // === 自选股（D5 待填）===
  // 以下为示例，可替换为你的自选股清单，symbol 用 sh/sz 前缀：
  // { symbol: "sh600519", displayName: "贵州茅台", group: "stock" }
  // { symbol: "sz000001", displayName: "平安银行", group: "stock" }
  { symbol: "sh600519", displayName: "贵州茅台", group: "stock" },
];