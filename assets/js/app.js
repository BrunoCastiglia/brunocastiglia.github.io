/* ==========================================================================
   Pra onde posso ir? — controlador da página
   ======================================================================== */

import { DESTINATIONS, TAG_LABELS } from './data/destinations.js';
import { searchLocal, searchRemote, norm } from './data/origins.js';
import * as GEO from './data/geo.js';
import { MONTHS, STYLES, MODES, rankDestinations } from './engine.js';
import * as FX from './fx.js';
import * as P from './providers/index.js';
import { bookingLinks } from './links.js';
import * as RYA from './providers/ryanair.js';
import * as OSM from './providers/osm-stays.js';
import { mountAllAds } from './ads.js';

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* ----------------------------------------------------------- estado ----- */
const state = {
  currency: 'EUR',
  origin: null,
  budget: 200,                       // na moeda escolhida
  days: 7,
  people: 1,
  month: new Date().getMonth(),
  style: 1,
  mode: 'flight',                    // flight | both | stay — começa só no voo
  tags: [],
  maxHours: null,
  sortBy: 'fit',
  results: [],
  selected: null,
  escolhaManual: false,   // true quando a pessoa digitou a origem
  airports: [],           // malha de aeroportos da Ryanair
  conexao: null,          // trajeto com escala do destino aberto
  filtro: 'todos',        // todos | confirmado (direto+escala) | direto
  viaEscala: new Map(),   // destino -> escala, pela malha da Ryanair
  ignorarMove: false,     // true durante movimentos feitos pelo próprio código
  destinoAlvo: null,      // para onde a pessoa quer ir, quando ela diz
  intro: true,            // primeira abertura: anima do mundo até a origem
  realFares: new Map(),   // id do destino -> tarifa real da Ryanair
  originAirport: null,    // aeroporto Ryanair mais próximo da origem
  originAirports: [],     // até 3 aeroportos de partida, por distância
};

const budgetEUR = () => state.budget / FX.fromEUR(1, state.currency);
const fmt = (eur, o) => FX.money(eur, state.currency, o);

/* ------------------------------------------------------------- mapa ----- */
let map, layerDest, originMarker, routeLine;
const markers = new Map();

function initMap() {
  map = L.map('map', { zoomControl:false, worldCopyJump:true, minZoom:2, attributionControl:true })
        .setView([30, 5], 3);
  L.control.zoom({ position:'topright' }).addTo(map);

  // Tiles raster do OpenStreetMap, escurecidos pelo filtro CSS aplicado em
  // .leaflet-tile-pane.
  //
  // Já tentamos o mapa vetorial do OpenFreeMap via maplibre-gl-leaflet: é mais
  // bonito e igualmente gratuito, mas o plugin desenha o basemap num canvas
  // maior que o container e, ao arrastar ou dar zoom out, o basemap sai do
  // lugar em relação aos marcadores do Leaflet — os pinos apareciam no oceano.
  // Um mapa bonito que mostra a cidade errada é pior que um mapa simples.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18, crossOrigin: true,
  }).addTo(map);

  // Só invalidateSize(): a camada GL escuta o evento 'resize' do Leaflet e
  // reposiciona o próprio canvas. Chamar resize() do MapLibre por fora
  // desalinha o mapa, porque o plugin mantém um canvas maior deslocado.
  let resizeTimer;
  const syncSize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => map.invalidateSize({ animate:false }), 80);
  };
  if (window.ResizeObserver) new ResizeObserver(syncSize).observe($('#map'));
  window.addEventListener('resize', syncSize);
  window.addEventListener('orientationchange', syncSize);

  layerDest = L.layerGroup().addTo(map);
  criarCamadaDeRota();
}

/* ---------------------------------------- arco da rota (só visual) ------ */
let svgRota, pathRota, pathSombra;

/**
 * Desenha, ao passar o mouse num destino, um arco fino ligando a origem a ele.
 * É enfeite: fica numa camada SVG própria, por cima do mapa e sem capturar
 * cliques, e some assim que o ponteiro sai ou o mapa se mexe.
 */
function criarCamadaDeRota() {
  svgRota = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgRota.setAttribute('class', 'rota-layer');
  svgRota.innerHTML = `
    <defs>
      <linearGradient id="rotaGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="#63a8ff" stop-opacity=".15"/>
        <stop offset="45%"  stop-color="#63a8ff" stop-opacity=".95"/>
        <stop offset="100%" stop-color="#2dd4a7" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <path class="rota-sombra"/>
    <path class="rota-linha"/>`;
  document.querySelector('.map-wrap').appendChild(svgRota);
  pathSombra = svgRota.querySelector('.rota-sombra');
  pathRota   = svgRota.querySelector('.rota-linha');

  map.on('movestart zoomstart', () => {
    if (!state.selected) svgRota?.classList.remove('is-on', 'is-conexao');
  });
  map.on('moveend zoomend', () => { if (state.selected) desenharRotaFixa(); });
}

/**
 * Some com o arco do hover — mas se há um destino selecionado, o arco dele
 * volta: enquanto a pessoa não trocar de destino, o trajeto fica na tela.
 */
function esconderRota() {
  if (state.selected) return desenharRotaFixa();
  svgRota?.classList.remove('is-on', 'is-conexao');
}

/** Redesenha o trajeto do destino selecionado (com escala, se houver). */
function desenharRotaFixa() {
  const r = state.results.find(x => x.dest.id === state.selected);
  if (!r) { svgRota?.classList.remove('is-on', 'is-conexao'); return; }
  if (state.conexao && state.conexao.destId === state.selected) {
    desenharConexao(state.conexao);
  } else {
    svgRota?.classList.remove('is-conexao');
    mostrarRota(r.dest);
  }
}

/** Curva de A até B com a barriga proporcional à distância na tela. */
function mostrarRota(dest) {
  if (!state.origin || !svgRota) return;
  const a = map.latLngToContainerPoint([state.origin.lat, state.origin.lon]);
  const b = map.latLngToContainerPoint([dest.lat, dest.lon]);

  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) return;

  // ponto de controle perpendicular ao meio do trajeto: dá a sensação de arco
  const altura = Math.min(160, 24 + dist * 0.22);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const cx = mx - (dy / dist) * altura;
  const cy = my + (dx / dist) * altura;

  const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
  pathRota.setAttribute('d', d);
  pathSombra.setAttribute('d', d);

  // reinicia o traço para a linha ser "desenhada" a cada vez
  const comp = pathRota.getTotalLength();
  for (const el of [pathRota, pathSombra]) {
    el.style.transition = 'none';
    el.style.strokeDasharray = comp;
    el.style.strokeDashoffset = comp;
  }
  svgRota.classList.add('is-on');
  // força o navegador a assumir o estado inicial antes de animar
  void pathRota.getBoundingClientRect();
  for (const el of [pathRota, pathSombra]) {
    el.style.transition = 'stroke-dashoffset .55s cubic-bezier(.32,.72,.3,1)';
    el.style.strokeDashoffset = '0';
  }
}

function pinIcon(html, cls) {
  return L.divIcon({ className:'pin-wrap', html:`<div class="${cls}">${html}</div>`, iconSize:[0,0] });
}

function drawOrigin() {
  if (originMarker) originMarker.remove();
  if (!state.origin) return;
  originMarker = L.marker([state.origin.lat, state.origin.lon], {
    icon: pinIcon('◉ ' + esc(state.origin.city), 'pin pin-origin'), zIndexOffset: 1200,
  }).addTo(map);
}

function drawResults() {
  layerDest.clearLayers();
  markers.clear();

  for (const r of state.results) {
    const over = r.verdict === 'over';
    // estrela dourada = o voo deste destino tem preço real, não estimativa
    const estrela = r.real && !r.useGround ? '<i class="pin-star">★</i>' : '';
    const label = over ? '' : estrela + esc(fmt(r.total, { compact:true }));
    const cls = `pin pin-${r.verdict}`
      + (over ? ' pin-dot' : '')
      + (r.real && !over ? ' pin-real' : '');
    const m = L.marker([r.dest.lat, r.dest.lon], {
      icon: pinIcon(label, cls),
      zIndexOffset: over ? 0 : r.real ? 800 : r.verdict === 'fit' ? 600 : 300,
      riseOnHover: true,
    });
    m.bindTooltip(
      `<b>${esc(r.dest.city)}</b>, ${esc(r.dest.country)}<br>
       ${fmt(r.total)} · ${r.days} dias
       ${r.real && !r.useGround
         ? `<br><span class="tip-real">★ voo com preço real: ${fmt(r.real.price)}</span>`
         : '<br><span class="tip-est">valor estimado</span>'}`,
      { direction:'top', offset:[0,-14], className:'dest-tip' },
    );
    m.on('click', () => select(r.dest.id, { fly:false }));
    m.on('mouseover', () => mostrarRota(r.dest));
    m.on('mouseout', esconderRota);
    m.addTo(layerDest);
    markers.set(r.dest.id, m);
  }
  paintSelection();
}

