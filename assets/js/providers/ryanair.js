/* ==========================================================================
   Preços de voo REAIS — Ryanair (grátis, sem chave, sem servidor)
   --------------------------------------------------------------------------
   A Ryanair expõe publicamente a API que alimenta o "Fare Finder" do próprio
   site. Ela responde com `Access-Control-Allow-Origin: *`, então o navegador
   pode chamar direto: não precisa de chave, de cadastro nem de proxy.

   O que ela devolve: os ~20 destinos MAIS BARATOS saindo de um aeroporto,
   com preço real de ida e volta e as datas exatas. É exatamente a pergunta
   que este site faz, então encaixa bem.

   Limites honestos:
   · só voos da Ryanair — Europa, Marrocos, Turquia, Jordânia e Israel;
   · quem sai do Brasil (ou de fora dessa malha) continua vendo estimativa;
   · o parâmetro `offset` é ignorado pela API: são sempre os 20 mais baratos;
   · é uma API não documentada: pode mudar sem aviso. Por isso toda falha aqui
     é silenciosa e o site volta sozinho para a estimativa.
   ======================================================================== */

import { distanceKm } from '../engine.js';

const AIRPORTS_URL = 'https://www.ryanair.com/api/views/locate/5/airports/en/active';
const FARES_URL    = 'https://services-api.ryanair.com/farfnd/v4/roundTripFares';

/** Detalhes de um trecho: horários, número do voo e duração em minutos. */
const detalhesDoTrecho = l => {
  if (!l) return null;
  const saida = l.departureDate, chegada = l.arrivalDate;
  const minutos = (saida && chegada)
    ? Math.round((new Date(chegada) - new Date(saida)) / 60000)
    : null;
  return {
    from: l.departureAirport?.iataCode,
    to: l.arrivalAirport?.iataCode,
    fromCity: l.departureAirport?.city?.name || l.departureAirport?.name,
    toCity: l.arrivalAirport?.city?.name || l.arrivalAirport?.name,
    depart: saida,
    arrive: chegada,
    flight: l.flightNumber,
    minutos,
    price: Math.round(l.price?.value ?? 0),
  };
};

const CACHE_AIRPORTS = 'ppi.ryanair.airports.v1';
const CACHE_FARES    = 'ppi.ryanair.fares.v1.';
const TTL_AIRPORTS   = 7 * 24 * 3600e3;   // 7 dias
const TTL_FARES      = 6 * 3600e3;        // 6 horas

/* --------------------------------------------------------------- cache --- */
function readCache(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    return Date.now() - t < ttl ? v : null;
  } catch { return null; }
}
function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify({ t:Date.now(), v:value })); } catch {}
}

/* ------------------------------------------------------------ aeroportos - */
let airportsPromise = null;

/** Lista de aeroportos da Ryanair com coordenadas. Cacheada por 7 dias. */
export function loadAirports() {
  if (airportsPromise) return airportsPromise;

  const cached = readCache(CACHE_AIRPORTS, TTL_AIRPORTS);
  if (cached) { airportsPromise = Promise.resolve(cached); return airportsPromise; }

  airportsPromise = fetch(AIRPORTS_URL)
    .then(r => r.ok ? r.json() : Promise.reject(new Error('airports ' + r.status)))
    .then(rows => {
      const list = rows
        .filter(a => a.coordinates?.latitude && a.code)
        .map(a => ({
          iata: a.code,
          name: a.name,
          city: a.city?.name || a.name,
          country: a.country?.name || '',
          lat: a.coordinates.latitude,
          lon: a.coordinates.longitude,
        }));
      writeCache(CACHE_AIRPORTS, list);
      return list;
    })
    .catch(() => { airportsPromise = null; return []; });

  return airportsPromise;
}

/** Aeroporto da malha Ryanair mais próximo de um ponto, dentro de maxKm. */
export function nearestAirport(airports, point, maxKm = 150) {
  return nearestAirports(airports, point, maxKm, 1)[0] || null;
}

/**
 * Os N aeroportos Ryanair mais próximos, ordenados por distância.
 *
 * Usar só o mais próximo empobrecia o resultado: quem está em Nuoro via apenas
 * Olbia (10 rotas), quando Cagliari e Alghero estão na mesma ilha e somam
 * muito mais destinos. O raio maior existe para isso — a distância de cada um
 * é mostrada na tela, para a pessoa julgar se compensa.
 */
