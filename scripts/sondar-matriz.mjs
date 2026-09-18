/* Sonda descartável: mostra o que `nearest-places-matrix` devolve de verdade.
   Sem isto eu desenharia a coleta em cima de uma suposição, e o volume de
   consultas depende do formato da resposta. */
const TOKEN = process.env.TRAVELPAYOUTS_TOKEN || process.env.TRAVELPAYOUTS || '';
if (!TOKEN) { console.error('sem token'); process.exit(1); }

const casos = [
  ['LIS', 'OPO', '2026-11-10', '2026-11-17', 3],
  ['CAG', 'BCN', '2026-11-10', '2026-11-17', 7],
  ['GRU', 'SCL', '2026-11-10', '2026-11-17', 3],
];

for (const [origin, destination, depart_date, return_date, flexibility] of casos) {
  const qs = new URLSearchParams({
    origin, destination, depart_date, return_date,
    flexibility: String(flexibility), limit: '10', currency: 'eur', show_to_affiliates: 'true',
  });
  const url = `https://api.travelpayouts.com/v2/prices/nearest-places-matrix?${qs}`;
  try {
    const res = await fetch(url, { headers: { 'X-Access-Token': TOKEN.trim() } });
    const corpo = await res.json();
    console.log(`\n=== ${origin}→${destination} flex ${flexibility}d · HTTP ${res.status} ===`);
    console.log('sucesso:', corpo.success, '| erro:', corpo.error ?? '—');
    const prices = corpo.prices || corpo.data?.prices || [];
    console.log('registros:', prices.length);
    console.log('origens vizinhas:', JSON.stringify(corpo.origins ?? corpo.data?.origins ?? '—'));
    console.log('destinos vizinhos:', JSON.stringify(corpo.destinations ?? corpo.data?.destinations ?? '—'));
    console.log('amostra:', JSON.stringify(prices.slice(0, 3), null, 1));
  } catch (e) { console.log(`${origin}→${destination}: ${e.message}`); }
  await new Promise(r => setTimeout(r, 800));
}