function paintSelection() {
  for (const [id, m] of markers) {
    const node = m.getElement()?.firstElementChild;
    if (node) node.classList.toggle('is-selected', id === state.selected);
  }
  if (routeLine) { routeLine.remove(); routeLine = null; }
  const r = state.results.find(x => x.dest.id === state.selected);
  if (r && state.origin) {
    routeLine = L.polyline(
      [[state.origin.lat, state.origin.lon], [r.dest.lat, r.dest.lon]],
      { color:'#63a8ff', weight:1.6, opacity:.75, dashArray:'5 6' },
    ).addTo(map);
  }
}

/** Retângulo visível do mapa, no formato simples que o motor espera. */
function areaVisivel() {
  if (!map) return null;
  const b = map.getBounds();
  return { north:b.getNorth(), south:b.getSouth(), east:b.getEast(), west:b.getWest() };
}

/**
 * A busca acompanha o mapa: mexeu, procura de novo só no que está à vista.
 * Movimentos disparados pelo próprio site (a abertura, o clique num destino)
 * não contam — senão a lista se refazia sozinha a cada clique.
 */
let areaTimer;
function observarMapa() {
  map.on('moveend zoomend', () => {
    if (state.intro) return;
    if (state.ignorarMove) { state.ignorarMove = false; return; }
    clearTimeout(areaTimer);
    areaTimer = setTimeout(() => search({ refit:false }), 280);
  });
}

function fitToResults() {
  // Na primeira abertura o mapa parte do mundo inteiro e se aproxima da
  // origem, para a pessoa entender de onde a busca está saindo.
  if (state.intro) {
    const destino = [state.origin.lat, state.origin.lon];
    map.setView([20, 0], 2, { animate:false });

    // Tempo total da abertura abaixo de 2 s: 0,3 s parado no mundo + 1,5 s de voo.
    setTimeout(() => {
      map.flyTo(destino, 5, { duration:1.5, easeLinearity:.3 });

      // O flyTo do Leaflet roda em requestAnimationFrame, que fica congelado
      // quando a aba está em segundo plano — a animação não sairia do lugar.
      // Se ela não tiver andado, colocamos o mapa no destino sem animar.
      setTimeout(() => {
        if (Math.abs(map.getZoom() - 5) > 0.4) map.setView(destino, 5, { animate:false });
        // 0,3 s + 1,6 s = 1,9 s no pior caso, quando este atalho é quem
        // conclui a abertura. Com a animação rodando, termina em 1,8 s.
        state.intro = false;
        search({ refit:false });        // agora sim: só o que está à vista
      }, 1600);
    }, 300);
    return;
  }

  // Fora da abertura o mapa não se mexe sozinho: o enquadramento é escolha de
  // quem está navegando, e a busca é que se ajusta ao que está à vista.
}

/* -------------------------------------------------------- resultados --- */
function search({ refit = true } = {}) {
  if (!state.origin) return;
  $('#mapLoading').hidden = false;
  $('#btnSearch').disabled = true;

  // Cede o thread para o navegador pintar o "calculando" antes do trabalho
  // síncrono. Usamos setTimeout e NÃO requestAnimationFrame: rAF fica parado
  // enquanto a aba está em segundo plano, e a busca nunca rodaria.
  setTimeout(() => {
    state.results = rankDestinations(state.origin, DESTINATIONS, {
      days: state.days, people: state.people, month: state.month, style: state.style,
      mode: state.mode, budgetEUR: budgetEUR(), tags: state.tags,
      maxHours: state.maxHours, sortBy: state.sortBy, realFares: state.realFares,
      filtro: state.filtro, viaEscala: state.viaEscala, bounds: areaVisivel(),
    });

    renderStats();
    drawResults();
    if (refit) fitToResults();

    const still = state.results.find(r => r.dest.id === state.selected);
    if (still) renderDetails(still); else clearDetails();

    $('#mapLoading').hidden = true;
    $('#btnSearch').disabled = false;
  }, 0);
}

/* ------------------------------------------- tarifas reais (Ryanair) ---- */
let faresAbort;

/* Os códigos ISO que a nossa base usa já são os que a API espera. */
const PAIS_ISO = Object.fromEntries(DESTINATIONS.map(d => [d.cc, true]));

/**
 * Busca preços reais de voo e, se vierem, refaz a conta com eles.
 * Roda em segundo plano: o site já mostrou as estimativas e só melhora
 * quando a resposta chega. Qualquer falha é silenciosa.
 */
async function loadRealFares() {
  if (!state.origin) return;
  faresAbort?.abort();
  faresAbort = new AbortController();
  const signal = faresAbort.signal;

  setFareStatus('loading');
  try {
    const airports = await RYA.loadAirports();
    if (signal.aborted) return;
    if (!airports.length) return setFareStatus('none');

    state.airports = airports;

    // Até 3 aeroportos de partida. Quem está no interior da Sardenha tem
    // Olbia, Cagliari e Alghero à volta — considerar só um escondia a maior
    // parte das rotas possíveis.
    const saidas = RYA.nearestAirports(airports, state.origin, 260, 3);
    state.originAirports = saidas;
    state.originAirport = saidas[0] || null;
    if (!saidas.length) { state.realFares = new Map(); return setFareStatus('uncovered'); }

    // países da malha Ryanair onde temos destinos: é o que vale consultar
    const naMalha = new Set(airports.map(a => a.country));
    const paises = [...new Set(
      DESTINATIONS
        .filter(d => naMalha.has(d.country) || PAIS_ISO[d.cc])
        .map(d => d.cc.toLowerCase()),
    )];

    // Tarifas de todas as saídas, juntadas: para cada destino fica a mais
    // barata, junto com o aeroporto de onde ela parte.
    const acumulado = new Map();
    const juntar = (novas, saida) => {
      for (const [iata, f] of novas) {
        const anterior = acumulado.get(iata);
        if (!anterior || anterior.price > f.price) {
          acumulado.set(iata, { ...f, saida });
        }
      }
    };

    const aplicar = () => {
      if (signal.aborted) return;
      state.realFares = RYA.matchFares(acumulado, airports, DESTINATIONS);
      setFareStatus('ok');
      search({ refit:false });                  // refaz a conta com preço real
    };

    // Primeiro a consulta geral de cada saída (rápida), depois a varredura por
    // país — assim a tela responde antes de a busca completa terminar.
    for (const saida of saidas) {
      const rapidas = await RYA.fetchFares(saida.iata, state.month, state.days, signal);
      if (signal.aborted) return;
      juntar(rapidas, saida);
      aplicar();
    }

    for (const saida of saidas) {
      const todas = await RYA.fetchAllFares(
        saida.iata, state.month, state.days, paises, signal,
        parciais => { juntar(parciais, saida); aplicar(); },
      );
      if (signal.aborted) return;
      juntar(todas, saida);
      aplicar();
    }

    if (!acumulado.size) { state.realFares = new Map(); return setFareStatus('none'); }

    // Rede de escalas das três saídas, para o filtro do mapa.
    const alcanceTotal = new Map();
    for (const saida of saidas) {
      const alcance = await RYA.reachableWithStop(saida.iata, signal, parcial => {
        for (const [k, v] of parcial) if (!alcanceTotal.has(k)) alcanceTotal.set(k, { hub:v, saida });
        if (!signal.aborted) casarEscalas(alcanceTotal, airports);
      });
      if (signal.aborted) return;
      for (const [k, v] of alcance) if (!alcanceTotal.has(k)) alcanceTotal.set(k, { hub:v, saida });
      casarEscalas(alcanceTotal, airports);
    }
  } catch {
    if (!signal.aborted) setFareStatus('none');
  }
}

/** Liga cada aeroporto alcançável com escala ao destino correspondente. */
function casarEscalas(alcance, airports) {
  const porIata = new Map(airports.map(a => [a.iata, a]));
  const mapa = new Map();

  for (const [iata, info] of alcance) {
    const apt = porIata.get(iata);
    if (!apt) continue;
    let melhor = null, menor = Infinity;
    for (const d of DESTINATIONS) {
      const km = distanciaSimples(apt, d);
      if (km < menor) { menor = km; melhor = d; }
    }
    if (melhor && menor <= 130 && !state.realFares.has(melhor.id)) {
      // info = { hub, saida } — de onde parte e onde faz escala
      mapa.set(melhor.id, info);
    }
  }
  state.viaEscala = mapa;
  setFareStatus('ok');
  search({ refit:false });
}