export function nearestAirports(airports, point, maxKm = 260, limite = 3) {
  return airports
    .map(a => ({ ...a, km: Math.round(distanceKm(point, a)) }))
    .filter(a => a.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limite);
}

/* ---------------------------------------------------------------- datas -- */
const iso = d => d.toISOString().slice(0, 10);

/** Janela de busca para o mês escolhido, respeitando a data de hoje. */
export function searchWindow(month, days) {
  const now = new Date();
  const year = month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();

  const first = new Date(Date.UTC(year, month, 1));
  const last  = new Date(Date.UTC(year, month + 1, 0));

  // não adianta procurar voo para ontem; a Ryanair também não vende para hoje
  const min = new Date(Date.now() + 3 * 864e5);
  const outFrom = first < min ? min : first;

  const outTo = new Date(last); outTo.setUTCDate(outTo.getUTCDate() - days);
  const inFrom = new Date(outFrom); inFrom.setUTCDate(inFrom.getUTCDate() + days - 1);

  return {
    outFrom: iso(outFrom),
    outTo:   iso(outTo > outFrom ? outTo : outFrom),
    inFrom:  iso(inFrom),
    inTo:    iso(last),
    valid:   outFrom <= last,
  };
}

/* ----------------------------------------------------------- tarifas ----- */
/**
 * Busca as tarifas reais de ida e volta saindo de um aeroporto.
 * @returns {Promise<Map<string, object>>} IATA de chegada -> tarifa
 */
export async function fetchFares(originIata, month, days, signal, country = null) {
  const w = searchWindow(month, days);
  if (!w.valid) return new Map();

  const key = `${CACHE_FARES}${originIata}.${month}.${days}.${country || 'all'}`;
  const cached = readCache(key, TTL_FARES);
  if (cached) return new Map(cached);

  const qs = new URLSearchParams({
    departureAirportIataCode: originIata,
    outboundDepartureDateFrom: w.outFrom,
    outboundDepartureDateTo:   w.outTo,
    inboundDepartureDateFrom:  w.inFrom,
    inboundDepartureDateTo:    w.inTo,
    durationFrom: Math.max(1, days - 1),
    durationTo:   days + 1,
    currency: 'EUR',
    limit: 20,          // máximo aceito pela API
    offset: 0,
    ...(country ? { arrivalCountryCode: country } : {}),
  });

  let rows;
  try {
    const res = await fetch(`${FARES_URL}?${qs}`, { signal });
    if (!res.ok) throw new Error('fares ' + res.status);
    rows = (await res.json()).fares || [];
  } catch { return new Map(); }

  const best = new Map();
  for (const f of rows) {
    const o = f.outbound, i = f.inbound;
    const iata = o.arrivalAirport?.iataCode;
    const price = f.summary?.price?.value;
    if (!iata || !Number.isFinite(price)) continue;
    if (best.has(iata) && best.get(iata).price <= price) continue;

    best.set(iata, {
      iata,
      price: Math.round(price),                       // ida e volta, por pessoa, EUR
      city: o.arrivalAirport.city?.name || iata,
      country: o.arrivalAirport.countryName || '',
      outDate: o.departureDate?.slice(0, 10),
      inDate:  i?.departureDate?.slice(0, 10),
      outPrice: Math.round(o.price?.value ?? 0),
      inPrice:  Math.round(i?.price?.value ?? 0),
      ida: detalhesDoTrecho(o),                       // horários e número do voo
      volta: detalhesDoTrecho(i),
      originIata,
    });
  }

  writeCache(key, [...best]);
  return best;
}

/**
 * Busca ampla: a consulta sem filtro devolve só os 20 destinos mais baratos,
 * então varremos também país a país. Em Milão-Bergamo isso levou a cobertura
 * de 19 para 67 destinos com preço real.
 *
 * Roda em duas ondas para a tela não ficar esperando: primeiro a consulta
 * geral (rápida), depois os países, em grupos de 4 para não atropelar a API.
 *
 * @param {function} aoProgredir chamado a cada onda com o Map acumulado
 */
