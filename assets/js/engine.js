/* ==========================================================================
   Motor de custo
   --------------------------------------------------------------------------
   Recebe origem + destino + parâmetros da viagem e devolve o custo estimado
   decomposto em voo, hospedagem, comida e transporte/passeios.

   Tudo em EUR. A conversão de moeda acontece só na hora de exibir (fx.js).
   ======================================================================== */

export const STYLES = [
  { key:0, label:'Econômico',   hint:'Hostel ou quarto compartilhado; voo low cost, só bagagem de mão.' },
  { key:1, label:'Equilibrado', hint:'Hotel 3★ ou apartamento; voo em tarifa padrão com bagagem.' },
  { key:2, label:'Conforto',    hint:'Hotel 4★; voo com bagagem, melhor horário e remarcação.' },
];

/* O que entra na conta. Comida e passeios ficam de fora de propósito: variam
   demais de pessoa para pessoa e uma estimativa ali só atrapalharia a decisão. */
export const MODES = {
  both:   { label:'Voo + hospedagem', short:'voo + hospedagem', flight:true,  stay:true  },
  flight: { label:'Só o voo',         short:'só o voo',         flight:true,  stay:false },
  stay:   { label:'Só hospedagem',    short:'só hospedagem',    flight:false, stay:true  },
};

export const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/* --------------------------------------------------------- sazonalidade --- */
/* Fator por mês (índice 0 = janeiro). >1 = alta temporada, mais caro.        */
const SEASON = {
  'EUR-W':   [.86,.84,.92,1.02,1.08,1.22,1.30,1.28,1.10,.98,.86,1.12],
  'EUR-N':   [.84,.82,.90,1.00,1.10,1.25,1.32,1.26,1.06,.94,.84,1.10],
  'EUR-E':   [.84,.82,.90,1.00,1.06,1.18,1.26,1.24,1.06,.96,.84,1.08],
  'EUR-MED': [.78,.78,.86,1.00,1.10,1.20,1.36,1.38,1.16,.98,.80,.92],
  'MENA':    [1.12,1.10,1.16,1.14,1.00,.86,.82,.84,.96,1.14,1.16,1.20],
  'ME':      [1.14,1.12,1.14,1.08,.94,.84,.82,.84,.94,1.10,1.16,1.22],
  'AFR':     [1.18,1.10,.96,.90,.88,1.00,1.16,1.18,1.00,.96,1.02,1.20],
  'ASIA-SE': [1.24,1.20,1.08,1.00,.88,.86,1.08,1.10,.88,.90,1.04,1.26],
  'ASIA-E':  [.90,.92,1.18,1.22,1.04,.92,1.06,1.08,1.02,1.18,1.02,.96],
  'ASIA-S':  [1.20,1.18,1.06,.94,.84,.80,.82,.84,.90,1.02,1.14,1.24],
  'ASIA-C':  [.86,.86,.92,1.00,1.08,1.16,1.18,1.16,1.08,.98,.86,.90],
  'NAM':     [.86,.86,.98,1.02,1.06,1.20,1.24,1.20,1.04,1.00,.94,1.16],
  'CAM':     [1.24,1.22,1.20,1.08,.92,.88,1.02,.86,.82,.88,1.02,1.24],
  'CAR':     [1.26,1.26,1.22,1.08,.92,.88,.98,.84,.80,.86,1.00,1.26],
  'SAM':     [1.22,1.16,.98,.90,.86,.92,1.14,1.02,.92,.94,1.02,1.22],
  'OCE':     [1.24,1.18,1.04,.96,.88,.86,.94,.92,.96,1.04,1.10,1.24],
};
const seasonFactor = (region, month) => SEASON[region]?.[month] ?? 1;

/* ----------------------------------------------------------- distâncias --- */
const R = 6371;
const rad = d => d * Math.PI / 180;

/** Distância em km entre dois pontos (fórmula de haversine). */
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* Até ~2.800 km a rota direta é a regra (inclui a maior parte dos voos
   domésticos do Brasil e dos trechos dentro da Europa). */
const STOP_DIRECT = 2800;

/** Número provável de escalas. */
export const flightStops = km => km < STOP_DIRECT ? 0 : km < 9000 ? 1 : 2;

/** Horas de voo estimadas (inclui taxi, decolagem e escalas prováveis). */
export function flightHours(km) {
  return +(0.6 + km / 790 + flightStops(km) * 1.4).toFixed(1);
}