/* haversine enxuto, só para casar aeroporto com cidade */
function distanciaSimples(a, b) {
  const rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function setFareStatus(kind) {
  const box = $('#fareStatus');
  if (!box) return;
  const n = state.realFares.size;
  const apt = state.originAirport;
  const saidas = state.originAirports.map(a => a.iata).join(', ');
  const texts = {
    loading:   ['…', 'buscando preços reais de voo'],
    ok:        [String(n), `preços reais${saidas ? ' de ' + saidas : ''}`],
    uncovered: ['', 'sem voos Ryanair perto da sua origem — voos estimados'],
    none:      ['', 'preços reais indisponíveis agora — voos estimados'],
  };
  const [num, label] = texts[kind] || texts.none;
  box.dataset.kind = kind;
  box.innerHTML = num
    ? `<b>${num}</b><span>${esc(label)}</span>`
    : `<span>${esc(label)}</span>`;
  box.hidden = false;

  // os botões de filtro só aparecem quando há o que filtrar
  const caixa = $('#mapFiltros');
  const comEscala = state.viaEscala.size;
  if (caixa) {
    caixa.hidden = n === 0;
    $('#countDireto').textContent = n || '';
    $('#countConfirmado').textContent = n + comEscala || '';
    if (!n && state.filtro !== 'todos') {   // ficou sem tarifas: desliga sozinho
      state.filtro = 'todos';
      pintarFiltros();
    }
  }
}

function pintarFiltros() {
  const map3 = { confirmado:'#btnConfirmado', direto:'#btnDireto' };
  for (const [modo, sel] of Object.entries(map3)) {
    const b = $(sel);
    if (!b) continue;
    const on = state.filtro === modo;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  }
}

function renderStats() {
  const c = { fit:0, tight:0, over:0 };
  state.results.forEach(r => c[r.verdict]++);
  $('#statFit').textContent = c.fit;
  $('#statTight').textContent = c.tight;
  $('#statOver').textContent = c.over;
  $('#mapStats').hidden = false;
}

function select(id, { fly = false } = {}) {
  state.selected = id;
  const r = state.results.find(x => x.dest.id === id);
  paintSelection();
  if (!r) return;
  if (fly) {
    state.ignorarMove = true;
    map.panTo([r.dest.lat, r.dest.lon], { duration:.6 });
  }
  renderDetails(r);
  $('#details').dataset.state = 'open';
  $('#detailsHandle').setAttribute('aria-expanded', 'true');
  ajustarAlturaAoConteudo();
  state.conexao = null;
  desenharRotaFixa();
}

/* ---------------------------------------------------------- detalhes --- */
const VERDICT = {
  fit:   { tag:'cabe',      cls:'tag-fit' },
  tight: { tag:'quase lá',  cls:'tag-tight' },
  over:  { tag:'acima',     cls:'tag-over' },
};

function clearDetails() {
  state.selected = null;
  $('#detailsTitle').textContent = 'Selecione um destino no mapa';
  $('#detailsBody').innerHTML =
    `<p class="empty">Clique em um ponto do mapa ou em um destino da lista para ver as opções de voo e hospedagem.</p>
     <div class="ad-strip" aria-hidden="true">
       <div class="ad-slot" data-ad="strip1"></div>
       <div class="ad-slot" data-ad="strip2"></div>
       <div class="ad-slot" data-ad="strip3"></div>
     </div>`;
  mountAllAds($('#detailsBody'));
  // a barra continua aberta na altura escolhida: fechá-la aqui fazia o rodapé
  // sumir sozinho sempre que a seleção era limpa
}

function renderDetails(r) {
  const v = VERDICT[r.verdict];
  const mode = MODES[r.mode] || MODES.both;

  $('#detailsTitle').innerHTML =
    `<span class="tag ${v.cls}">${v.tag}</span> ${esc(r.dest.city)}, ${esc(r.dest.country)}
     — ${fmt(r.total)} · ${mode.short} · ${r.people > 1 ? r.people + ' pessoas · ' : ''}${r.days} dias`;

  const parts = [
    { k:'flight', label:'Voo',        v:r.flight },
    { k:'stay',   label:'Hospedagem', v:r.stay },
  ].filter(p => p.v > 0);
  const sum = parts.reduce((a, p) => a + p.v, 0) || 1;

  const bar = parts.map(p => `<i class="b-${p.k}" style="width:${(p.v / sum * 100).toFixed(1)}%"></i>`).join('');
  const key = parts.map(p => `<span><i class="b-${p.k}"></i>${p.label} ${fmt(p.v)}</span>`).join('');

  const localTxt = (r.dest.cur === state.currency || !mode.stay) ? '' : `
    <p class="local-cur">Moeda local: <b>${r.dest.cur}</b> —
      1 ${state.currency} ≈ ${(FX.fromEUR(1, r.dest.cur) / FX.fromEUR(1, state.currency)).toLocaleString('pt-BR', { maximumFractionDigits:2 })} ${r.dest.cur}.<br>
      A diária escolhida sai por cerca de
      <b>${Math.round(FX.fromEUR(r.nightly, r.dest.cur)).toLocaleString('pt-BR')} ${r.dest.cur}</b>.
      ${FX.isApprox(r.dest.cur) ? '<br><i>Câmbio aproximado.</i>' : ''}
    </p>`;

  // Cada opção é clicável: leva à busca já preenchida no site correspondente.
  const optRow = o => {
    const conteudo = `
      <span class="opt-name">${esc(o.name)}${o.pick ? '<span class="pick">usado no cálculo</span>' : ''}</span>
      <span class="opt-meta">${esc(o.meta || o.unit || '')}</span>
      <span class="opt-price">${fmt(o.price)}${o.nightly ? `<small>${fmt(o.nightly)}/noite</small>` : '<small>por pessoa, ida e volta</small>'}</span>
      ${o.hrefNote ? `<span class="opt-go">${esc(o.hrefNote)} →</span>` : ''}`;
    return o.href
      ? `<a class="opt is-link${o.pick ? ' is-pick' : ''}" href="${o.href}" target="_blank" rel="noopener nofollow">${conteudo}</a>`
      : `<div class="opt${o.pick ? ' is-pick' : ''}">${conteudo}</div>`;
  };

  // Quando a Ryanair devolveu preço real, ele vai em destaque no topo,
  // com as datas exatas e link direto para a seleção do voo.
  const trecho = (t, rotulo) => t ? `
    <div class="trecho">
      <span class="trecho-rotulo">${rotulo}</span>
      <span class="trecho-voo">${esc(t.flight || '')}</span>
      <span class="trecho-horas">
        <b>${fmtDataHora(t.depart)}</b> ${esc(t.from || '')}
        <i>→</i>
        <b>${fmtHora(t.arrive)}</b> ${esc(t.to || '')}
      </span>
      <span class="trecho-dur">${fmtDuracao(t.minutos)} · direto</span>
    </div>` : '';

  const realRow = (r.real && mode.flight) ? `
    <a class="opt is-real is-link" href="${RYA.bookingUrl(r.real, r.people)}" target="_blank" rel="noopener nofollow">
      <span class="opt-name">Ryanair — voo direto<span class="pick pick-real">preço confirmado</span></span>
      <span class="opt-meta">${saidaTexto(r.real)}${r.real.airportKm > 40
        ? ` · chega em ${esc(r.real.airport?.iata || '')}, a ${r.real.airportKm} km de ${esc(r.dest.city)}`
        : ` · chega em ${esc(r.real.airport?.iata || '')}`}</span>
      <span class="opt-price">${fmt(r.real.price)}<small>por pessoa, ida e volta</small></span>
      <div class="trechos">
        ${trecho(r.real.ida, 'ida')}
        ${trecho(r.real.volta, 'volta')}
      </div>
      <span class="opt-go opt-go-real">reservar este voo →</span>
    </a>` : '';

  const ctx     = { origin: state.origin };
  // A linha "Estimativa de mercado" saiu: repetia o valor que já está no
  // Resumo e levava ao mesmo Google do botão ao lado, com um destaque verde
  // que competia com o do preço confirmado. Ficam só as opções reais.
  const flights = P.flightOptions(r, ctx).filter(o => !o.estimativa);

  // Sem voo direto para este destino, oferecemos o aeroporto vizinho que tem.
  const alt = (!r.real && !r.useGround && mode.flight) ? vooDiretoPerto(r) : null;

  // Voar até a cidade vizinha e fazer o último trecho por terra costuma ser o
  // caminho real: Porto fica a 3 h de ônibus de Santiago de Compostela, e isso
  // resolve melhor que uma escala de avião do outro lado da Europa.
  const terra = alt ? P.groundLeg(alt.km) : null;
  const altRow = alt ? `
    <button type="button" class="alt-direto" data-alt="${esc(alt.dest.id)}">
      <span class="alt-tag">★ voo direto até perto + ${esc(terra.modo)}</span>
      <span class="alt-nome">
        Voe até <b>${esc(alt.dest.city)}</b> e siga ${alt.km} km
        até ${esc(r.dest.city)} — ${esc(terra.tempo)} de ${esc(terra.modo)}
      </span>
      <span class="alt-meta">${esc(alt.fare.ida?.flight || '')} · ${
        alt.fare.ida?.minutos ? fmtDuracao(alt.fare.ida.minutos) + ' de voo' : 'voo direto'} ·
        parte de ${esc(alt.fare.saida?.iata || alt.fare.originIata || '')} ·
        ${esc(terra.modo)} ida e volta ≈ ${fmt(terra.preco)}</span>
      <span class="alt-preco">${fmt(alt.fare.price + terra.preco)}<small>voo + ${esc(terra.modo)}</small></span>
      <span class="alt-ir">ver ${esc(alt.dest.city)} →</span>
    </button>` : '';
  const stays   = P.stayOptions(r, ctx);
  const links   = bookingLinks(state.origin, r, state.month)
                    .filter(l => (mode.flight && l.kind === 'flight') || (mode.stay && l.kind === 'stay'));

  $('#detailsBody').innerHTML = `
    <div class="dgrid dgrid-${r.mode}">

      <section class="dcol">
        <h4>Resumo</h4>
        <div class="sum-total"><b>${fmt(r.total)}</b><span>${mode.short}</span></div>
        <p class="sum-left ${r.left >= 0 ? 'ok' : 'bad'}">
          ${r.left >= 0
            ? `Sobram ${fmt(r.left)} do seu orçamento de ${fmt(budgetEUR())}.`
            : `Faltam ${fmt(-r.left)} para o seu orçamento de ${fmt(budgetEUR())}.`}
        </p>
        ${parts.length > 1 ? `<div class="bar">${bar}</div><div class="bar-key">${key}</div>` : ''}
        ${localTxt}
      </section>

      ${mode.flight ? `
      <section class="dcol">
        <h4>Como chegar · ${r.useGround ? 'rota terrestre' : `${Math.round(r.km).toLocaleString('pt-BR')} km`}</h4>
        ${realRow}
        ${altRow}
        <div class="conexao" id="conexaoBox" hidden></div>
        ${flights.map(optRow).join('')}
        ${(!r.real && !r.useGround) ? `
          <p class="sem-confirmado" id="semConfirmado">
            Sem preço confirmado para esta rota. O valor de <b>${fmt(r.flight || r.airPP)}</b>
            no resumo é estimativa de planejamento — confira na busca ao lado.
          </p>` : ''}
      </section>` : ''}

      ${mode.stay ? `
      <section class="dcol">
        <h4>Hospedagem · ${r.nights} noites</h4>
        ${stays.map(optRow).join('')}
        <p class="osm-stays" id="osmStays" hidden></p>
      </section>` : ''}

      <section class="dcol">
        <h4>${mode.flight && !mode.stay ? 'Pesquisar voo' : 'Pesquisar'}</h4>
        <div class="book book-abas" id="abasBusca">
          ${links.map(l => `<a class="aba" href="${l.href}" target="_blank" rel="noopener nofollow">
             <b>${esc(l.label)}</b><span>${esc(l.note)}</span></a>`).join('')}
        </div>
        <p class="disclaimer">${r.real && mode.flight
          ? `O voo em destaque é preço real da Ryanair, buscado agora${mode.stay ? '; a hospedagem é estimativa' : ''}.`
          : `Estimativa de planejamento (distância, temporada de ${MONTHS[state.month].toLowerCase()}${mode.stay ? ' e preço de hospedagem local' : ''}) — não é cotação.`}
          Comida e passeios não entram nesta conta.</p>
      </section>
    </div>

    <div class="ad-strip" aria-hidden="true">
      <div class="ad-slot" data-ad="strip1"></div>
      <div class="ad-slot" data-ad="strip2"></div>
      <div class="ad-slot" data-ad="strip3"></div>
    </div>`;

  $('#detailsBody').querySelector('[data-alt]')?.addEventListener('click', e => {
    select(e.currentTarget.dataset.alt, { fly:true });
  });

  mountAllAds($('#detailsBody'));
  // Sem voo confirmado, a busca deixa de ser um link lateral e passa a ser o
  // caminho principal: em vez de a tela parecer um beco sem saída, ela oferece
  // o atalho para a pessoa procurar por conta própria.
  realcarBusca(mode.flight && !r.real && !r.useGround);
  if (mode.stay) showOsmStays(r.dest);
  if (mode.flight && !r.real && !r.useGround) buscarConexao(r);
}

/**
 * Destino vizinho que TEM voo direto com preço confirmado.
 *
 * Olbia sem voo direto de Porto levava a um trajeto com duas escalas e dois
 * dias em Bergamo — enquanto Cagliari, na mesma ilha, tem voo direto. Vale
 * mais oferecer o aeroporto ao lado do que um trajeto sofrido.
 *
 * Procura em todas as tarifas conhecidas (não só nas visíveis no mapa) e
 * devolve a mais próxima dentro de 350 km.
 */
function vooDiretoPerto(r, maxKm = 350) {
  let melhor = null;
  for (const [destId, fare] of state.realFares) {
    if (destId === r.dest.id) continue;
    const d = DESTINATIONS.find(x => x.id === destId);
    if (!d) continue;
    const km = Math.round(distanciaSimples(d, r.dest));
    if (km > maxKm) continue;
    if (!melhor || km < melhor.km) melhor = { dest:d, fare, km };
  }
  return melhor;
}

/** Liga ou desliga o destaque dourado da coluna de busca. */
function realcarBusca(ligado) {
  const abas = $('#abasBusca');
  const col = abas?.closest('.dcol');
  if (!abas) return;
  abas.classList.toggle('is-ouro', ligado);
  col?.classList.toggle('dcol-ouro', ligado);
}

/**
 * Voo até uma cidade vizinha do destino + o último trecho por terra.
 *
 * É o caminho que as pessoas realmente fazem: para Santiago de Compostela sem
 * voo direto, voa-se até o Porto e pegam-se 3 h de ônibus. O site só encontrava
 * isso quando a cidade vizinha por acaso já tinha tarifa em cache — agora ele
 * procura de propósito, inclusive partindo de outro aeroporto perto de casa.
 *
 * @returns {Promise<null|{dest, km, fare, terra, total, saida}>}
 */
async function vooMaisTerra(r, signal, maxKm = 350) {
  const vizinhos = DESTINATIONS
    .filter(d => d.id !== r.dest.id)
    .map(d => ({ d, km: Math.round(distanciaSimples(d, r.dest)) }))
    .filter(v => v.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, 4);

  const achados = [];
  for (const v of vizinhos) {
    const terra = P.groundLeg(v.km);

    // 1) já temos tarifa confirmada para essa cidade?
    const jaTem = state.realFares.get(v.d.id);
    if (jaTem) {
      achados.push({ ...v, fare:jaTem, terra, saida:jaTem.saida, total:jaTem.price + terra.preco });
      continue;
    }

    // 2) senão, existe voo direto até ela saindo de algum aeroporto perto?
    const apt = RYA.nearestAirport(state.airports, v.d, 130);
    if (!apt) continue;
    const direto = await RYA.directFromNearbyAirport(
      state.origin, apt, state.airports, state.month, state.days, signal, [],
    );
    if (signal?.aborted) return null;
    if (direto) {
      achados.push({
        ...v, terra, saida: direto.saida,
        fare: { price: direto.price, ida: direto.ida, volta: direto.volta },
        total: direto.price + terra.preco,
      });
    }
    if (achados.length >= 2) break;          // dois candidatos já bastam
  }

  if (!achados.length) return null;
  achados.sort((a, b) => a.total - b.total);
  return achados[0];
}

/* ------------------------------------------- trajeto com escala --------- */
let conexaoAbort;

/**
 * Quando não há voo direto, procura um caminho pela própria malha da Ryanair
 * (Olbia → Bergamo → Madri) e mostra o trajeto. Cada trecho é comprado
 * separadamente: não é um bilhete só, e a tela diz isso.
 */
async function buscarConexao(r) {
  conexaoAbort?.abort();
  conexaoAbort = new AbortController();
  const signal = conexaoAbort.signal;
  const alvo = r.dest.id;

  const saidas = state.originAirports;
  if (!saidas.length || !state.airports.length) return;

  const destApt = RYA.nearestAirport(state.airports, r.dest, 130);
  if (!destApt) return;

  // se a rede já disse por onde dá para chegar, começa por essa saída
  const sugerida = r.viaEscala?.saida;
  const ordem = sugerida
    ? [sugerida, ...saidas.filter(s => s.iata !== sugerida.iata)]
    : saidas;
  const apt = ordem.find(s => s.iata !== destApt.iata);
  if (!apt) return;

  const caixa = $('#conexaoBox');
  if (caixa) {
    caixa.hidden = false;
    caixa.classList.remove('conexao-direta');
    caixa.innerHTML = '<span class="conexao-load">procurando o melhor caminho…</span>';
  }

  // Primeiro: existe voo DIRETO saindo de um aeroporto um pouco mais longe?
  // Um voo só de Cagliari costuma valer mais que duas escalas saindo de Olbia.
  const direto = await RYA.directFromNearbyAirport(
    state.origin, destApt, state.airports, state.month, state.days, signal,
    saidas.map(x => x.iata),
  );
  if (signal.aborted || state.selected !== alvo) return;
  if (direto) {
    mostrarDiretoDeLonge(direto, destApt, r);
    return;
  }

  // Segundo: voar até uma cidade vizinha e fazer o resto por terra.
  const comTerra = await vooMaisTerra(r, signal);
  if (signal.aborted || state.selected !== alvo) return;
  if (comTerra) {
    mostrarVooMaisTerra(comTerra, r);
    return;
  }

  // Compara as duas saídas mais próximas em vez de ficar com a primeira que
  // funcionar: parar na primeira levava a trajetos de € 179 saindo de um
  // aeroporto a 195 km, quando o aeroporto local resolvia por menos.
  const achadas = [];
  for (const partida of ordem.slice(0, 2)) {
    if (partida.iata === destApt.iata) continue;
    const achada = await RYA.findConnection(
      partida, destApt, state.airports, state.month, state.days, signal,
    );
    if (signal.aborted) return;
    if (achada) { achada.partida = partida; achadas.push(achada); }
  }

  // entre trajetos parecidos, o que sai de perto de casa leva vantagem
  const custo = t => t.total + (t.partida?.km || 0) * 0.05;
  const c = achadas.sort((a, b) => custo(a) - custo(b))[0] || null;
  if (signal.aborted || state.selected !== alvo) return;

  if (!c) { if (caixa) caixa.hidden = true; return; }

  state.conexao = { ...c, destId: alvo, origem: apt, destino: destApt };
  realcarBusca(false);          // há preços reais nas pernas: busca sai do destaque

  /* Um único critério para a espera, usado tanto na seta entre os voos quanto
     na explicação — antes a seta dizia "2 dias" e o texto "uma noite". */
  const faixa = min => !Number.isFinite(min) ? 'desconhecida'
    : min <= 720  ? 'curta'      // até 12 h: troca de avião no mesmo dia
    : 'noite';                   // o motor não devolve escala acima de 28 h

  const emTexto = min => {
    switch (faixa(min)) {
      case 'desconhecida': return 'troca de voo';
      case 'curta':  return min < 60 ? `${min} min de espera` : `${fmtDuracao(min)} de espera`;
      default:       return 'uma noite na cidade';
    }
  };

  const longa = min => faixa(min) !== 'curta' && Number.isFinite(min);

  /* Diz o que a espera significa na prática, e onde a pessoa passaria o tempo. */
  const explicar = min => {
    const onde = esc(c.hub.city);
    switch (faixa(min)) {
      case 'desconhecida': return '';
      case 'curta':  return `troca de avião em ${onde}, no mesmo dia`;
      default:       return `uma noite em ${onde} entre os voos`;
    }
  };

  // Cada perna é um link: são bilhetes separados, então a pessoa precisa
  // abrir e comprar um de cada vez.
  const perna = p => `
    <a class="perna is-link" href="${RYA.legBookingUrl(p, r.people)}"
       target="_blank" rel="noopener nofollow">
      <span class="perna-rota">
        <b>${esc(p.from)}</b> → <b>${esc(p.to)}</b>
        <i class="perna-voo">${esc(p.flight || '')}</i>
      </span>
      <span class="perna-data">${fmtDataHora(p.depart)} → ${fmtHora(p.arrive)}
        ${p.minutos > 0 ? `· ${fmtDuracao(p.minutos)}` : '<i class="fuso">· horários locais</i>'}</span>
      <span class="perna-preco">${fmt(p.price)}<small>reservar →</small></span>
    </a>`;

  const bloco = (pernas, esperaMin, rotulo, tipo) => !pernas ? '' : `
    <div class="conexao-bloco">
      <div class="conexao-rot">${rotulo}</div>
      ${perna(pernas[0])}
      <span class="perna-seta${longa(esperaMin) ? ' is-longa' : ''}">
        ↓ <i>escala em ${esc(c.hub.iata)} · ${emTexto(esperaMin)}</i>
      </span>
      ${perna(pernas[1])}
    </div>`;

  const dias = diasDoTrajeto(c);
  const avisos = [];
  const naIda = explicar(c.esperaMin);
  const naVolta = c.pernasVolta ? explicar(c.esperaVoltaMin) : '';
  if (naIda)   avisos.push(`Na ida, ${naIda}.`);
  if (naVolta) avisos.push(`Na volta, ${naVolta}.`);
  if ([c.esperaMin, c.esperaVoltaMin].filter(m => faixa(m) === 'noite').length) {
    avisos.push('A espera passa de 12 h: conte com uma noite de hospedagem na cidade da escala.');
  }
  if (c.voltaAmpliada && dias) {
    avisos.push(`Não há volta por esta rota nos ${r.days} dias pedidos: a opção encontrada
      deixa <b>${dias} dias fora</b>.`);
  }
  const avisoEspera = avisos.join(' ');

  caixa.innerHTML = `
    <div class="conexao-head">
      <span class="conexao-tag">trajeto com escala</span>
      <b>${fmt(c.total)}</b>
      <small>${c.completa
        ? `ida e volta, 4 trechos${dias ? ` · ${dias} dias fora` : ''}`
        : 'só ida — sem volta disponível nesta janela'}</small>
    </div>

    ${bloco(c.pernas, c.esperaMin, `ida · ${fmt(c.idaTotal)}`, c.tipoIda)}
    ${c.pernasVolta ? bloco(c.pernasVolta, c.esperaVoltaMin, `volta · ${fmt(c.voltaTotal)}`, c.tipoVolta) : ''}

    <p class="conexao-nota">
      Sem voo direto de ${esc(c.partida?.iata || apt.iata)} para ${esc(destApt.iata)}.
      Pela malha da Ryanair dá para chegar parando em
      <b>${esc(c.hub.city)} (${esc(c.hub.iata)})</b>${
        c.partida && c.partida.km > 40 ? `, saindo de ${esc(c.partida.iata)} (a ${c.partida.km} km de você)` : ''}.
      São <b>bilhetes separados</b>, um por trecho: clique em cada voo para reservar.
      A conexão não é garantida pela companhia — se um voo atrasar, o seguinte se perde.
      ${avisoEspera}
    </p>`;

  desenharConexao(state.conexao);
}

/**
 * Mostra o voo direto encontrado num aeroporto vizinho da origem — a opção
 * preferida quando o aeroporto local só oferece escalas.
 */
function mostrarDiretoDeLonge(d, destApt, r) {
  const caixa = $('#conexaoBox');
  if (!caixa) return;

  const linha = (p, rotulo) => `
    <a class="perna is-link" href="${RYA.legBookingUrl(p, r.people)}"
       target="_blank" rel="noopener nofollow">
      <span class="perna-rota"><b>${esc(p.from)}</b> → <b>${esc(p.to)}</b>
        <i class="perna-voo">${esc(p.flight || '')}</i></span>
      <span class="perna-data">${rotulo} · ${fmtDataHora(p.depart)} → ${fmtHora(p.arrive)}
        ${p.minutos > 0 ? `· ${fmtDuracao(p.minutos)}` : ''}</span>
      <span class="perna-preco">${fmt(p.price)}<small>reservar →</small></span>
    </a>`;

  caixa.classList.add('conexao-direta');
  caixa.innerHTML = `
    <div class="conexao-head">
      <span class="conexao-tag tag-direto">★ voo direto de um aeroporto vizinho</span>
      <b>${fmt(d.price)}</b><small>ida e volta, sem escala</small>
    </div>
    <div class="conexao-bloco">
      ${linha(d.ida, 'ida')}
      ${linha(d.volta, 'volta')}
    </div>
    <p class="conexao-nota">
      Não há voo direto daqui para ${esc(destApt.iata)}, mas
      <b>${esc(d.saida.city)} (${esc(d.saida.iata)})</b> tem — está a
      <b>${d.saida.km} km de você</b>, por terra. Um voo só, em vez de escalas.
      ${d.ampliada ? 'A volta disponível não bate com os dias pedidos: confira as datas.' : ''}
      São bilhetes da própria companhia: clique em cada trecho para reservar.
    </p>`;

  state.conexao = null;
  realcarBusca(false);
  desenharRotaDireta(d, r.dest);
}

/** Mostra o caminho "voe até X, siga por terra até Y". */
function mostrarVooMaisTerra(c, r) {
  const caixa = $('#conexaoBox');
  if (!caixa) return;

  const linha = (p, rotulo) => p ? `
    <a class="perna is-link" href="${RYA.legBookingUrl(p, r.people)}"
       target="_blank" rel="noopener nofollow">
      <span class="perna-rota"><b>${esc(p.from)}</b> → <b>${esc(p.to)}</b>
        <i class="perna-voo">${esc(p.flight || '')}</i></span>
      <span class="perna-data">${rotulo} · ${fmtDataHora(p.depart)} → ${fmtHora(p.arrive)}
        ${p.minutos > 0 ? `· ${fmtDuracao(p.minutos)}` : ''}</span>
      <span class="perna-preco">${fmt(p.price)}</span>
    </a>` : '';

  const buscaTerra = 'https://www.google.com/search?' + new URLSearchParams({
    q: `ônibus ou trem de ${c.d.city} para ${r.dest.city}`, hl:'pt-BR',
  });

  caixa.classList.add('conexao-direta');
  caixa.innerHTML = `
    <div class="conexao-head">
      <span class="conexao-tag tag-direto">★ voo até perto + ${esc(c.terra.modo)}</span>
      <b>${fmt(c.total)}</b><small>voo ida e volta + ${esc(c.terra.modo)}</small>
    </div>
    <div class="conexao-bloco">
      ${linha(c.fare.ida, 'ida')}
      ${linha(c.fare.volta, 'volta')}
      <a class="perna is-link perna-terra" href="${buscaTerra}" target="_blank" rel="noopener nofollow">
        <span class="perna-rota"><b>${esc(c.d.city)}</b> → <b>${esc(r.dest.city)}</b>
          <i class="perna-voo">${esc(c.terra.modo)}</i></span>
        <span class="perna-data">${c.km} km · cerca de ${esc(c.terra.tempo)} por trecho</span>
        <span class="perna-preco">${fmt(c.terra.preco)}<small>buscar →</small></span>
      </a>
    </div>
    <p class="conexao-nota">
      Não há voo até ${esc(r.dest.city)}, mas <b>${esc(c.d.city)}</b> fica a
      ${c.km} km — cerca de ${esc(c.terra.tempo)} de ${esc(c.terra.modo)}. Costuma
      sair melhor que uma escala de avião: um voo só e o resto por terra.
      O valor do ${esc(c.terra.modo)} é estimativa; confira no buscador.
    </p>`;

  state.conexao = null;
  realcarBusca(false);
  desenharRotaDireta({ saida:c.saida, ...c }, c.d);
}

/** Arco da origem até o aeroporto vizinho e daí ao destino. */
function desenharRotaDireta(d, dest) {
  if (!svgRota || !state.origin) return;
  const pts = [
    map.latLngToContainerPoint([state.origin.lat, state.origin.lon]),
    map.latLngToContainerPoint([d.saida.lat, d.saida.lon]),
    map.latLngToContainerPoint([dest.lat, dest.lon]),
  ];
  const curva = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
    const alt = Math.min(90, 14 + dist * 0.16);
    return `Q ${(a.x + b.x) / 2 - (dy / dist) * alt} ${(a.y + b.y) / 2 + (dx / dist) * alt} ${b.x} ${b.y}`;
  };
  const caminho = `M ${pts[0].x} ${pts[0].y} ${curva(pts[0], pts[1])} ${curva(pts[1], pts[2])}`;
  pathRota.setAttribute('d', caminho);
  pathSombra.setAttribute('d', caminho);
  const comp = pathRota.getTotalLength();
  for (const el of [pathRota, pathSombra]) {
    el.style.transition = 'none';
    el.style.strokeDasharray = comp;
    el.style.strokeDashoffset = comp;
  }
  svgRota.classList.add('is-on', 'is-conexao');
  void pathRota.getBoundingClientRect();
  for (const el of [pathRota, pathSombra]) {
    el.style.transition = 'stroke-dashoffset .8s cubic-bezier(.32,.72,.3,1)';
    el.style.strokeDashoffset = '0';
  }
}