export async function fetchAllFares(originIata, month, days, countries, signal, aoProgredir) {
  const total = new Map();

  const juntar = novas => {
    for (const [iata, f] of novas) {
      if (!total.has(iata) || total.get(iata).price > f.price) total.set(iata, f);
    }
  };

  juntar(await fetchFares(originIata, month, days, signal));
  if (signal?.aborted) return total;
  aoProgredir?.(total);

  const fila = [...countries];
  const LOTE = 4;
  while (fila.length && !signal?.aborted) {
    const grupo = fila.splice(0, LOTE);
    const res = await Promise.all(
      grupo.map(cc => fetchFares(originIata, month, days, signal, cc).catch(() => new Map())),
    );
    res.forEach(juntar);
  }

  return total;
}

/* ------------------------------------------ casamento com a nossa base --- */
/**
 * Liga cada tarifa real ao destino correspondente da nossa lista, pelo
 * aeroporto mais próximo da cidade (Bergamo→Milão, Charleroi→Bruxelas…).
 * @returns {Map<string, object>} id do destino -> tarifa
 */
export function matchFares(fares, airports, destinations, maxKm = 130) {
  const byIata = new Map(airports.map(a => [a.iata, a]));
  const out = new Map();

  for (const [iata, fare] of fares) {
    const apt = byIata.get(iata);
    if (!apt) continue;

    let best = null, bestKm = Infinity;
    for (const d of destinations) {
      const km = distanceKm(apt, d);
      if (km < bestKm) { bestKm = km; best = d; }
    }
    if (!best || bestKm > maxKm) continue;

    // se dois aeroportos apontam para a mesma cidade, fica o mais barato
    if (out.has(best.id) && out.get(best.id).price <= fare.price) continue;
    out.set(best.id, { ...fare, airport: apt, airportKm: Math.round(bestKm) });
  }
  return out;
}

/** Link para reservar UM trecho (uma perna de uma conexão). */
export function legBookingUrl(perna, people = 1) {
  return 'https://www.ryanair.com/pt/pt/trip/flights/select?' + new URLSearchParams({
    adults: people, teens:0, children:0, infants:0,
    dateOut: (perna.depart || perna.date || '').slice(0, 10),
    isReturn: 'false',
    originIata: perna.from, destinationIata: perna.to,
    isConnectedFlight: 'false', discount: 0,
  });
}

/** Link direto para a seleção de voo no site da Ryanair. */
export function bookingUrl(fare, people = 1) {
  return 'https://www.ryanair.com/pt/pt/trip/flights/select?' + new URLSearchParams({
    adults: people, teens:0, children:0, infants:0,
    dateOut: fare.outDate, dateIn: fare.inDate, isReturn: 'true',
    originIata: fare.originIata, destinationIata: fare.iata,
    isConnectedFlight: 'false', discount: 0,
  });
}

/* ==========================================================================
   Rede de rotas e conexões
   --------------------------------------------------------------------------
   A Ryanair não vende bilhete com escala entre dois voos dela, mas a malha
   existe: dá para ir de Olbia a Madri parando em Bergamo. Aqui montamos esse
   trajeto para mostrar o caminho — comprando cada trecho separadamente.

   O truque que evita varrer a malha inteira: em vez de perguntar "para onde
   cada um dos 224 aeroportos voa?", perguntamos as rotas da ORIGEM e as do
   DESTINO e cruzamos as duas listas. A interseção já são todas as escalas
   possíveis, com só duas consultas.
   ======================================================================== */

const ROUTES_URL = 'https://www.ryanair.com/api/views/locate/searchWidget/routes/en/airport/';
const CACHE_ROUTES = 'ppi.ryanair.routes.v1.';
const TTL_ROUTES = 7 * 24 * 3600e3;

/** Destinos que a Ryanair serve a partir de um aeroporto. Cache de 7 dias. */
export async function routesFrom(iata, signal) {
  const key = CACHE_ROUTES + iata;
  const cached = readCache(key, TTL_ROUTES);
  if (cached) return cached;

  try {
    const res = await fetch(ROUTES_URL + iata, { signal });
    if (!res.ok) throw new Error('routes ' + res.status);
    const rows = await res.json();
    const list = rows
      .map(r => r.arrivalAirport)
      .filter(a => a?.code)
      .map(a => ({ iata:a.code, city:a.city?.name || a.name, base:!!a.base }));
    writeCache(key, list);
    return list;
  } catch { return []; }
}

