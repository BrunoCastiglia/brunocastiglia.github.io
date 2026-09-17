/* ==========================================================================
   Câmbio
   --------------------------------------------------------------------------
   Toda a base está em EUR. Aqui convertemos para a moeda escolhida pelo
   usuário (EUR/USD/BRL) e para a moeda local do destino.

   Taxas ao vivo: frankfurter.dev (Banco Central Europeu, sem chave).
   Moedas fora do BCE usam a tabela de reserva abaixo, marcada como aproximada.
   ======================================================================== */

/** Reserva: unidades de moeda por 1 EUR. Atualize de tempos em tempos. */
const FALLBACK = {
  EUR:1, USD:1.09, BRL:5.90, GBP:0.85, CHF:0.94, JPY:165, CNY:7.85, AUD:1.65,
  CAD:1.48, NZD:1.79, SEK:11.4, NOK:11.7, DKK:7.46, ISK:150, PLN:4.28,
  CZK:25.1, HUF:395, RON:4.97, BGN:1.96, TRY:37.5, ZAR:19.8, SGD:1.45,
  HKD:8.5, KRW:1480, INR:91, THB:38, MYR:4.9, IDR:17200, PHP:62, VND:27500,
  TWD:35, MXN:20.5, ARS:1050, CLP:1020, COP:4400, PEN:4.1, UYU:44, BOB:7.5,
  PYG:8200, AED:4.0, QAR:3.97, SAR:4.09, ILS:4.0, EGP:53, MAD:10.8, TND:3.4,
  KES:140, TZS:2900, NGN:1700, GEL:2.95, AMD:420, AZN:1.85, KZT:520, NPR:145,
  LKR:320, KHR:4400, MVR:16.8, FJD:2.45, DOP:65, CRC:560, GTQ:8.4, CUP:26,
  CVE:110, JOD:0.77, RSD:117, BAL:1.96, BAM:1.96, ALL:99, MKD:61,
};

/** Moedas cobertas pela API do BCE (as demais caem no fallback). */
const ECB = new Set(['USD','JPY','BGN','CZK','DKK','GBP','HUF','PLN','RON','SEK','CHF',
  'ISK','NOK','TRY','AUD','BRL','CAD','CNY','HKD','IDR','ILS','INR','KRW','MXN','MYR',
  'NZD','PHP','SGD','THB','ZAR']);

const SYMBOLS = { EUR:'€', USD:'$', BRL:'R$', GBP:'£', JPY:'¥', CHF:'CHF' };

let rates = { ...FALLBACK };
let live = false;

export const symbolOf = c => SYMBOLS[c] || '';
export const isLive = () => live;

/** Busca as taxas do dia; falha em silêncio para o fallback. */
export async function loadRates() {
  try {
    const want = [...ECB].join(',');
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${want}`);
    if (!res.ok) throw new Error('fx http ' + res.status);
    const json = await res.json();
    rates = { ...FALLBACK, ...json.rates, EUR:1 };
    live = true;
  } catch {
    rates = { ...FALLBACK };
    live = false;
  }
  return rates;
}

/** Converte um valor em EUR para a moeda pedida. */
export function fromEUR(eur, currency) {
  return eur * (rates[currency] ?? 1);
}

/** true quando a taxa usada veio da tabela de reserva. */
export function isApprox(currency) {
  return !live || !(ECB.has(currency) || currency === 'EUR');
}

/** Formata um valor em EUR na moeda pedida, sem centavos. */
export function money(eur, currency, { compact = false } = {}) {
  const v = fromEUR(eur, currency);
  const opts = { style:'currency', currency, maximumFractionDigits:0, minimumFractionDigits:0 };
  if (compact && Math.abs(v) >= 10000) { opts.notation = 'compact'; opts.maximumFractionDigits = 1; }
  try { return new Intl.NumberFormat('pt-BR', opts).format(v); }
  catch { return `${symbolOf(currency) || currency} ${Math.round(v).toLocaleString('pt-BR')}`; }
}