/** Desenha no mapa o caminho origem → escala → destino. */
function desenharConexao(c) {
  if (!svgRota || !c) return;
  const pts = [
    map.latLngToContainerPoint([c.origem.lat, c.origem.lon]),
    map.latLngToContainerPoint([c.hub.lat, c.hub.lon]),
    map.latLngToContainerPoint([c.destino.lat, c.destino.lon]),
  ];
  const curva = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
    const alt = Math.min(90, 14 + dist * 0.16);
    return `Q ${(a.x + b.x) / 2 - (dy / dist) * alt} ${(a.y + b.y) / 2 + (dx / dist) * alt} ${b.x} ${b.y}`;
  };
  const d = `M ${pts[0].x} ${pts[0].y} ${curva(pts[0], pts[1])} ${curva(pts[1], pts[2])}`;
  pathRota.setAttribute('d', d);
  pathSombra.setAttribute('d', d);
  const comp = pathRota.getTotalLength();
  for (const el of [pathRota, pathSombra]) {
    el.style.transition = 'none';
    el.style.strokeDasharray = comp;
    el.style.strokeDashoffset = comp;
  }
  svgRota.classList.add('is-on', 'is-conexao');
  void pathRota.getBoundingClientRect();
  for (const el of [pathRota, pathSombra]) {
    el.style.transition = 'stroke-dashoffset .8s cubic-bezier(.32,.72,.3,1)';
    el.style.strokeDashoffset = '0';
  }
}