/**
 * Preço mais barato de um trecho só de ida, dentro da janela do mês.
 * @param {string|null} desde data mínima de partida (YYYY-MM-DD) — usada para
 *   a segunda perna de uma conexão não sair antes da primeira chegar.
 */
export async function legFare(from, to, month, days, signal, depoisDe = null, antesDe = null) {
  const w = searchWindow(month, days);
  if (!w.valid) return null;

  // `depoisDe`/`antesDe` são data e hora ("2026-10-01T03:10"): a query filtra
  // por dia, e a hora é conferida depois, nos resultados.
  const diaMinimo = depoisDe ? depoisDe.slice(0, 10) : w.outFrom;
  const inicio = diaMinimo > w.outFrom ? diaMinimo : w.outFrom;

  // Quando há hora mínima (é a segunda perna, ou a volta), a janela acompanha
  // essa data em vez de parar no fim do mês escolhido: a volta de quem parte
  // dia 25 cai no mês seguinte, e cortar ali fazia o trajeto sair "só ida".
  const limitePadrao = depoisDe
    ? new Date(new Date(depoisDe).getTime() + 12 * 864e5).toISOString().slice(0, 10)
    : w.inTo;
  const fim = antesDe ? antesDe.slice(0, 10) : limitePadrao;
  if (inicio > fim) return null;

  const key = `ppi.ryanair.leg.v3.${from}.${to}.${month}.${depoisDe || inicio}.${antesDe || fim}`;
  const cached = readCache(key, TTL_FARES);
  if (cached !== null) return cached;

  const qs = new URLSearchParams({
    departureAirportIataCode: from,
    arrivalAirportIataCode: to,
    outboundDepartureDateFrom: inicio,
    outboundDepartureDateTo: fim,
    currency: 'EUR', limit: 10, offset: 0,
  });

  try {
    const res = await fetch(`https://services-api.ryanair.com/farfnd/v4/oneWayFares?${qs}`, { signal });
    if (!res.ok) throw new Error('leg ' + res.status);
    const fares = (await res.json()).fares || [];
    let melhor = null;
    for (const f of fares) {
      const p = f.outbound?.price?.value;
      if (!Number.isFinite(p)) continue;
      // descarta o que parte antes da hora mínima (a API só filtra por dia)
      if (depoisDe && (f.outbound.departureDate || '') < depoisDe) continue;
      if (antesDe  && (f.outbound.departureDate || '') > antesDe)  continue;
      if (!melhor || p < melhor.price) {
        melhor = {
          price: Math.round(p),
          date: f.outbound.departureDate?.slice(0, 10),
          from, to,
          ...detalhesDoTrecho(f.outbound),
        };
      }
    }
    writeCache(key, melhor);
    return melhor;
  } catch { return null; }
}

/**
 * Melhor trajeto com uma escala entre dois aeroportos.
 *
 * Testa só os 3 hubs de menor desvio geográfico: cada candidato custa duas
 * consultas de preço, e voar Olbia→Copenhague→Madri não interessa a ninguém.
 *
 * @returns {Promise<null|{hub, pernas:[{from,to,price,date}], total}>}
 */
