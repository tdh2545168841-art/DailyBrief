async function main() {
  const r = await fetch(
    "https://qt.gtimg.cn/q=s_sh000001,s_sz399001,s_sz399006",
    { headers: { "User-Agent": "Mozilla/5.0" } },
  );
  const t = await r.text();
  console.log(t);
}
main();