/* ------------------------------------------------------------ preço aéreo - */
/* Curva calibrada em tarifas de ida e volta em classe econômica:
   1.000 km ≈ €160 · 3.000 km ≈ €325 · 6.000 km ≈ €525 · 10.000 km ≈ €765.  */
const STYLE_AIR = [0.86, 1.0, 1.34];   // econômico / equilibrado / conforto

/* Dentro da Europa e do Mediterrâneo as rotas curtas são disputadas por
   companhias low cost e saem bem abaixo da curva global. Calibrado contra os
   preços reais da Ryanair: sem este ajuste, Lisboa–Madri saía pelo dobro. */
const EUROPE_BOX = { latMin:27, latMax:72, lonMin:-26, lonMax:46 };   // inclui Madeira, Canárias e Marrocos
export const inEurope = p =>
  p.lat >= EUROPE_BOX.latMin && p.lat <= EUROPE_BOX.latMax &&
  p.lon >= EUROPE_BOX.lonMin && p.lon <= EUROPE_BOX.lonMax;

function lowCostFactor(km, origin, dest) {
  if (!origin || !inEurope(origin) || !inEurope(dest)) return 1;
  return km < 1800 ? 0.74 : km < 2600 ? 0.87 : 1;
}

/** Preço aéreo de ida e volta por pessoa, em EUR. */
export function flightPriceEUR(km, dest, month, style, origin = null) {
  if (km < 60) return 0;
  const base = 40 + 0.55 * Math.pow(km, 0.78);
  const p = base * (dest.air ?? 1) * seasonFactor(dest.region, month)
            * STYLE_AIR[style] * lowCostFactor(km, origin, dest);
  return Math.max(28, Math.round(p));
}

/** Alternativa terrestre (ônibus/trem) de ida e volta, para rotas curtas. */
export function groundPriceEUR(km) {
  if (km > 900) return null;
  return Math.max(18, Math.round(km * 0.085 * 2));
}

/* ----------------------------------------------------------- custo total -- */
/**
 * Calcula o custo da viagem.
 * @param {{lat:number,lon:number,city:string}} origin
 * @param {object} dest      registro de destinations.js
 * @param {object} opts      { days, people, month, style, mode, budgetEUR, realFares }
 */
export function tripCost(origin, dest, opts) {
  const { days, people, month, style, budgetEUR, realFares } = opts;
  const mode = MODES[opts.mode] || MODES.both;
  const km = Math.round(distanceKm(origin, dest));
  const nights = Math.max(1, days);

  const season = seasonFactor(dest.region, month);
  const staySeason = 1 + (season - 1) * 0.6;   // hospedagem oscila menos que o voo

  // Três degraus, nesta ordem, e a tela precisa distinguir os três:
  //  1. `real`  — Ryanair, consultada agora, com link de compra;
  //  2. `visto` — tarifa que alguém viu no Aviasales nos últimos dias, com
  //     companhia, voo e datas, mas sem ninguém confirmar que ainda existe;
  //  3. estimativa — a nossa conta, quando não há nem uma nem outra.
  const real = realFares?.get(dest.id) || null;
  const viaEscala = !real && (opts.viaEscala?.get(dest.id) || null);
  const estimated = flightPriceEUR(km, dest, month, style, origin);

  /* A tarifa vista parte de um aeroporto que pode não ser o de casa — e quando
     ele fica do outro lado do mar, chegar até lá é um voo, não uma caminhada.
     Quem monta a tarifa já resolveu isso: `visto.total` é a soma das duas
     pernas, e é sempre ele que entra na conta. Usar `visto.p` daria o site
     dizendo "vá ao Rio por € 1028" e escondendo a passagem até Roma. */
  const vistoBruto = !real && (opts.vistos?.get(dest.id) || null);
  const totalVisto = vistoBruto ? (vistoBruto.total ?? vistoBruto.p) : null;

  /* Dentro da malha que consultamos ao vivo, a tarifa vista só vale se for
     MAIS BARATA. Sem esta trava o resumo de Santiago de Compostela anunciava
     € 639 — uma tarifa de Paris mais € 216 só para chegar a Paris — enquanto o
     painel logo abaixo mostrava € 114 indo ao Porto de avião e pegando um
     ônibus. Anunciar o pior caminho que o próprio site encontrou é pior que
     não ter a informação.

     Fora da malha a regra se inverte e a tarifa vista entra mesmo sendo cara:
     para o Rio ela diz € 1028, contra os € 527 que a nossa conta estimava, e
     quem está errado é a estimativa. */
  const naMalha = opts.temVooDireto?.has(dest.id) || opts.viaEscala?.has(dest.id);
  const visto = vistoBruto && (!naMalha || totalVisto < estimated) ? vistoBruto : null;

  const airPP = real ? real.price : visto ? totalVisto : estimated;
  const ground = groundPriceEUR(km);
  const useGround = ground !== null && ground < airPP;

  const flight = mode.flight ? (useGround ? ground : airPP) * people : 0;

  // hostel é cobrado por pessoa; quarto é dividido entre 2
  const nightly = dest.stay[style] * staySeason;
  const rooms = style === 0 ? people : Math.ceil(people / 2);
  const stay = mode.stay ? Math.round(nightly * rooms * nights) : 0;

  const total = Math.round(flight + stay);
  const left = budgetEUR - total;
  const verdict = total <= budgetEUR ? 'fit' : total <= budgetEUR * 1.15 ? 'tight' : 'over';

  return {
    dest, km, nights, days, people, style, month,
    hours: flightHours(km), stops: flightStops(km),
    season, useGround, airPP, groundPP: ground,
    real, visto, viaEscala, estimatedAirPP: estimated,
    voaDireto: !!(real || opts.temVooDireto?.has(dest.id)),
    flight, stay, total, left, verdict, mode: opts.mode || 'both',
    perDay: Math.round(total / days),
    nightly: Math.round(nightly),
    usage: budgetEUR > 0 ? total / budgetEUR : 99,
  };
}