export async function findConnection(origin, dest, airports, month, days, signal) {
  const porIata = new Map(airports.map(a => [a.iata, a]));
  const aOrigem = porIata.get(origin.iata);
  const aDestino = porIata.get(dest.iata);
  if (!aOrigem || !aDestino) return null;

  const [daOrigem, doDestino] = await Promise.all([
    routesFrom(origin.iata, signal),
    routesFrom(dest.iata, signal),
  ]);
  if (signal?.aborted) return null;

  const chegaNoDestino = new Set(doDestino.map(r => r.iata));
  const candidatos = daOrigem
    .filter(r => chegaNoDestino.has(r.iata))
    .map(r => {
      const h = porIata.get(r.iata);
      if (!h) return null;
      const desvio = distanceKm(aOrigem, h) + distanceKm(h, aDestino) - distanceKm(aOrigem, aDestino);
      return { ...r, airport:h, desvio };
    })
    .filter(Boolean)
    .sort((a, b) => a.desvio - b.desvio)
    .slice(0, 3);

  if (!candidatos.length) return null;

  // As duas pernas são buscadas em sequência, não em paralelo: a segunda só
  // pode partir depois que a primeira chega. Buscando as duas ao mesmo tempo,
  // cada uma escolhia o dia mais barato por conta própria e o trajeto saía
  // com a conexão acontecendo antes da ida.
  // Uma conexão é um trajeto, não duas viagens: a segunda perna tem de sair
  // entre 2 h e 48 h depois da chegada da primeira. Sem o teto, o site achava
  // o voo mais barato do mês e anunciava "12 dias de espera" como se fosse
  // escala.
  const FOLGA_MIN_H = 2;

  /* Janelas tentadas em ordem, da melhor para a tolerável. O teto é 28 h:
     passar disso deixa de ser escala e vira outra viagem — quem quer ir a um
     lugar não quer dormir dois dias num aeroporto pelo caminho. Se nada couber
     em 28 h, o trajeto é descartado e o site procura outra forma de chegar
     (aeroporto vizinho, ou voo até perto e o resto por terra). */
  const JANELAS = [
    { ateH: 6,  tipo:'curta'    },   // troca de avião na mesma tarde
    { ateH: 12, tipo:'mesmo-dia'},   // ainda no mesmo dia
    { ateH: 28, tipo:'pernoite' },   // uma noite na cidade da escala
  ];

  const somaHoras = (iso, h) =>
    new Date(new Date(iso).getTime() + h * 3600e3).toISOString().slice(0, 19);

  /** Duas pernas encadeadas: A -> hub -> B, tentando janelas cada vez maiores. */
  async function trecho(de, hub, ate, desde, limite = null) {
    const a = await legFare(de, hub, month, days, signal, desde, limite);
    if (!a?.arrive) return null;

    for (const janela of JANELAS) {
      const b = await legFare(
        hub, ate, month, days, signal,
        somaHoras(a.arrive, FOLGA_MIN_H), somaHoras(a.arrive, janela.ateH),
      );
      if (b) return [a, b, janela.tipo];
      if (signal?.aborted) return null;
    }
    return null;
  }

  const trajetos = await Promise.all(candidatos.map(async c => {
    const ida = await trecho(origin.iata, c.iata, dest.iata, null);
    if (!ida) return null;
    const [p1, p2, tipoIda] = ida;

    // Espera real no aeroporto: da CHEGADA de uma perna à PARTIDA da seguinte.
    const esperaEntre = (a, b) => (a?.arrive && b?.depart)
      ? Math.round((new Date(b.depart) - new Date(a.arrive)) / 60000)
      : null;

    // A volta parte depois de a pessoa passar os dias pedidos no destino.
    // Primeiro tentamos a janela justa (a duração pedida, com 3 dias de folga):
    // sem teto, o site pegava o voo mais barato do mês e transformava uma
    // viagem de 7 dias numa de 14. Se nada existir ali — rotas pouco
    // frequentes têm poucos dias por semana — ampliamos e avisamos na tela.
    const base = Math.max(1, days - 1);
    const voltaDesde = somaHoras(p2.arrive, base * 24);

    let volta = await trecho(
      dest.iata, c.iata, origin.iata, voltaDesde, somaHoras(p2.arrive, (base + 3) * 24),
    );
    let voltaAmpliada = false;
    if (!volta) {
      volta = await trecho(
        dest.iata, c.iata, origin.iata, voltaDesde, somaHoras(p2.arrive, (base + 12) * 24),
      );
      voltaAmpliada = !!volta;
    }

    const idaTotal = p1.price + p2.price;
    const voltaTotal = volta ? volta[0].price + volta[1].price : 0;

    return {
      hub: c.airport,
      desvioKm: Math.round(c.desvio),
      pernas: [p1, p2],
      pernasVolta: volta,
      esperaMin: esperaEntre(p1, p2),
      esperaVoltaMin: volta ? esperaEntre(volta[0], volta[1]) : null,
      tipoIda,
      tipoVolta: volta?.[2] || null,
      idaTotal,
      voltaTotal,
      total: idaTotal + voltaTotal,
      completa: !!volta,
      voltaAmpliada,
    };
  }));

  // Ordena por preço, mas uma espera enorme no aeroporto pesa: 10 € de
  // diferença não compensam passar a noite no saguão.
  const custo = t => t.total + Math.max(0, (t.esperaMin ?? 0) - 240) / 60 * 3;
  const validos = trajetos.filter(Boolean).sort((a, b) => custo(a) - custo(b));
  return validos[0] || null;
}