/* ------------------------------- inventário real de hospedagens (OSM) --- */
let osmAbort;

/**
 * Preenche, se conseguir, a linha "o que existe na cidade" com dados reais do
 * OpenStreetMap. É informativo: se falhar, a linha simplesmente não aparece.
 */
async function showOsmStays(dest) {
  osmAbort?.abort();
  osmAbort = new AbortController();
  const alvo = dest.id;

  const data = await OSM.countStays(dest, osmAbort.signal);
  if (state.selected !== alvo) return;          // usuário já trocou de destino

  const box = $('#osmStays');
  const txt = OSM.describe(data);
  if (!box || !txt) return;
  box.innerHTML = `Cadastrados no centro de ${esc(dest.city)}: <b>${txt}</b>
    <span>fonte: OpenStreetMap</span>`;
  box.hidden = false;
}

/* ------------------------------------------------------ autocomplete --- */
let comboItems = [], comboIdx = -1, comboAbort;

function renderCombo(items) {
  comboItems = items; comboIdx = -1;
  const box = $('#originList');
  box.innerHTML = '';
  if (!items.length) { box.hidden = true; return; }
  items.forEach((o, i) => {
    const n = el('div', 'combo-item', `<span>${esc(o.city)}</span><small>${esc(o.country)}</small>`);
    n.setAttribute('role', 'option');
    n.addEventListener('mousedown', e => {
      e.preventDefault();
      state.escolhaManual = true;
      pickOrigin(o);
    });
    n.addEventListener('mouseenter', () => { comboIdx = i; highlight(); });
    box.appendChild(n);
  });
  box.hidden = false;
}
const highlight = () => $$('#originList .combo-item')
  .forEach((n, i) => n.classList.toggle('is-active', i === comboIdx));

