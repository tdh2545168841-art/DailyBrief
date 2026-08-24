// Probe Tencent quote fields for A-share breadth/volume sentiment.
async function get(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const t = await r.text();
  return t.slice(0, 4000);
}

function dumpArr(label: string, arr: string[]) {
  console.log(`\n== ${label} (len=${arr.length}) ==`);
  arr.forEach((v, i) => console.log(`${i}: ${v}`));
}

async function main() {
  // 1) fqkline embedded qt for sh000001
  const kl = await get(
    "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh000001,day,,,2,qfq",
  );
  console.log("--- fqkline raw (first 900) ---\n", kl.slice(0, 900));

  // 2) standalone qt full line
  const qt = await get("https://qt.gtimg.cn/q=sh000001");
  console.log("\n--- qt.gtimg.cn/q=sh000001 ---\n", qt.slice(0, 1500));

  // 3) zhishu-suffixed quote (known source of 涨跌家数 / 成交额)
  const z = await get("https://qt.gtimg.cn/q=s_sh000001");
  console.log("\n--- qt.gtimg.cn/q=s_sh000001 ---\n", z.slice(0, 600));
}

main();