import { fetchAshareSentiment } from "../lib/trading/ashare-sentiment";

async function main() {
  const s = await fetchAshareSentiment();
  console.log(JSON.stringify(s, null, 2));
}
main();