/**
 * Define a origem da viagem.
 * @param {object} o    { city, country, lat, lon }
 * @param {object} opts salvar: grava a escolha (só para escolha manual)
 */
function pickOrigin(o, { salvar = true } = {}) {
  state.origin = o;
  $('#origin').value = o.city;

  const coords = `${o.lat.toFixed(2)}, ${o.lon.toFixed(2)}`;
  $('#originHint').innerHTML = o.precisao
    ? `${esc(o.country)} · <b class="auto-tag">${o.precisao === 'gps' ? 'sua localização' : 'detectado pelo IP'}</b>`
    : `${esc(o.country)} · ${coords}`;

  $('#originList').hidden = true;
  if (salvar) { try { localStorage.setItem('ppi.origin', JSON.stringify(o)); } catch {} }

  drawOrigin();
  search();
  loadRealFares();
}

/* -------------------------------------------------- detectar a origem --- */
/**
 * Descobre de onde a pessoa está acessando, em duas camadas: o IP responde na
 * hora e já preenche a tela; o GPS chega depois e corrige, se for autorizado.
 * Nenhuma das duas é gravada — só a escolha manual é.
 */
async function detectarOrigem({ pedirGPS = true } = {}) {
  const hint = $('#originHint');
  hint.textContent = 'Descobrindo de onde você está…';
  $('#btnLocate')?.classList.add('is-busy');

  const porIP = await GEO.locateByIP();
  if (porIP && !state.escolhaManual) pickOrigin(porIP, { salvar:false });

  if (pedirGPS) {
    const porGPS = await GEO.locateByGPS();
    if (porGPS && !state.escolhaManual) pickOrigin(porGPS, { salvar:false });
    else if (!porIP && !state.escolhaManual) {
      const padrao = searchLocal('Lisboa')[0];
      if (padrao) pickOrigin(padrao, { salvar:false });
    }
  }

  $('#btnLocate')?.classList.remove('is-busy');
  if (!state.origin) {
    const padrao = searchLocal('Lisboa')[0];
    if (padrao) pickOrigin(padrao, { salvar:false });
  }
}