/* -------------------------------------------------------------- ranking --- */
const SORTERS = {
  fit:   (a, b) => rank(a) - rank(b) || b.usage - a.usage,
  cheap: (a, b) => a.total - b.total,
  near:  (a, b) => a.km - b.km,
  left:  (a, b) => rank(a) - rank(b) || b.left - a.left,
};
const rank = r => r.verdict === 'fit' ? 0 : r.verdict === 'tight' ? 1 : 2;

/**
 * O destino está dentro do retângulo visível do mapa?
 * `bounds` é um objeto simples ({north, south, east, west}) para o motor não
 * depender do Leaflet. Trata a virada de longitude no antimeridiano.
 */
export function dentroDaArea(b, d) {
  if (d.lat < b.south || d.lat > b.north) return false;
  return b.west <= b.east
    ? d.lon >= b.west && d.lon <= b.east
    : d.lon >= b.west || d.lon <= b.east;
}

/**
 * Calcula todos os destinos e devolve a lista ordenada.
 * @param {array} destinations
 * @param {object} opts  além dos de tripCost: { tags:[], maxHours:number|null }
 */
export function rankDestinations(origin, destinations, opts) {
  const {
    tags = [], maxHours = null, bounds = null, filtro = 'todos',
    manterId = null, temVooDireto = null,
  } = opts;
  const out = [];

  for (const d of destinations) {
    // O destino aberto continua na lista mesmo saindo do enquadramento: ao
    // clicar em Amsterdã o mapa se move, ela saía da área e o painel perdia o
    // trajeto no meio do caminho. Sai só quando a pessoa escolhe outro.
    const fixo = manterId && d.id === manterId;
    if (bounds && !fixo && !dentroDaArea(bounds, d)) continue;      // fora do mapa visível
    if (distanceKm(origin, d) < 80) continue;                       // é a própria cidade
    if (tags.length && !tags.every(t => d.tags.includes(t))) continue;
    const r = tripCost(origin, d, opts);
    // 'direto' pergunta à MALHA, não às tarifas já baixadas: um destino pode
    // ter voo direto sem que o preço tenha sido consultado ainda. Filtrar pelo
    // preço escondia destinos que existem — e, como o preço só é buscado ao
    // abrir o destino, escondê-lo impedia que ele fosse buscado.
    const voaDireto = r.real || temVooDireto?.has(d.id);
    if (filtro === 'direto' && !voaDireto) continue;
    if (filtro === 'confirmado' && !voaDireto && !r.viaEscala) continue;
    if (maxHours && !r.useGround && r.hours > maxHours) continue;
    out.push(r);
  }

  out.sort(SORTERS[opts.sortBy] || SORTERS.fit);
  return out;
}