/**
 * Destinos alcançáveis a partir da origem com **uma escala**.
 *
 * Para o filtro do mapa precisamos saber isso de antemão, sem esperar o clique
 * em cada destino. O caminho é: rotas da origem (1 consulta) dão os hubs; as
 * rotas de cada hub dão o alcance total. Limitamos a 14 hubs — priorizando as
 * bases da companhia, que são as mais conectadas — para não disparar cem
 * requisições num aeroporto grande.
 *
 * @returns {Promise<Map<string,string>>} IATA do destino -> IATA da escala
 */
export async function reachableWithStop(originIata, signal, aoProgredir) {
  const diretos = await routesFrom(originIata, signal);
  if (signal?.aborted || !diretos.length) return new Map();

  const hubs = [...diretos]
    .sort((a, b) => (b.base === true) - (a.base === true))
    .slice(0, 14);

  const alcance = new Map();
  const diretosSet = new Set(diretos.map(d => d.iata));

  const LOTE = 4;
  for (let i = 0; i < hubs.length && !signal?.aborted; i += LOTE) {
    const grupo = hubs.slice(i, i + LOTE);
    const listas = await Promise.all(grupo.map(h => routesFrom(h.iata, signal)));

    listas.forEach((destinos, k) => {
      const hub = grupo[k];
      for (const d of destinos) {
        if (d.iata === originIata) continue;
        if (diretosSet.has(d.iata)) continue;        // já tem voo direto
        if (!alcance.has(d.iata)) alcance.set(d.iata, hub.iata);
      }
    });
    aoProgredir?.(alcance);
  }

  return alcance;
}

/** Preço de ida e volta num trecho direto, respeitando a duração pedida. */
export async function directRoundTrip(fromIata, toIata, month, days, signal) {
  const ida = await legFare(fromIata, toIata, month, days, signal);
  if (!ida?.arrive) return null;

  const base = Math.max(1, days - 1);
  const soma = (iso, d) =>
    new Date(new Date(iso).getTime() + d * 864e5).toISOString().slice(0, 19);

  let volta = await legFare(toIata, fromIata, month, days, signal,
    soma(ida.arrive, base), soma(ida.arrive, base + 3));
  let ampliada = false;
  if (!volta) {
    volta = await legFare(toIata, fromIata, month, days, signal,
      soma(ida.arrive, base), soma(ida.arrive, base + 12));
    ampliada = !!volta;
  }
  if (!volta) return null;

  return { ida, volta, price: ida.price + volta.price, ampliada };
}

/**
 * Voo DIRETO para o destino saindo de um aeroporto um pouco mais longe.
 *
 * O site já usa os 3 aeroportos mais próximos, mas isso não basta: quem está em
 * Olbia tem Figari e Alghero mais perto que Cagliari — e só Cagliari voa direto
 * para o Porto. Em vez de oferecer uma escala longa, vale apontar o aeroporto a
 * 189 km que resolve com um voo só.
 *
 * Só consulta preço dos que realmente têm a rota (a malha já está em cache),
 * então o custo é baixo.
 */
export async function directFromNearbyAirport(
  origin, destApt, airports, month, days, signal, jaUsados = [], maxKm = 400,
) {
  const usados = new Set(jaUsados);
  const candidatos = airports
    .map(a => ({ ...a, km: Math.round(distanceKm(origin, a)) }))
    .filter(a => !usados.has(a.iata) && a.iata !== destApt.iata && a.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, 8);

  const comRota = [];
  for (const c of candidatos) {
    const rotas = await routesFrom(c.iata, signal);
    if (signal?.aborted) return null;
    if (rotas.some(r => r.iata === destApt.iata)) comRota.push(c);
    if (comRota.length >= 3) break;             // basta comparar os 3 mais perto
  }
  if (!comRota.length) return null;

  const achados = [];
  for (const c of comRota) {
    const preco = await directRoundTrip(c.iata, destApt.iata, month, days, signal);
    if (signal?.aborted) return null;
    if (preco) achados.push({ saida: c, ...preco });
  }
  if (!achados.length) return null;

  // entre opções parecidas, a mais perto de casa ganha
  achados.sort((a, b) => (a.price + a.saida.km * 0.05) - (b.price + b.saida.km * 0.05));
  return achados[0];
}