function setupCombo() {
  const input = $('#origin');
  let timer;

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    renderCombo(searchLocal(q));
    if (q.length < 3) return;
    timer = setTimeout(async () => {
      comboAbort?.abort();
      comboAbort = new AbortController();
      try {
        const remote = await searchRemote(q, comboAbort.signal);
        const local = searchLocal(q, 4);
        const seen = new Set(local.map(o => o.city.toLowerCase()));
        renderCombo([...local, ...remote.filter(o => !seen.has(o.city.toLowerCase()))].slice(0, 8));
      } catch {/* rede fora: a lista local basta */}
    }, 280);
  });

  input.addEventListener('keydown', e => {
    if ($('#originList').hidden || !comboItems.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); comboIdx = (comboIdx + 1) % comboItems.length; highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); comboIdx = (comboIdx - 1 + comboItems.length) % comboItems.length; highlight(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      state.escolhaManual = true;
      pickOrigin(comboItems[Math.max(0, comboIdx)]);
    }
    else if (e.key === 'Escape') { $('#originList').hidden = true; }
  });

  input.addEventListener('blur', () => setTimeout(() => { $('#originList').hidden = true; }, 120));
  input.addEventListener('focus', () => { if (input.value.trim()) renderCombo(searchLocal(input.value)); });
}

/* ------------------------------------------- para onde a pessoa quer ir -- */

/** Procura entre os nossos destinos e, se precisar, no mapa do mundo. */
function buscarDestinos(texto, limite = 6) {
  const q = norm(texto);
  if (q.length < 2) return [];
  const comeca = [], contem = [];
  for (const d of DESTINATIONS) {
    const c = norm(d.city);
    if (c.startsWith(q)) comeca.push(d);
    else if (c.includes(q) || norm(d.country).startsWith(q)) contem.push(d);
  }
  return [...comeca, ...contem].slice(0, limite);
}

/**
 * Define o alvo da viagem. Se o lugar pedido não está na nossa lista, ficamos
 * com o destino conhecido mais próximo — é o "chegar o mais perto possível".
 */
function definirDestino(lugar) {
  let alvo = lugar.id ? lugar : null;
  let distancia = 0;

  if (!alvo) {                       // veio do mapa do mundo, não da nossa lista
    let menor = Infinity;
    for (const d of DESTINATIONS) {
      const km = distanciaSimples(lugar, d);
      if (km < menor) { menor = km; alvo = d; }
    }
    distancia = Math.round(menor);
  }
  if (!alvo) return;

  state.destinoAlvo = { ...alvo, pedido: lugar.city, kmDoPedido: distancia };
  $('#destino').value = lugar.city;
  $('#destinoList').hidden = true;
  $('#btnLimparDestino').hidden = false;
  $('#destinoHint').innerHTML = distancia > 25
    ? `Não temos voos para ${esc(lugar.city)}. O ponto mais próximo é
       <b>${esc(alvo.city)}</b>, a ${distancia} km.`
    : `Procurando o melhor caminho até <b>${esc(alvo.city)}</b>.`;

  // leva o mapa até lá e abre o destino
  state.ignorarMove = true;
  map.setView([alvo.lat, alvo.lon], 6, { animate:false });
  setTimeout(() => { search({ refit:false }); select(alvo.id, { fly:false }); }, 120);
}

function limparDestino() {
  state.destinoAlvo = null;
  $('#destino').value = '';
  $('#btnLimparDestino').hidden = true;
  $('#destinoHint').textContent =
    'Se não houver voo até lá, buscamos o ponto mais próximo que dá para alcançar.';
}

function setupDestino() {
  const input = $('#destino');
  const lista = $('#destinoList');
  let itens = [], idx = -1, timer, abort;

  const pintar = () => [...lista.children]
    .forEach((n, i) => n.classList.toggle('is-active', i === idx));

  const mostrar = achados => {
    itens = achados; idx = -1;
    lista.innerHTML = '';
    if (!achados.length) { lista.hidden = true; return; }
    achados.forEach((o, i) => {
      const n = el('div', 'combo-item',
        `<span>${esc(o.city)}</span><small>${esc(o.country)}${o.remote ? '' : ' ·<b> temos voos</b>'}</small>`);
      n.addEventListener('mousedown', e => { e.preventDefault(); definirDestino(o); });
      n.addEventListener('mouseenter', () => { idx = i; pintar(); });
      lista.appendChild(n);
    });
    lista.hidden = false;
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { limparDestino(); lista.hidden = true; return; }
    mostrar(buscarDestinos(q));
    if (q.length < 3) return;
    timer = setTimeout(async () => {
      abort?.abort(); abort = new AbortController();
      try {
        const remotos = await searchRemote(q, abort.signal);
        const nossos = buscarDestinos(q, 4);
        const vistos = new Set(nossos.map(o => norm(o.city)));
        mostrar([...nossos, ...remotos.filter(o => !vistos.has(norm(o.city)))].slice(0, 8));
      } catch {/* sem rede: a lista local basta */}
    }, 280);
  });

  input.addEventListener('keydown', e => {
    if (lista.hidden || !itens.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % itens.length; pintar(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + itens.length) % itens.length; pintar(); }
    else if (e.key === 'Enter') { e.preventDefault(); definirDestino(itens[Math.max(0, idx)]); }
    else if (e.key === 'Escape') { lista.hidden = true; }
  });

  input.addEventListener('blur', () => setTimeout(() => { lista.hidden = true; }, 120));
  $('#btnLimparDestino').addEventListener('click', limparDestino);
}

