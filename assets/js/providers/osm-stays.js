/* ==========================================================================
   Hospedagens reais da cidade — OpenStreetMap (Overpass)
   --------------------------------------------------------------------------
   Não existe API gratuita e aberta de PREÇO de hospedagem (ver README).
   O que existe de graça e sem chave é o inventário: quantos hostels, hotéis,
   pousadas e apartamentos a cidade realmente tem, e quantos são 3★/4★/5★.

   Isso não dá preço, mas dá duas coisas úteis:
   · mostra ao visitante que existe oferta de verdade na faixa escolhida;
   · serve de sinal de confiança para a diária estimada (uma cidade cheia de
     hostel é outra realidade de uma só com hotel 5★).

   O Overpass é um serviço mantido pela comunidade. Por isso: uma consulta
   apenas quando o usuário abre um destino, e cache de 30 dias.
   ======================================================================== */

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const CACHE = 'ppi.osm.stays.v1.';
const TTL = 30 * 24 * 3600e3;          // 30 dias
const RADIUS_KM = 5;

/* ordem importa: é a ordem em que o Overpass devolve as contagens */
const TYPES = [
  ['hostel',      'hostels'],
  ['hotel',       'hotéis'],
  ['guest_house', 'pousadas'],
  ['apartment',   'apartamentos'],
];

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    return Date.now() - t < TTL ? v : null;
  } catch { return null; }
}

/** Caixa geográfica de ~RADIUS_KM em volta do centro da cidade. */
function bbox(dest) {
  const dLat = RADIUS_KM / 111;
  const dLon = RADIUS_KM / (111 * Math.max(0.2, Math.cos(dest.lat * Math.PI / 180)));
  return [dest.lat - dLat, dest.lon - dLon, dest.lat + dLat, dest.lon + dLon]
    .map(n => n.toFixed(4)).join(',');
}

/**
 * Conta as hospedagens cadastradas no OpenStreetMap em volta do destino.
 *
 * Usa `out count`, que devolve só os totais em vez da lista inteira: a
 * consulta completa dava timeout no servidor público. Falha em silêncio —
 * é informação complementar, nunca bloqueia a tela.
 *
 * @returns {Promise<null|{total:number, counts:object}>}
 */
export async function countStays(dest, signal) {
  const key = CACHE + dest.id;
  const cached = readCache(key);
  if (cached) return cached;

  const bb = bbox(dest);
  const query = '[out:json][timeout:25];'
    + TYPES.map(([t]) => `nwr["tourism"="${t}"](${bb});out count;`).join('');

  let elements;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
    if (!res.ok) throw new Error('overpass ' + res.status);
    elements = (await res.json()).elements || [];
  } catch { return null; }

  const counts = {};
  let total = 0;
  TYPES.forEach(([t], i) => {
    const n = parseInt(elements[i]?.tags?.total, 10);
    if (Number.isFinite(n) && n > 0) { counts[t] = n; total += n; }
  });

  const out = { total, counts };
  try { localStorage.setItem(key, JSON.stringify({ t:Date.now(), v:out })); } catch {}
  return out;
}

/** Frase curta para a coluna de hospedagem. Devolve '' se não houver dado. */
export function describe(data) {
  if (!data || !data.total) return '';
  const label = Object.fromEntries(TYPES);
  return Object.entries(data.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => `${n} ${label[k]}`)
    .join(' · ');
}
