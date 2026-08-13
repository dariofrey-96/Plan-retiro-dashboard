// scripts/fetch-snapshot.mjs
// Corre una vez por día vía GitHub Actions (ver .github/workflows/snapshot-cartera.yml).
// Lee cartera.json (que la app sube sola cada vez que agregás/borrás un activo),
// busca los precios actuales, y agrega/actualiza el snapshot de HOY en history.json.
//
// No depende de que la app esté abierta ni de que el celular esté prendido —
// corre en los servidores de GitHub.

import { readFile, writeFile } from 'node:fs/promises';

const CARTERA_PATH = 'cartera.json';
const HISTORY_PATH = 'history.json';

// Mismo mapeo ticker -> id de CoinGecko que usa la app (mantenerlo en sync
// si algún día agregás un cripto nuevo que no esté acá).
const COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple',
  ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2', LINK: 'chainlink', DOT: 'polkadot',
  MATIC: 'matic-network', UNI: 'uniswap', ATOM: 'cosmos', LTC: 'litecoin', NEAR: 'near',
  FTM: 'fantom', ALGO: 'algorand', SHIB: 'shiba-inu', TRX: 'tron', XLM: 'stellar',
  VET: 'vechain', SAND: 'the-sandbox', MANA: 'decentraland', AXS: 'axie-infinity',
  AAVE: 'aave', MKR: 'maker',
};

// La misma API key que ya usa la app (queda igual de pública ahí, así que no
// es un secreto nuevo) — pero si preferís, cargá TWELVEDATA_API_KEY como
// "repository secret" en GitHub y va a usar esa en su lugar.
const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY || 'b02a61d5eb77400dba83ed33448b639d';

// Referencias de mercado — se guardan en cada snapshot aunque no las tengas en
// cartera, para poder contestar "¿subí porque subí yo, o porque subió todo?".
// SPY sigue al S&P 500 (las 500 empresas más grandes de EE.UU.) y XAU/USD al oro.
const BENCHMARKS_TD = { spy: 'SPY', gold: 'XAU/USD' }; // vía Twelve Data
const BENCHMARKS_CG = { btc: 'BTC' };                  // vía CoinGecko

async function readJsonSafe(path, fallback) {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

async function fetchCryptoPrices(tickers) {
  if (!tickers.length) return {};
  const ids = [...new Set(tickers.map(t => COINGECKO_IDS[t] || t.toLowerCase()))];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
  const res = await fetch(url);
  if (!res.ok) { console.warn('CoinGecko respondió', res.status); return {}; }
  const data = await res.json();
  const prices = {};
  tickers.forEach(t => {
    const id = COINGECKO_IDS[t] || t.toLowerCase();
    if (data[id] && typeof data[id].usd === 'number') prices[t] = data[id].usd;
  });
  return prices;
}

async function fetchTwelveDataPrices(tickers) {
  if (!tickers.length) return {};
  const prices = {};
  const BATCH = 8;
  for (let i = 0; i < tickers.length; i += BATCH) {
    const group = tickers.slice(i, i + BATCH);
    const symbols = group.map(t => t.toUpperCase()).join(',');
    const url = `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${TWELVEDATA_API_KEY}`;
    try {
      const res = await fetch(url);
      if (!res.ok) { console.warn('Twelve Data respondió', res.status, 'para', symbols); continue; }
      const data = await res.json();
      group.forEach(t => {
        const d = data[t.toUpperCase()] || (group.length === 1 ? data : null);
        if (d && !d.code && d.status !== 'error') {
          const price = parseFloat(d.close);
          if (!isNaN(price) && price > 0) prices[t] = price;
        }
      });
    } catch (e) {
      console.warn('Error consultando Twelve Data para', symbols, e.message);
    }
  }
  return prices;
}

async function main() {
  const cartera = await readJsonSafe(CARTERA_PATH, { assets: [] });
  const assets = cartera.assets || [];

  if (!assets.length) {
    console.log('cartera.json vacío o inexistente todavía — nada que snapshotear hoy.');
    return;
  }

  const carteraCrypto = assets.filter(a => a.cat === 'crypto').map(a => a.ticker);
  const carteraOther = assets.filter(a => a.cat !== 'crypto').map(a => a.ticker);

  // Se piden juntos con los de la cartera para no gastar llamadas de más; si ya
  // tenés el activo, el Set lo deduplica y no cuesta nada extra.
  const cryptoTickers = [...new Set([...carteraCrypto, ...Object.values(BENCHMARKS_CG)])];
  const otherTickers = [...new Set([...carteraOther, ...Object.values(BENCHMARKS_TD)])];

  const [cryptoPrices, otherPrices] = await Promise.all([
    fetchCryptoPrices(cryptoTickers),
    fetchTwelveDataPrices(otherTickers),
  ]);
  const allPrices = { ...cryptoPrices, ...otherPrices };

  const benchmarks = {};
  Object.entries({ ...BENCHMARKS_CG, ...BENCHMARKS_TD }).forEach(([clave, ticker]) => {
    const p = allPrices[ticker];
    if (typeof p === 'number' && p > 0) benchmarks[clave] = Math.round(p * 100) / 100;
    else console.warn('Sin precio de referencia para', ticker, '- se omite del snapshot');
  });

  const byAsset = {};
  const byCategory = { crypto: 0, stock: 0, metal: 0 };
  let total = 0;

  assets.forEach(a => {
    const price = allPrices[a.ticker];
    if (price == null) { console.warn('Sin precio para', a.ticker, '- se omite del snapshot de hoy'); return; }
    const value = a.qty * price;
    byAsset[a.ticker] = (byAsset[a.ticker] || 0) + value;
    if (byCategory[a.cat] != null) byCategory[a.cat] += value;
    total += value;
  });

  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH — clave de deduplicado (1 snapshot por hora)

  if (!Object.keys(byAsset).length) {
    console.warn('No se pudo obtener el precio de NINGÚN activo hoy (APIs caídas/rate-limited) — no se guarda snapshot para no ensuciar el historial con un $0 falso.');
    return;
  }

  const history = await readJsonSafe(HISTORY_PATH, { snapshots: [] });
  const snapshot = { date: today, timestamp: now.toISOString(), hourKey, total: Math.round(total * 100) / 100, byCategory, byAsset };
  if (Object.keys(benchmarks).length) snapshot.benchmarks = benchmarks;

  const existingIdx = history.snapshots.findIndex(s => (s.hourKey || (s.date && s.date + 'T' + (s.timestamp ? s.timestamp.slice(11, 13) : '12'))) === hourKey);
  if (existingIdx >= 0) history.snapshots[existingIdx] = snapshot; // ya corrió esta hora -> actualiza en vez de duplicar
  else history.snapshots.push(snapshot);

  history.snapshots.sort((a, b) => (a.timestamp || a.date).localeCompare(b.timestamp || b.date));

  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n', 'utf8');
  console.log('Snapshot del', today, 'guardado. Total:', snapshot.total);
}

main().catch(err => {
  console.error('Error generando el snapshot:', err);
  process.exit(1);
});