/* --------------------------------------------------------- formulário -- */
function setupForm() {
  // mês
  const sel = $('#month');
  MONTHS.forEach((m, i) => sel.appendChild(new Option(m, i, false, i === state.month)));
  sel.addEventListener('change', () => {
    state.month = +sel.value;
    state.realFares = new Map();      // outro mês, outras tarifas
    search({ refit:false });
    loadRealFares();
  });

  // orçamento (campo + slider sincronizados)
  const budget = $('#budget'), range = $('#budgetRange');
  const syncBudget = (v, from) => {
    // o campo aceita qualquer valor; a barra só representa até o seu máximo
    state.budget = Math.max(1, Math.round(v));
    if (from !== 'input') budget.value = state.budget;
    if (from !== 'range') range.value = Math.min(+range.max, Math.max(+range.min, state.budget));
    range.classList.toggle('is-beyond', state.budget > +range.max);
  };
  budget.addEventListener('input', () => { syncBudget(+budget.value || 0, 'input'); debouncedSearch(); });
  range.addEventListener('input', () => { syncBudget(+range.value, 'range'); debouncedSearch(); });

  // números
  $('#days').addEventListener('input', e => {
    state.days = clamp(+e.target.value, 1, 90);
    state.realFares = new Map();      // a duração muda a tarifa
    debouncedSearch();
    clearTimeout(faresTimer);
    faresTimer = setTimeout(loadRealFares, 700);
  });
  $('#people').addEventListener('input', e => { state.people = clamp(+e.target.value, 1, 8); debouncedSearch(); });

  // estilo
  $$('[data-style]').forEach(b => b.addEventListener('click', () => {
    $$('[data-style]').forEach(x => x.classList.toggle('is-active', x === b));
    state.style = +b.dataset.style;
    $('#styleHint').textContent = STYLES[state.style].hint;
    search({ refit:false });
  }));

  // moeda
  $$('[data-currency]').forEach(b => b.addEventListener('click', () => {
    const next = b.dataset.currency;
    if (next === state.currency) return;
    const eur = budgetEUR();                       // preserva o valor real
    $$('[data-currency]').forEach(x => x.classList.toggle('is-active', x === b));
    state.currency = next;
    state.budget = Math.round(FX.fromEUR(eur, next) / 10) * 10;
    $('#curSymbol').textContent = FX.symbolOf(next);
    $('#budget').value = state.budget;
    // A barra cobre até o equivalente a € 1.000; valores maiores só digitando.
    const range = $('#budgetRange');
    range.max = Math.round(FX.fromEUR(1000, next) / 25) * 25;
    range.min = Math.round(FX.fromEUR(50, next) / 25) * 25;
    range.step = next === 'BRL' ? 50 : 25;
    range.value = Math.min(+range.max, state.budget);
    $('#rangeMaxLabel').textContent = FX.money(1000, next);
    search({ refit:false });
  }));

  // o que entra na conta: voo + hospedagem, só voo ou só hospedagem
  $$('[data-mode]').forEach(b => b.addEventListener('click', () => {
    $$('[data-mode]').forEach(x => x.classList.toggle('is-active', x === b));
    state.mode = b.dataset.mode;
    search({ refit:false });
  }));

  // tempo máximo de voo
  const mh = $('#maxFlight');
  mh.addEventListener('input', () => {
    const v = +mh.value;
    state.maxHours = v >= 25 ? null : v;
    $('#maxFlightLabel').textContent = state.maxHours ? `até ${v} h` : 'sem limite';
    debouncedSearch();
  });

  // tipo de destino
  const chips = $('#tagChips');
  Object.entries(TAG_LABELS).forEach(([tag, label]) => {
    const c = el('button', 'chip', label);
    c.type = 'button';
    c.addEventListener('click', () => {
      const i = state.tags.indexOf(tag);
      i < 0 ? state.tags.push(tag) : state.tags.splice(i, 1);
      c.classList.toggle('is-active', i < 0);
      search();
    });
    chips.appendChild(c);
  });

  // botões do mapa: clicar no que já está ligado volta a mostrar tudo
  const alterna = modo => () => {
    state.filtro = state.filtro === modo ? 'todos' : modo;
    pintarFiltros();
    search({ refit:false });
  };
  $('#btnConfirmado').addEventListener('click', alterna('confirmado'));
  $('#btnDireto').addEventListener('click', alterna('direto'));

  $('#tripForm').addEventListener('submit', e => { e.preventDefault(); search(); });

  setupDetailsResizer();

  // barra inferior
  $('#detailsHandle').addEventListener('click', () => {
    const d = $('#details');
    const open = d.dataset.state === 'open';
    d.dataset.state = open ? 'collapsed' : 'open';
    $('#detailsHandle').setAttribute('aria-expanded', String(!open));
    setTimeout(() => map.invalidateSize(), 260);
  });

  $('#btnHelp').addEventListener('click', () => $('#helpDialog').showModal());

  // "usar minha localização": esquece a escolha salva e detecta de novo
  $('#btnLocate').addEventListener('click', () => {
    state.escolhaManual = false;
    try { localStorage.removeItem('ppi.origin'); } catch {}
    detectarOrigem();
  });
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v || a));

/* ------------------------------- altura da barra inferior --------------- */

/**
 * Abre a barra o quanto for preciso para o conteúdo caber sem rolagem, até
 * metade da tela. Respeita a altura que a pessoa tenha fixado arrastando —
 * aí a escolha dela manda.
 */
function ajustarAlturaAoConteudo() {
  try { if (localStorage.getItem('ppi.detailsH')) return; } catch {}
  const corpo = $('#detailsBody');
  if (!corpo) return;
  // setTimeout e não requestAnimationFrame: rAF fica parado com a aba em
  // segundo plano e a barra nunca se ajustaria.
  setTimeout(() => {
    const precisa = corpo.scrollHeight;
    const atual = corpo.clientHeight;
    if (precisa <= atual + 4) return;
    const teto = Math.round(window.innerHeight * 0.5);
    aplicarAltura(Math.min(precisa + 8, teto));
    map.invalidateSize();
  }, 60);
}

const ALTURA_MIN = 150;
const alturaMax = () => Math.round(window.innerHeight * 0.8);

function aplicarAltura(px, { salvar = false } = {}) {
  const h = Math.round(Math.min(alturaMax(), Math.max(ALTURA_MIN, px)));
  document.documentElement.style.setProperty('--details-h', h + 'px');
  if (salvar) { try { localStorage.setItem('ppi.detailsH', h); } catch {} }
  return h;
}

/**
 * Deixa a pessoa arrastar a borda de cima da barra inferior para escolher
 * quanto espaço ela ocupa — antes só dava para abrir tudo ou fechar tudo.
 * A altura escolhida fica guardada para as próximas visitas.
 */
function setupDetailsResizer() {
  const alca = $('#detailsResizer');
  if (!alca) return;

  try {
    const salva = parseInt(localStorage.getItem('ppi.detailsH'), 10);
    if (Number.isFinite(salva)) aplicarAltura(salva);
  } catch {}

  let arrastando = false, yInicial = 0, hInicial = 0;

  alca.addEventListener('pointerdown', e => {
    // arrastar com a barra fechada abre primeiro
    if ($('#details').dataset.state !== 'open') {
      $('#details').dataset.state = 'open';
      $('#detailsHandle').setAttribute('aria-expanded', 'true');
    }
    arrastando = true;
    yInicial = e.clientY;
    hInicial = $('#detailsBody').offsetHeight;
    alca.setPointerCapture(e.pointerId);
    document.body.classList.add('is-resizing');
    e.preventDefault();
  });

  alca.addEventListener('pointermove', e => {
    if (!arrastando) return;
    aplicarAltura(hInicial - (e.clientY - yInicial));
  });

  const soltar = () => {
    if (!arrastando) return;
    arrastando = false;
    document.body.classList.remove('is-resizing');
    aplicarAltura($('#detailsBody').offsetHeight, { salvar:true });
    map.invalidateSize();
  };
  alca.addEventListener('pointerup', soltar);
  alca.addEventListener('pointercancel', soltar);

  // duplo clique na alça volta à altura padrão
  alca.addEventListener('dblclick', () => {
    document.documentElement.style.removeProperty('--details-h');
    try { localStorage.removeItem('ppi.detailsH'); } catch {}
    map.invalidateSize();
  });
}
const fmtDate = iso => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};
/** "22/09 06:20" a partir de uma data ISO com hora. */
const fmtDataHora = iso => {
  if (!iso) return '';
  const h = iso.slice(11, 16);
  return h ? `${fmtDate(iso)} ${h}` : fmtDate(iso);
};
const fmtHora = iso => (iso || '').slice(11, 16);

/** Dias entre a partida da ida e a chegada da volta. */
function diasDoTrajeto(c) {
  const ini = c.pernas?.[0]?.depart;
  const fim = c.pernasVolta?.[1]?.arrive;
  if (!ini || !fim) return null;
  return Math.round((new Date(fim) - new Date(ini)) / 864e5);
}

/** "parte de CAG, a 183 km de você" — a saída escolhida para esta tarifa. */
function saidaTexto(fare) {
  const s = fare?.saida;
  if (!s) return '';
  const perto = state.originAirports[0];
  const extra = (perto && s.iata !== perto.iata) || s.km > 40
    ? `, a ${s.km} km de você` : '';
  return `parte de <b>${esc(s.iata)}</b>${extra}`;
}
/** 125 -> "2h05" */
const fmtDuracao = min => {
  if (!Number.isFinite(min) || min <= 0) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
};
let searchTimer, faresTimer;
const debouncedSearch = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => search({ refit:false }), 320); };

/* ------------------------------------------------------------- boot ---- */
async function boot() {
  initMap();
  observarMapa();
  setupCombo();
  setupDestino();
  setupForm();
  $('#styleHint').textContent = STYLES[state.style].hint;
  mountAllAds();

  await FX.loadRates();

  // Quem já escolheu uma origem à mão tem a escolha respeitada e não recebe
  // pedido de localização; os demais entram na detecção automática.
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('ppi.origin') || 'null'); } catch {}

  if (saved && saved.city && Number.isFinite(saved.lat)) {
    state.escolhaManual = true;
    pickOrigin(saved, { salvar:false });
  } else {
    detectarOrigem();
  }
}

boot();

// Ponto de inspeção para depurar no console do navegador (window.PPI.map…)
window.PPI = { get map(){ return map; }, state, DESTINATIONS };
