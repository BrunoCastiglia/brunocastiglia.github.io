/* ==========================================================================
   Pra onde posso ir? — controlador da página
   ======================================================================== */

import { DESTINATIONS } from './data/destinations.js';
import { searchLocal, searchRemote, norm } from './data/origins.js';
import * as GEO from './data/geo.js';
import { ligadosPorTerra } from './data/landmass.js';
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
  style: 0,               // econômico: o site existe para achar viagem barata
  mode: 'flight',                    // flight | both | stay — começa só no voo
  sortBy: 'fit',
  results: [],
  selected: null,
  escolhaManual: false,   // true quando a pessoa digitou a origem
  airports: [],           // malha de aeroportos da Ryanair
  conexao: null,          // trajeto com escala do destino aberto
  filtro: 'todos',        // todos | confirmado (direto+escala) | direto
  viaEscala: new Map(),   // destino -> escala, pela malha da Ryanair
  temVooDireto: new Set(), // destinos com rota direta de alguma saída
  ignorarMove: false,     // true durante movimentos feitos pelo próprio código
  ignorarMoveAte: 0,      // até quando ignorar eventos de mapa (ms)
  enquadrado: null,       // destino cujo trajeto já foi enquadrado
  destinoAlvo: null,      // para onde a pessoa quer ir, quando ela diz
  caminho: null,          // trajeto desenhado no mapa: { destId, pontos }
  caminhosPorDestino: new Map(),   // resultado da busca de caminhos, por destino
  intro: true,            // primeira abertura: anima do mundo até a origem
  realFares: new Map(),   // id do destino -> tarifa real da Ryanair
  originAirport: null,    // aeroporto Ryanair mais próximo da origem
  originAirports: [],     // até 3 aeroportos de partida, por distância
  enquadrePontos: null,   // trajeto do último enquadramento, para repeti-lo
  quando: 'duracao',      // como as datas são informadas: duracao | datas
  dataIda: '',            // modo datas: dia da ida (AAAA-MM-DD)
  dataVolta: '',          // modo datas: dia da volta, vazio = em aberto
};

const budgetEUR = () => state.budget / FX.fromEUR(1, state.currency);
const fmt = (eur, o) => FX.money(eur, state.currency, o);

/* ------------------------------------------------------------- mapa ----- */
let map, layerDest, originMarker, routeLine;
let radarMarker;                     // anéis de varredura sobre a origem
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

  // Clicar em qualquer lugar vazio do mapa desfaz a seleção. O Leaflet só
  // dispara 'click' no mapa quando o clique NÃO foi num marcador, então clicar
  // noutro destino continua trocando de destino em vez de limpar.
  map.on('click', () => { if (state.selected || state.destinoAlvo) limparSelecao(); });
}

/**
 * Some com o arco do hover — mas se há um destino selecionado, o arco dele
 * volta: enquanto a pessoa não trocar de destino, o trajeto fica na tela.
 */
function esconderRota() {
  if (state.selected) return desenharRotaFixa();
  svgRota?.classList.remove('is-on', 'is-conexao');
}

/**
 * Redesenha o trajeto do destino selecionado, com todas as suas paradas.
 *
 * O caminho fica guardado em state.caminho porque os trajetos com escala e os
 * "voo + terra" precisam sobreviver a tirar o mouse do pino e a mover o mapa.
 * Antes isso caía no arco simples origem–destino e as paradas sumiam.
 */
function desenharRotaFixa({ animar = false } = {}) {
  const r = state.results.find(x => x.dest.id === state.selected);
  if (!r) { svgRota?.classList.remove('is-on', 'is-conexao'); return; }

  if (state.caminho?.destId === state.selected) {
    desenharCaminho(state.caminho.pontos, { animar });
  } else if (state.origin) {
    desenharCaminho(pontosDoVoo(r), { animar });
  }
}

/** Guarda o trajeto do destino aberto para poder redesenhá-lo depois. */
function fixarCaminho(destId, pontos) {
  state.caminho = { destId, pontos };
  desenharCaminho(pontos);
  paintSelection();      // agora que há trajeto, a reta tracejada sai de cena

  // Enquadrar aqui fechava um ciclo: mover o mapa disparava 'moveend', que
  // refazia a busca, que redesenhava o painel, que chamava esta função de
  // novo — a tela piscava a cada segundo e a companhia recebia consultas em
  // rajada. O enquadramento acontece uma vez por destino, e só.
  if (state.enquadrado !== destId) {
    state.enquadrado = destId;
    enquadrarTrajeto(pontos);
  }
}

/**
 * Ajusta o mapa para o trajeto inteiro caber na tela.
 *
 * Sem isso, clicar num destino distante deixava metade do caminho fora do
 * enquadramento — e como a barra inferior se abre ao mesmo tempo, o destino
 * ainda podia ficar escondido atrás dela.
 */
function enquadrarTrajeto(pontos, { animar = true } = {}) {
  if (!map || !pontos || pontos.length < 2) return;
  const validos = pontos.filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (validos.length < 2) return;

  // Guardado para poder repetir o enquadramento quando a barra inferior mudar
  // de altura: o mapa encolhe e o trajeto que estava enquadrado sai da vista.
  state.enquadrePontos = validos;

  clearTimeout(enquadreTimer);
  enquadreTimer = setTimeout(() => {
    // Sem isto o Leaflet ainda acha que o mapa tem a altura de antes da barra
    // abrir, e enquadra para um retângulo que não existe mais — era por isso
    // que a ponta do arco ficava escondida atrás dos cards.
    map.invalidateSize({ animate:false });

    const limites = L.latLngBounds(validos.map(p => [p.lat, p.lon]));
    // o mapa vai se mexer por nossa conta: os eventos que isso gera não devem
    // ser lidos como "a pessoa navegou"
    state.ignorarMoveAte = Date.now() + 1500;
    const folga = folgaDosAvisos();
    map.fitBounds(limites, {
      paddingTopLeft: folga.topLeft,
      paddingBottomRight: folga.bottomRight,
      maxZoom: 7,
      animate: animar,
      duration: 0.6,
    });
  }, 140);
}
let enquadreTimer;

/**
 * Quanto o enquadramento precisa recuar de cada canto.
 *
 * As caixas de aviso, os filtros e a legenda ficam POR CIMA do mapa: uma folga
 * fixa de 70 px não dava conta e o arco terminava atrás delas — o destino
 * escolhido aparecia escondido debaixo do "Só preço confirmado" ou da legenda.
 * Aqui a folga sai do tamanho real que essas caixas ocupam hoje na tela, então
 * acompanha sozinha quando uma delas some (a legenda no modo foco) ou cresce
 * (o contador de lotes durante a varredura).
 */
function folgaDosAvisos() {
  const mapa = $('.map-wrap')?.getBoundingClientRect();
  const MARGEM = 16, MIN = 40;
  if (!mapa) return { topLeft:[70, 70], bottomRight:[70, 70] };

  let esq = MIN, topo = MIN, dir = MIN, baixo = MIN;
  for (const el of document.querySelectorAll('.map-overlay, .map-filtros, .leaflet-control-zoom')) {
    if (el.hidden || getComputedStyle(el).opacity === '0') continue;
    const c = el.getBoundingClientRect();
    if (!c.width || !c.height) continue;

    // De que lado do mapa a caixa está? A resposta diz qual folga ela come.
    const coladaEsquerda = c.left - mapa.left < mapa.width / 2;
    const coladaTopo     = c.top  - mapa.top  < mapa.height / 2;
    if (coladaEsquerda) esq  = Math.max(esq,  c.right - mapa.left + MARGEM);
    else                dir  = Math.max(dir,  mapa.right - c.left + MARGEM);
    if (coladaTopo)     topo = Math.max(topo, c.bottom - mapa.top + MARGEM);
    else                baixo = Math.max(baixo, mapa.bottom - c.top + MARGEM);
  }

  // Nenhum canto pode comer mais de 40% do mapa, senão não sobra onde desenhar
  // e o Leaflet joga o zoom para o mínimo.
  const tetoX = mapa.width * 0.4, tetoY = mapa.height * 0.4;
  return {
    topLeft:     [Math.min(esq, tetoX), Math.min(topo, tetoY)],
    bottomRight: [Math.min(dir, tetoX), Math.min(baixo, tetoY)],
  };
}

/** Reenquadra o trajeto aberto, se houver, depois de o mapa mudar de tamanho. */
function reenquadrarSeNecessario() {
  if (state.selected && state.enquadrePontos) {
    enquadrarTrajeto(state.enquadrePontos, { animar:false });
  } else if (map) {
    map.invalidateSize({ animate:false });
  }
}

/**
 * Desenha um trajeto passando por todas as paradas informadas.
 * Dois pontos: arco simples. Mais que isso: curvas menores, encadeadas.
 */
function desenharCaminho(pontos, { animar = true } = {}) {
  if (!svgRota || !pontos || pontos.length < 2) return;

  const p = pontos.map(x => map.latLngToContainerPoint([x.lat, x.lon]));
  if (Math.hypot(p[0].x - p.at(-1).x, p[0].y - p.at(-1).y) < 12) return;

  const escala = pontos.length > 2;
  const curva = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
    const alt = Math.min(escala ? 90 : 160, (escala ? 14 : 24) + dist * (escala ? 0.16 : 0.22));
    return `Q ${(a.x + b.x) / 2 - (dy / dist) * alt} ${(a.y + b.y) / 2 + (dx / dist) * alt} ${b.x} ${b.y}`;
  };

  const d = p.slice(1).reduce((acc, ponto, i) => `${acc} ${curva(p[i], ponto)}`,
    `M ${p[0].x} ${p[0].y}`);
  pathRota.setAttribute('d', d);
  pathSombra.setAttribute('d', d);

  const comp = pathRota.getTotalLength();
  for (const el of [pathRota, pathSombra]) {
    el.style.transition = 'none';
    el.style.strokeDasharray = comp;
    el.style.strokeDashoffset = animar ? comp : 0;
  }
  svgRota.classList.add('is-on');
  svgRota.classList.toggle('is-conexao', escala);
  if (!animar) return;

  void pathRota.getBoundingClientRect();
  for (const el of [pathRota, pathSombra]) {
    el.style.transition = 'stroke-dashoffset .7s cubic-bezier(.32,.72,.3,1)';
    el.style.strokeDashoffset = '0';
  }
}

/**
 * Pontos do trajeto de um destino: onde a pessoa está, o aeroporto de onde o
 * voo realmente parte, o aeroporto onde ele pousa e a cidade de destino.
 *
 * Um voo que sai de Cagliari não pode ser desenhado saindo de Olbia, e um que
 * pousa em Génova não termina em Turim — os trechos por terra fazem parte do
 * caminho e precisam aparecer no mapa.
 */
function pontosDoVoo(r) {
  const pontos = [state.origin];
  const saida = r?.real?.saida;
  const chegada = r?.real?.airport;

  if (saida && distanciaSimples(state.origin, saida) > 25) pontos.push(saida);
  if (chegada && r.dest && distanciaSimples(chegada, r.dest) > 25) pontos.push(chegada);
  pontos.push(r.dest || r);
  return pontos;
}

/** Arco do trajeto ao passar o mouse, já com os trechos por terra. */
function mostrarRota(r) {
  if (!state.origin) return;
  desenharCaminho(pontosDoVoo(r));
}

function pinIcon(html, cls) {
  return L.divIcon({ className:'pin-wrap', html:`<div class="${cls}">${html}</div>`, iconSize:[0,0] });
}

function drawOrigin() {
  if (originMarker) originMarker.remove();
  if (radarMarker) { radarMarker.remove(); radarMarker = null; }
  if (!state.origin) return;

  // Radar: anéis que se abrem a partir da origem enquanto os preços chegam.
  // Vai de marcador, e não de camada fixa, para acompanhar sozinho o arrasto e
  // o zoom do mapa. Fica invisível até a busca começar — quem acende é a classe
  // .buscando no .map-wrap, posta pelo setFareStatus.
  radarMarker = L.marker([state.origin.lat, state.origin.lon], {
    icon: L.divIcon({
      className: 'radar-icon',
      html: '<div class="radar"><i></i><i></i><i></i></div>',
      iconSize: [0, 0], iconAnchor: [0, 0],
    }),
    interactive: false, keyboard: false, zIndexOffset: -500,
  }).addTo(map);

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
    // estrela cheia: preço confirmado. contorno: tem voo direto, preço ainda
    // não consultado (abre o destino e ele é buscado)
    const estrela = r.real && !r.useGround ? '<i class="pin-star">★</i>'
      : (r.voaDireto && !r.useGround ? '<i class="pin-star pin-star-vazia">☆</i>' : '');
    const label = over ? '' : estrela + esc(fmt(r.total, { compact:true }));
    const cls = `pin pin-${r.verdict}`
      + (over ? ' pin-dot' : '')
      + (r.real && !over ? ' pin-real' : '')
      + (!r.real && r.voaDireto && !over ? ' pin-direto' : '');
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
         : r.voaDireto && !r.useGround
           ? '<br><span class="tip-direto">☆ tem voo direto — abra para ver o preço</span>'
           : '<br><span class="tip-est">valor estimado</span>'}`,
      { direction:'top', offset:[0,-14], className:'dest-tip' },
    );
    m.on('click', () => select(r.dest.id, { fly:false }));
    m.on('mouseover', () => mostrarRota(r));
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
  // Com um trajeto escolhido, o resto do mapa vira ruído: cem pílulas de preço
  // disputando atenção com a única que a pessoa está lendo. Quem esconde é o
  // CSS, a partir desta classe — assim vale também para os pinos que a busca
  // redesenhar enquanto a seleção estiver de pé.
  $('.map-wrap')?.classList.toggle('foco', !!state.selected);
  if (routeLine) { routeLine.remove(); routeLine = null; }

  // A linha tracejada é a ligação em linha reta origem→destino. Ela vale
  // enquanto o trajeto de verdade ainda não é conhecido; depois que ele é
  // desenhado, a reta passa a contradizê-lo — o mapa mostrava uma ligação
  // direta a Perpignan ao lado de um caminho que ia por Bergamo e Toulouse,
  // e ainda por cima o site dizia "tem voo direto".
  const temTrajeto = state.caminho?.destId === state.selected;
  const r = state.results.find(x => x.dest.id === state.selected);
  if (r && state.origin && !temTrajeto) {
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
    // fitBounds dispara 'moveend' e 'zoomend': um booleano era consumido pelo
    // primeiro e deixava o segundo passar. Uma janela de tempo cobre os dois.
    if (Date.now() < (state.ignorarMoveAte || 0)) return;
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

  // Cede o thread para o navegador pintar o "calculando" antes do trabalho
  // síncrono. Usamos setTimeout e NÃO requestAnimationFrame: rAF fica parado
  // enquanto a aba está em segundo plano, e a busca nunca rodaria.
  setTimeout(() => {
    state.results = rankDestinations(state.origin, DESTINATIONS, {
      days: state.days, people: state.people, month: state.month, style: state.style,
      mode: state.mode, budgetEUR: budgetEUR(),
      sortBy: state.sortBy, realFares: state.realFares,
      filtro: state.filtro, viaEscala: state.viaEscala, bounds: areaVisivel(),
      temVooDireto: state.temVooDireto,
      manterId: state.selected,
    });

    renderStats();
    drawResults();
    if (refit) fitToResults();

    const still = state.results.find(r => r.dest.id === state.selected);
    if (still) renderDetails(still); else clearDetails();

    $('#mapLoading').hidden = true;
  }, 0);
}

/* ------------------------------------------- tarifas reais (Ryanair) ---- */
let faresAbort;
let faresPedido;

/**
 * Pede a busca de preços reais, juntando chamadas próximas numa só.
 *
 * Ao abrir a página a origem é definida duas vezes: o IP responde na hora e o
 * GPS corrige segundos depois. Cada uma disparava uma busca completa, e a
 * segunda cancelava a primeira no meio — jogando fora tudo que já tinha
 * chegado e recomeçando do zero. Um respiro curto faz as duas virarem uma.
 */
function pedirTarifasReais(atraso = 350) {
  clearTimeout(faresPedido);
  faresPedido = setTimeout(loadRealFares, atraso);
}

/**
 * Acompanha uma pausa até o fim e retoma a busca sozinho.
 *
 * Sem isto a pausa era definitiva para quem está olhando: o aviso ficava
 * parado e os preços só voltavam se a pessoa mexesse em alguma coisa ou
 * recarregasse a página — que é exatamente a impressão de "não carrega voos
 * que eu sei que existem".
 */
let pausaTimer;
function acompanharPausa() {
  clearInterval(pausaTimer);
  if (!RYA.estaBloqueado()) return;
  setFareStatus('pausa');
  pausaTimer = setInterval(() => {
    if (RYA.estaBloqueado()) return setFareStatus('pausa');
    clearInterval(pausaTimer);
    if (state.origin) loadRealFares();
  }, 1000);
}

/**
 * Busca preços reais de voo e, se vierem, refaz a conta com eles.
 *
 * Roda em segundo plano: o site já mostrou as estimativas e só melhora quando
 * a resposta chega. Qualquer falha é silenciosa.
 *
 * A ordem é de propósito: um aeroporto de saída inteiro por vez, do mais perto
 * de casa para o mais longe, e só depois a rede de escalas. Antes as rotas das
 * cinco saídas eram pedidas de uma vez antes de qualquer preço; agora cada
 * saída acende os seus destinos no mapa antes de a seguinte começar, e a fila
 * nunca fica com um monte de pedidos concorrendo pela mesma vaga.
 */
async function loadRealFares() {
  if (!state.origin) return;
  if (RYA.estaBloqueado()) return acompanharPausa();
  clearTimeout(faresPedido);
  faresAbort?.abort();
  faresAbort = new AbortController();
  const signal = faresAbort.signal;

  setFareStatus('loading');
  try {
    const airports = await RYA.loadAirports();
    if (signal.aborted) return;
    if (!airports.length) return setFareStatus('none');

    state.airports = airports;

    // Até 5 aeroportos de partida num raio de 260 km. Três não bastavam: quem
    // está em Olbia tem Figari e Alghero mais perto que Cagliari, e Cagliari é
    // justamente a que mais voa. Quem sai de um, sai de qualquer um — o filtro
    // "só voo direto" precisa enxergar todos.
    const saidas = RYA.nearestAirports(airports, state.origin, 260, 5);
    state.originAirports = saidas;
    state.originAirport = saidas[0] || null;
    if (!saidas.length) { state.realFares = new Map(); return setFareStatus('uncovered'); }

    const porIata = new Map(airports.map(a => [a.iata, a]));
    const diretos = new Set();
    state.temVooDireto = diretos;

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

    /* Um aeroporto de saída, do começo ao fim: descobre para onde ele voa,
       marca os destinos que têm voo direto e busca o preço de todos eles. */
    async function varrerSaida(saida, ordem) {
      // Quais destinos têm voo direto desta saída — pela MALHA, não pelas
      // tarifas já conhecidas. O filtro "só voo direto" usava as tarifas, e a
      // consulta geral traz só os 20 destinos mais baratos de cada aeroporto:
      // o Porto tem voo direto de Cagliari e ficava escondido pelo filtro.
      // As rotas ficam 30 dias em cache, então isto custa uma consulta só.
      const rotas = await RYA.routesFrom(saida.iata, signal, true);
      if (signal.aborted) return;

      const uteis = [];
      for (const rota of rotas) {
        const apt = porIata.get(rota.iata);
        if (!apt) continue;
        let melhor = null, menor = Infinity;
        for (const d of DESTINATIONS) {
          const km = distanciaSimples(apt, d);
          if (km < menor) { menor = km; melhor = d; }
        }
        if (melhor && menor <= 130) { diretos.add(melhor.id); uteis.push(rota.iata); }
      }
      search({ refit:false });                  // o filtro já enxerga esta saída
      if (!uteis.length) return;

      // Preço de TODOS os destinos desta saída, em lotes.
      //
      // A consulta geral devolve só as 20 ofertas mais baratas de cada
      // aeroporto, mas Cagliari sozinha serve 42 rotas: metade dos destinos
      // diretos ficava com estimativa. Buscar por país tampouco resolvia —
      // essa consulta também corta em 20. O que resolve é pedir os destinos
      // pelo nome: `arrivalAirportIataCodes` aceita uma lista, então partimos
      // as rotas em lotes de 15 e juntamos as respostas. São 3 requisições por
      // aeroporto e o mapa vai acendendo as estrelas a cada lote.
      const total = Math.ceil(uteis.length / RYA.LOTE_DESTINOS);
      let feitos = 0;

      await RYA.sweepFares(saida.iata, uteis, state.month, state.days, signal, novas => {
        if (signal.aborted) return;
        feitos++;
        if (novas.size) { juntar(novas, saida); aplicar(); }
        // depois do aplicar(), que também mexe no aviso
        setFareStatus('varrendo', {
          feitos, total, saida: saida.iata, ordem, saidas: saidas.length,
        });
      });
    }

    // Primeira pintura: a consulta geral da saída mais próxima, uma requisição
    // só. Traz os 20 destinos mais baratos dela, então o mapa já tem preço real
    // antes de a varredura começar. Serve também de rede de segurança caso a
    // malha de rotas venha vazia.
    const rapidas = await RYA.fetchFares(
      saidas[0].iata, state.month, state.days, signal, null, true);
    if (signal.aborted) return;
    juntar(rapidas, saidas[0]);
    aplicar();

    // Daqui para a frente, uma saída de cada vez, da mais perto para a mais
    // longe. Se a API entrar em pausa no meio, o que já acendeu fica.
    for (const [i, saida] of saidas.entries()) {
      if (signal.aborted) return;
      if (RYA.estaBloqueado()) return acompanharPausa();
      await varrerSaida(saida, i + 1);
    }
    if (signal.aborted) return;
    setFareStatus(acumulado.size ? 'ok' : 'none');

    // Por último a rede de escalas, das duas saídas mais próximas: é a parte
    // mais cara (oito consultas por saída) e a que menos gente olha, então ela
    // só começa depois que todo preço direto já está na tela.
    if (RYA.estaBloqueado()) return acompanharPausa();
    const alcanceTotal = new Map();
    for (const saida of saidas.slice(0, 2)) {
      const alcance = await RYA.reachableWithStop(saida.iata, signal, parcial => {
        for (const [k, v] of parcial) if (!alcanceTotal.has(k)) alcanceTotal.set(k, { hub:v, saida });
        if (!signal.aborted) casarEscalas(alcanceTotal, airports);
      });
      if (signal.aborted) return;
      for (const [k, v] of alcance) if (!alcanceTotal.has(k)) alcanceTotal.set(k, { hub:v, saida });
      casarEscalas(alcanceTotal, airports);
    }
  } catch {
    if (signal.aborted) return;
    if (RYA.estaBloqueado()) acompanharPausa(); else setFareStatus('none');
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

function setFareStatus(kind, progresso = null) {
  const box = $('#fareStatus');
  if (!box) return;
  const n = state.realFares.size;
  const apt = state.originAirport;
  // mostra só os aeroportos que de fato renderam alguma tarifa
  const usados = new Set([...state.realFares.values()].map(f => f.saida?.iata).filter(Boolean));
  const saidas = state.originAirports
    .filter(a => usados.has(a.iata))
    .map(a => a.iata)
    .join(', ');

  const texts = {
    loading:   ['…', 'buscando preços reais de voo'],
    varrendo:  [String(n), progresso
                  ? `${progresso.saida} (${progresso.ordem} de ${progresso.saidas}) — ` +
                    `lote ${progresso.feitos} de ${progresso.total}`
                  : 'varrendo destinos'],
    pausa:     ['', `muitas consultas seguidas — voltamos em ${RYA.segundosDePausa()} s`],
    ok:        [String(n), `preços reais${saidas ? ' de ' + saidas : ''}`],
    uncovered: ['', 'sem voos Ryanair perto da sua origem — voos estimados'],
    none:      ['', 'preços reais indisponíveis agora — voos estimados'],
  };
  const [num, label] = texts[kind] || texts.none;
  box.dataset.kind = kind;
  $('.map-wrap')?.classList.toggle('buscando', kind === 'loading' || kind === 'varrendo');
  box.innerHTML = num
    ? `<b>${num}</b><span>${esc(label)}</span>`
    : `<span>${esc(label)}</span>`;
  box.hidden = false;

  // os botões de filtro só aparecem quando há o que filtrar
  const caixa = $('#mapFiltros');
  const comEscala = state.viaEscala.size;
  if (caixa) {
    caixa.hidden = n === 0 && state.temVooDireto.size === 0;
    $('#countDireto').textContent = state.temVooDireto.size || n || '';
    const btnD = $('#btnDireto');
    if (btnD) {
      btnD.title = usados.size > 1
        ? `Voos diretos saindo de ${[...usados].join(', ')} — todos perto de você`
        : 'Voos diretos com preço confirmado';
    }
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
  // o enquadramento do trajeto substitui o antigo "voar até o pino"
  renderDetails(r);
  if (state.origin) {
    state.enquadrado = id;
    enquadrarTrajeto(pontosDoVoo(r));
  }
  $('#details').dataset.state = 'open';
  $('#detailsHandle').setAttribute('aria-expanded', 'true');
  ajustarAlturaAoConteudo();
  pintarBotaoLimpar();
  state.conexao = null;
  state.caminho = null;          // o trajeto do destino anterior não vale mais
  if (state.enquadrado !== id) state.enquadrado = null;
  desenharRotaFixa({ animar:true });
}

/**
 * Desfaz a seleção e devolve a tela ao estado de mapa limpo.
 *
 * Fechar a barra pelo cabeçalho só a recolhia: o destino seguia escolhido, o
 * arco continuava desenhado e o pino, destacado — e voltar a "olhar o mapa
 * inteiro" exigia clicar em outro lugar qualquer. Aqui a saída é explícita.
 *
 * Não mexe no formulário: origem, orçamento e datas são o contexto da pessoa,
 * não a seleção. Só o destino digitado sai junto, porque é ele que prende o
 * mapa a um lugar só.
 */
function limparSelecao() {
  state.selected = null;
  state.conexao = null;
  state.caminho = null;
  state.enquadrado = null;
  if (state.destinoAlvo) limparDestino();
  clearDetails({ forcar:true });
  desenharRotaFixa();
  paintSelection();          // também tira o foco e devolve os outros destinos
  pintarBotaoLimpar();
  setTimeout(() => map.invalidateSize(), 260);
}

/** O botão de limpar só existe quando há algo para limpar. */
function pintarBotaoLimpar() {
  const b = $('#btnLimparSelecao');
  if (b) b.hidden = !state.selected && !state.destinoAlvo;
}

/* ---------------------------------------------------------- detalhes --- */
const VERDICT = {
  fit:   { tag:'cabe',      cls:'tag-fit' },
  tight: { tag:'quase lá',  cls:'tag-tight' },
  over:  { tag:'acima',     cls:'tag-over' },
};

function clearDetails({ forcar = false } = {}) {
  // Enquanto houver um destino aberto, a barra fica. Buscas em andamento
  // chegavam com a lista da área anterior e recolhiam o painel logo depois de
  // ele abrir — uma corrida difícil de reproduzir e fácil de evitar.
  if (state.selected && !forcar) return;
  state.selected = null;
  $('#detailsTitle').textContent = 'Clique num destino do mapa para ver os voos';
  $('#detailsBody').innerHTML =
    `<p class="empty">Clique em um ponto do mapa ou em um destino da lista para ver as opções de voo e hospedagem.</p>
     <aside class="ad-strip" aria-label="Publicidade">
       <div class="ad-slot" data-ad="strip1"></div>
       <div class="ad-slot" data-ad="strip2"></div>
       <div class="ad-slot" data-ad="strip3"></div>
     </aside>`;
  mountAllAds($('#detailsBody'));
  // Sem destino escolhido não há o que mostrar: a barra fica recolhida e a
  // tela é só o mapa e o formulário. Ela se abre sozinha ao clicar num destino.
  $('#details').dataset.state = 'collapsed';
  $('#detailsHandle').setAttribute('aria-expanded', 'false');
}

/**
 * O que dizer quando não há preço confirmado para o destino aberto.
 *
 * "Tem voo direto — estamos buscando o preço" só é verdade enquanto a busca
 * está correndo. Depois que ela termina, repetir isso é contraditório: ao lado
 * o site mostra um trajeto com escala e ônibus, e embaixo promete um voo
 * direto que não existe nas datas pedidas.
 *
 * A malha de rotas é o que diz "existe voo direto", e ela não sabe de datas —
 * uma rota pode voar duas vezes por semana e não operar no dia escolhido. É
 * justamente o que acontece no modo calendário.
 */
function textoSemConfirmado(r) {
  const valor = fmt(r.flight || r.airPP);
  const buscando = ['loading', 'varrendo'].includes($('#fareStatus')?.dataset.kind);

  if (r.voaDireto && buscando) {
    return `Este destino <b>tem voo direto</b> da companhia — estamos buscando o preço.
            O valor de ${valor} no resumo é estimativa até ele chegar.`;
  }
  if (r.voaDireto && state.quando === 'datas') {
    return `A companhia <b>voa direto</b> para este destino, mas <b>não nos dias que você
            escolheu</b> — por isso o caminho ao lado tem escala. O valor de ${valor} no
            resumo é estimativa de planejamento.`;
  }
  if (r.voaDireto) {
    return `A companhia <b>tem a rota direta</b>, mas não encontramos tarifa para este
            período. O valor de ${valor} no resumo é estimativa de planejamento.`;
  }
  return `Sem preço confirmado para esta rota. O valor de <b>${valor}</b>
          no resumo é estimativa de planejamento — confira na busca ao lado.`;
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

  const ctx = { origin: state.origin };
  // A linha "Estimativa de mercado" saiu: repetia o valor que já está no
  // Resumo e levava ao mesmo Google do botão ao lado, com um destaque verde
  // que competia com o do preço confirmado. Ficam só as opções reais.
  const flights = P.flightOptions(r, ctx).filter(o => !o.estimativa);
  const stays   = P.stayOptions(r, ctx);
  // Com preço confirmado não faz sentido mandar a pessoa pesquisar o voo de
  // novo: a busca de voo some e o espaço fica para as opções de caminho. A de
  // hospedagem continua, porque ali nunca há preço confirmado.
  const links = bookingLinks(state.origin, r, state.month)
    .filter(l => (mode.flight && l.kind === 'flight' && !r.real)
              || (mode.stay   && l.kind === 'stay'));
  const semBusca = links.length === 0;

  // Sem voo direto para este destino, oferecemos o aeroporto vizinho que tem.
  // A sugestão de cidade vizinha vive na caixa de caminhos (#conexaoBox), que
  // é montada depois com voos, preços e links. Ter as duas mostrava a mesma
  // informação duas vezes na tela.

  // O total saiu do corpo e subiu para o cabeçalho: repetido em letra grande
  // ao lado de cada card, ele competia com o preço de cada opção — que é o que
  // a pessoa compara de fato. Aqui fica o contexto (quanto sobra do orçamento)
  // e a divisão voo/hospedagem, que só informa algo quando há as duas coisas.
  const resumo = `
    <div class="resumo-linha">
      <span class="resumo-saldo ${r.left >= 0 ? 'ok' : 'bad'}">
        ${r.left >= 0
          ? `Sobram <b>${fmt(r.left)}</b> de ${fmt(budgetEUR())}`
          : `Faltam <b>${fmt(-r.left)}</b> para ${fmt(budgetEUR())}`}
      </span>
      ${parts.length > 1 ? `<span class="resumo-bar"><span class="bar">${bar}</span>
        <span class="bar-key">${key}</span></span>` : ''}
      ${localTxt}
    </div>`;

  $('#detailsBody').innerHTML = `
    ${resumo}
    <div class="dgrid dgrid-${r.mode}${semBusca ? ' dgrid-sem-busca' : ''}">

      ${mode.flight ? `
      <section class="dcol dcol-larga">
        <h4>Como chegar · ${r.useGround ? 'rota terrestre' : `${Math.round(r.km).toLocaleString('pt-BR')} km`}</h4>
        ${realRow}
        <div class="conexao" id="conexaoBox" hidden></div>
        ${flights.map(optRow).join('')}
        ${(!r.real && !r.useGround) ? `
          <p class="sem-confirmado" id="semConfirmado">${textoSemConfirmado(r)}</p>` : ''}
      </section>` : ''}

      ${mode.stay ? `
      <section class="dcol">
        <h4>Hospedagem · ${r.nights} noites</h4>
        ${stays.map(optRow).join('')}
        <p class="osm-stays" id="osmStays" hidden></p>
      </section>` : ''}

      ${semBusca ? '' : `
      <section class="dcol dcol-busca">
        <h4>${links.every(l => l.kind === 'stay') ? 'Pesquisar hospedagem' : 'Pesquisar'}</h4>
        <div class="book book-abas" id="abasBusca">
          ${links.map(l => `<a class="aba" href="${l.href}" target="_blank" rel="noopener nofollow">
             <b>${esc(l.label)}</b><span>${esc(l.note)}</span></a>`).join('')}
        </div>
        <p class="disclaimer">Estimativa de planejamento (distância, temporada de
          ${MONTHS[state.month].toLowerCase()}${mode.stay ? ' e preço de hospedagem local' : ''})
          — não é cotação. Comida e passeios não entram nesta conta.</p>
      </section>`}
    </div>

    <aside class="ad-strip" aria-label="Publicidade">
      <div class="ad-slot" data-ad="strip1"></div>
      <div class="ad-slot" data-ad="strip2"></div>
      <div class="ad-slot" data-ad="strip3"></div>
    </aside>`;

  $('#detailsBody').querySelector('[data-alt]')?.addEventListener('click', e => {
    select(e.currentTarget.dataset.alt, { fly:true });
  });

  mountAllAds($('#detailsBody'));
  // Sem voo confirmado, a busca deixa de ser um link lateral e passa a ser o
  // caminho principal: em vez de a tela parecer um beco sem saída, ela oferece
  // o atalho para a pessoa procurar por conta própria.
  realcarBusca(mode.flight && !r.real && !r.useGround);
  if (mode.stay) showOsmStays(r.dest);

  // A busca de caminhos alternativos custa dezenas de consultas à companhia.
  // Fazê-la a cada destino aberto esgotava o limite da API em poucos cliques —
  // e quem só está passeando pelo mapa nem chega a olhar o resultado. Agora ela
  // só acontece quando a pessoa pede, e o que já foi procurado fica guardado.
  if (mode.flight && !r.real && !r.useGround) prepararBuscaDeCaminhos(r);
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
    if (!d || !ligadosPorTerra(d, r.dest)) continue;   // precisa ter estrada
    const km = Math.round(distanciaSimples(d, r.dest));
    if (km > maxKm) continue;
    if (!melhor || km < melhor.km) melhor = { dest:d, fare, km };
  }
  return melhor;
}

/** Liga ou desliga o destaque dourado da coluna de busca. */
/**
 * Tira da tela a coluna de busca no Google e alarga o que sobrou.
 *
 * Some só quando já existe resposta melhor — preço confirmado ou caminho
 * encontrado. Sem isso a coluna continua ali, competindo com a informação boa
 * pelo mesmo espaço horizontal.
 */
function esconderColunaBusca() {
  const col = $('#abasBusca')?.closest('.dcol');
  if (!col) return;
  col.hidden = true;
  col.closest('.dgrid')?.classList.add('dgrid-sem-busca');
}

function realcarBusca(ligado) {
  const abas = $('#abasBusca');
  const col = abas?.closest('.dcol');
  if (!abas) return;
  abas.classList.toggle('is-ouro', ligado);
  col?.classList.toggle('dcol-ouro', ligado);
}

/**
 * O ponto que a pessoa realmente quer alcançar.
 *
 * Quando ela pediu Pontevedra e o site escolheu Santiago de Compostela por ser
 * o destino conhecido mais próximo, o ônibus tem de terminar em Pontevedra —
 * não em Santiago. O voo continua sendo escolhido pela cidade da base; só o
 * último trecho muda de alvo.
 */
function alvoFinal(r) {
  const a = state.destinoAlvo;
  if (a && a.id === r.dest.id && a.pedido && a.kmDoPedido > 5
      && Number.isFinite(a.pedidoLat)) {
    return { city: a.pedido, lat: a.pedidoLat, lon: a.pedidoLon };
  }
  return r.dest;
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
  const destinoFinal = alvoFinal(r);

  const vizinhos = DESTINATIONS
    .filter(d => d.id !== r.dest.id)
    // o trecho final é de ônibus: as duas pontas têm de estar na mesma terra
    .filter(d => ligadosPorTerra(d, destinoFinal))
    .map(d => ({ d, km: Math.round(distanciaSimples(d, destinoFinal)) }))
    .filter(v => v.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, 2);        // cada vizinho pode custar várias consultas

  // a própria cidade da base entra na disputa: se Santiago tem voo, o ônibus
  // até Pontevedra sai de lá mesmo
  if (state.realFares.has(r.dest.id) && distanciaSimples(r.dest, destinoFinal) > 5) {
    vizinhos.unshift({ d: r.dest, km: Math.round(distanciaSimples(r.dest, destinoFinal)) });
  }

  // AEROPORTOS vizinhos, não só as nossas cidades.
  //
  // A lista de destinos tem 212 cidades; a malha da companhia tem centenas de
  // aeroportos. Para Bilbao, as cidades mais próximas da nossa lista são
  // Zaragoza (245 km) e Bordeaux (257 km) — longe demais para ônibus —, mas
  // existe Vitória a 60 km, que não é uma das nossas cidades e por isso nunca
  // entrava na disputa. Era o caso em que a pessoa via "sem volta nesta janela"
  // enquanto havia um voo a uma hora de ônibus do destino.
  const jaTemCidade = new Set(vizinhos.map(v => v.d.id));
  for (const apt of RYA.nearestAirports(state.airports, destinoFinal, maxKm, 6)) {
    if (apt.iata === r.dest.air) continue;                    // o próprio já foi
    // se já existe uma cidade nossa servida por este aeroporto, não repete
    if ([...jaTemCidade].some(id => DESTINATIONS.find(d => d.id === id)?.air === apt.iata)) continue;
    if (apt.km < 12) continue;                                // é o próprio destino
    vizinhos.push({
      d: { id:null, city:apt.city, lat:apt.lat, lon:apt.lon, air:apt.iata },
      km: apt.km,
      aeroporto: apt,
    });
  }
  vizinhos.sort((a, b) => a.km - b.km);
  vizinhos.splice(4);          // cada candidato custa consultas; quatro bastam

  const achados = [];
  let tentativasCaras = 0;
  for (const v of vizinhos) {
    const terra = P.groundLeg(v.km);

    // 1) já temos tarifa confirmada para essa cidade?
    const jaTem = state.realFares.get(v.d.id);
    if (jaTem) {
      achados.push({ ...v, fare:jaTem, terra, saida:jaTem.saida, total:jaTem.price + terra.preco });
      continue;
    }

    // 2) senão, existe voo direto até ela saindo de algum aeroporto perto?
    const apt = v.aeroporto || RYA.nearestAirport(state.airports, v.d, 130);
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
      if (achados.length >= 2) break;
      continue;
    }

    // 3) sem voo direto até o vizinho, vale uma CONEXÃO até ele.
    //
    // Era aqui que o site desistia e anunciava "sem volta nesta janela". Para
    // Bilbao em datas fixas a volta direta não existe — a conexão pediria 45 h
    // em Bergamo, o que o teto de 28 h recusa, e com razão. Mas partindo de
    // Santander, a 100 km, a volta fecha em 25 h de escala. Quem marcou férias
    // não quer saber que "não dá": quer saber que dá, de ônibus até o
    // aeroporto ao lado.
    const saida = state.originAirports?.[0];
    if (!saida) continue;
    // Uma conexão até o vizinho custa de 4 a 8 consultas, e há vários vizinhos:
    // fazer isso para todos é o tipo de leque que já nos rendeu um bloqueio da
    // companhia. Só o mais próximo ganha essa tentativa.
    if (tentativasCaras >= 1) continue;
    tentativasCaras++;

    // Três hubs aqui, e não os dois de sempre: este caminho só roda quando os
    // outros falharam, então vale gastar uma consulta a mais para incluir uma
    // base da companhia — que é onde as datas fixas costumam fechar.
    const viaEscala = await RYA.findConnection(
      { iata: saida.iata }, { iata: apt.iata }, state.airports, state.month, state.days, signal,
      { maxHubs: 3 },
    );
    if (signal?.aborted) return null;
    if (viaEscala?.completa) {
      achados.push({
        ...v, terra, saida,
        fare: {
          price: viaEscala.total,
          ida: viaEscala.pernas,            // duas pernas, não uma
          volta: viaEscala.pernasVolta,
          hub: viaEscala.hub,
        },
        total: viaEscala.total + terra.preco,
      });
    }
    if (achados.length >= 2) break;          // compara dois candidatos
  }

  if (!achados.length) return null;
  achados.sort((a, b) => a.total - b.total);
  return { ...achados[0], destinoFinal };
}

/**
 * Mostra o resultado já conhecido ou um botão para procurar.
 *
 * Guardar por destino evita refazer a busca quando a pessoa volta a um lugar
 * que já olhou — o caso mais comum de repetição.
 */
async function prepararBuscaDeCaminhos(r) {
  const caixa = $('#conexaoBox');
  if (!caixa) return;

  const guardado = state.caminhosPorDestino.get(r.dest.id);
  if (guardado) {
    caixa.hidden = false;
    mostrarCaminhos({ ...guardado, r });
    return;
  }

  // Primeiro o barato: existe voo direto para ESTE destino?
  //
  // A varredura geral traz só os 20 mais baratos de cada saída, e a varredura
  // por região depende de a pessoa passar por lá. O Porto tem voo direto de
  // Cagliari e não aparecia em nenhuma das duas — mas conferir um par
  // específico custa duas consultas, contra as ~12 da busca de caminhos.
  caixa.hidden = false;
  caixa.classList.remove('conexao-direta', 'duas-opcoes');
  caixa.innerHTML = '<span class="conexao-load">conferindo se há voo direto…</span>';

  const achou = await tentarVooDireto(r);
  if (achou || state.selected !== r.dest.id) return;   // já virou preço confirmado

  caixa.hidden = false;
  caixa.classList.remove('conexao-direta', 'duas-opcoes');
  if (RYA.estaBloqueado()) {
    caixa.innerHTML = `<span class="conexao-load">muitas consultas seguidas à companhia —
      voltamos em ${RYA.segundosDePausa()} s</span>`;
    return;
  }

  // Sem voo direto, procuramos os outros caminhos automaticamente: quem abriu
  // um destino quer a resposta, não um botão. O que evita o desperdício é o
  // atraso curto abaixo — passar o mouse por vários destinos em sequência não
  // dispara busca nenhuma, só o que ficar aberto dispara.
  caixa.innerHTML = '<span class="conexao-load">procurando caminhos até aqui…</span>';
  clearTimeout(caminhosTimer);
  caminhosTimer = setTimeout(() => {
    if (state.selected === r.dest.id) buscarConexao(r);
  }, 700);
}
let caminhosTimer;

/**
 * Confere se alguma das saídas próximas tem voo direto para este destino.
 * Duas consultas por saída, no máximo duas saídas: é a busca mais barata que
 * existe e resolve a maioria dos casos.
 */
async function tentarVooDireto(r) {
  if (r.real || r.useGround || !state.airports.length) return false;
  if (RYA.estaBloqueado()) return false;

  const destApt = RYA.nearestAirport(state.airports, r.dest, 130);
  if (!destApt) return false;

  // Todas as saídas, não só as duas primeiras: Cagliari é a terceira mais
  // próxima de Olbia e é justamente ela que voa para o Porto. Conferir a rota
  // é de graça (cache de 30 dias); só gasta consulta quando a rota existe.
  for (const saida of state.originAirports) {
    if (saida.iata === destApt.iata) continue;
    const rotas = await RYA.routesFrom(saida.iata);      // cache de 30 dias
    if (!rotas.some(x => x.iata === destApt.iata)) continue;

    const preco = await RYA.directRoundTrip(saida.iata, destApt.iata, state.month, state.days);
    if (preco) {
      registrarTarifaEncontrada(r.dest.id, { ...preco, saida }, destApt);
      return true;
    }
  }
  return false;
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
  // Nenhum aeroporto é excluído aqui, nem os que já usamos como saída: a
  // consulta geral de cada saída traz só os 20 destinos mais baratos, e a
  // varredura país a país roda apenas nas duas mais próximas. Cagliari voa
  // direto para o Porto, mas isso não aparecia em nenhuma das duas listas —
  // excluir as saídas fazia o site perder justamente o voo que resolvia.
  const direto = await RYA.directFromNearbyAirport(
    state.origin, destApt, state.airports, state.month, state.days, signal, [],
  );
  if (signal.aborted || state.selected !== alvo) return;
  if (direto) {
    registrarTarifaEncontrada(r.dest.id, direto, destApt);
    mostrarDiretoDeLonge(direto, destApt, r);
    return;
  }

  // Sem voo direto, as duas alternativas são buscadas juntas e mostradas lado
  // a lado: quem não quer pegar ônibus precisa ver a opção só de avião, e quem
  // não quer escala precisa ver a de ônibus. A escolha é de quem viaja.
  const [comTerra, comEscala] = await Promise.all([
    vooMaisTerra(r, signal),
    buscarEscala(r, ordem, destApt, signal),
  ]);
  if (signal.aborted || state.selected !== alvo) return;

  if (comTerra || comEscala) {
    state.caminhosPorDestino.set(r.dest.id, { comTerra, comEscala, destApt, apt });
    mostrarCaminhos({ comTerra, comEscala, r, destApt, apt });
    return;
  }
  state.caminhosPorDestino.set(r.dest.id, { comTerra:null, comEscala:null, destApt, apt });

  if (caixa) caixa.hidden = true;   // nenhum caminho encontrado
}

/**
 * Trajeto só de avião, com escala. Compara as duas saídas mais próximas em vez
 * de ficar com a primeira que funcionar: parar na primeira levava a trajetos
 * saindo de um aeroporto a 195 km quando o local resolvia por menos.
 */
async function buscarEscala(r, ordem, destApt, signal) {
  const achadas = [];
  for (const partida of ordem.slice(0, 2)) {     // compara as duas mais próximas
    if (partida.iata === destApt.iata) continue;
    const achada = await RYA.findConnection(
      partida, destApt, state.airports, state.month, state.days, signal,
    );
    if (signal?.aborted) return null;
    if (achada) { achada.partida = partida; achadas.push(achada); }
  }
  // entre trajetos parecidos, o que sai de perto de casa leva vantagem
  const custo = t => t.total + (t.partida?.km || 0) * 0.05;
  return achadas.sort((a, b) => custo(a) - custo(b))[0] || null;
}

/**
 * Guarda a tarifa achada sob demanda junto com as demais.
 *
 * Assim o destino passa a contar como "preço confirmado": ganha a estrela no
 * mapa, entra no filtro de voo direto e o card mostra o valor real em vez da
 * estimativa — sem precisar refazer a busca inteira.
 */
function registrarTarifaEncontrada(destId, direto, destApt) {
  if (state.realFares.has(destId)) return;
  state.realFares.set(destId, {
    iata: destApt.iata,
    price: direto.price,
    ida: direto.ida,
    volta: direto.volta,
    outDate: direto.ida?.depart?.slice(0, 10),
    inDate: direto.volta?.depart?.slice(0, 10),
    originIata: direto.saida.iata,
    saida: direto.saida,
    airport: destApt,
    airportKm: 0,
  });
  state.viaEscala.delete(destId);
  // Um voo direto de verdade substitui qualquer caminho com escala fixado
  // antes dele — senão o mapa segue mostrando o hub antigo ao lado do texto
  // "voo direto", como a reta tracejada já fazia antes de existir a checagem
  // em paintSelection.
  if (state.caminho?.destId === destId) state.caminho = null;
  setFareStatus('ok');
  search({ refit:false });
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
  fixarCaminho(r.dest.id, [state.origin, d.saida, r.dest]);
}

/* ---------------------------------------------- caminhos alternativos ---- */

/** Uma perna de voo, clicável, com horários e preço. */
function pernaVoo(p, rotulo, people) {
  if (!p) return '';
  return `
    <a class="perna is-link" href="${RYA.legBookingUrl(p, people)}"
       target="_blank" rel="noopener nofollow">
      <span class="perna-rota"><b>${esc(p.from)}</b> → <b>${esc(p.to)}</b>
        <i class="perna-voo">${esc(p.flight || '')}</i></span>
      <span class="perna-data">${rotulo} · ${fmtDataHora(p.depart)} → ${fmtHora(p.arrive)}
        ${p.minutos > 0 ? `· ${fmtDuracao(p.minutos)}` : ''}</span>
      <span class="perna-preco">${fmt(p.price)}<small>reservar →</small></span>
    </a>`;
}

/**
 * Monta os caminhos possíveis até o destino, um abaixo do outro.
 *
 * Não escolhemos por quem viaja: quem não quer pegar ônibus precisa ver a
 * opção só de avião, e quem não quer escala precisa ver a de ônibus. As duas
 * aparecem, com o preço de cada uma, e o mapa desenha a que estiver sob o
 * ponteiro.
 */
/**
 * Desenha um trecho que pode ser um voo só ou uma conexão de duas pernas.
 *
 * O card de "voo + ônibus" nasceu supondo um voo direto até a cidade vizinha.
 * Desde que ele também aceita conexões, `ida` e `volta` podem vir como lista.
 */
function pernasDoTrecho(trecho, rotulo, people) {
  if (!trecho) return '';
  if (!Array.isArray(trecho)) return pernaVoo(trecho, rotulo, people);

  // A lista que vem de `findConnection` é [perna, perna, tipoDaEscala] — o
  // terceiro item é uma string, não um voo. Desenhá-lo dava uma linha
  // "undefined → undefined · € NaN" no card.
  const voos = trecho.filter(p => p && typeof p === 'object' && p.depart);
  return voos.map((p, i) => pernaVoo(p, `${rotulo} ${i + 1}`, people)).join('');
}

function mostrarCaminhos({ comTerra, comEscala, r, destApt, apt }) {
  const caixa = $('#conexaoBox');
  if (!caixa) return;

  const opcoes = [];

  const minutosEntre = (a, b) => (a && b) ? Math.round((new Date(b) - new Date(a)) / 60000) : null;

  if (comTerra) {
    // o trecho de ônibus termina onde a pessoa pediu, não na cidade da base
    const fim = comTerra.destinoFinal || r.dest;
    // com conexão, a duração do voo é a soma das pernas
    const voo = Array.isArray(comTerra.fare.ida)
      ? comTerra.fare.ida.reduce((n, p) => n + (p?.minutos || 0), 0)
      : (comTerra.fare.ida?.minutos || 0);
    const bus = Math.round(comTerra.km / 70 * 60);
    opcoes.push({
      duracao: voo + bus + 90,          // +90 min de aeroporto e baldeação
      chave: 'terra',
      tag: `★ voo + ${comTerra.terra.modo}`,
      total: comTerra.total,
      resumo: `voo ida e volta + ${comTerra.terra.modo}`,
      corpo: `
        ${pernasDoTrecho(comTerra.fare.ida, 'ida', r.people)}
        ${pernasDoTrecho(comTerra.fare.volta, 'volta', r.people)}
        <a class="perna is-link perna-terra"
           href="${googleTerra(comTerra.d.city, fim.city)}" target="_blank" rel="noopener nofollow">
          <span class="perna-rota"><b>${esc(comTerra.d.city)}</b> → <b>${esc(fim.city)}</b>
            <i class="perna-voo">${esc(comTerra.terra.modo)}</i></span>
          <span class="perna-data">${comTerra.km} km · cerca de ${esc(comTerra.terra.tempo)} por trecho</span>
          <span class="perna-preco">${fmt(comTerra.terra.preco)}<small>buscar →</small></span>
        </a>`,
      nota: `Um voo só até <b>${esc(comTerra.d.city)}</b> e ${esc(comTerra.terra.tempo)}
             de ${esc(comTerra.terra.modo)} até <b>${esc(fim.city)}</b>. O valor do
             ${esc(comTerra.terra.modo)} é estimativa; confira no buscador.`,
      // Só há para onde ir quando a escala é uma cidade da nossa lista; quando
      // é um aeroporto vizinho não existe destino a abrir.
      acao: comTerra.d.id
        ? `<button type="button" class="ver-destino" data-alt="${esc(comTerra.d.id)}">ver ${esc(comTerra.d.city)} →</button>`
        : '',
      pontos: [state.origin, comTerra.saida, comTerra.d, fim],
    });
  }

  if (comEscala) {
    const c = comEscala;
    const espera = min => !Number.isFinite(min) ? 'troca de voo'
      : min <= 720 ? (min < 60 ? `${min} min de espera` : `${fmtDuracao(min)} de espera`)
      : 'uma noite na cidade';

    const bloco = (pernas, esperaMin, rotulo) => !pernas ? '' : `
      <div class="conexao-rot">${rotulo}</div>
      ${pernaVoo(pernas[0], 'voo 1', r.people)}
      <span class="perna-seta${esperaMin > 720 ? ' is-longa' : ''}">
        ↓ <i>escala em ${esc(c.hub.iata)} · ${espera(esperaMin)}</i>
      </span>
      ${pernaVoo(pernas[1], 'voo 2', r.people)}`;

    const paradas = [state.origin];
    if (c.partida && c.partida.km > 40) paradas.push(c.partida);
    paradas.push(c.hub, r.dest);

    opcoes.push({
      duracao: minutosEntre(c.pernas[0]?.depart, c.pernas[1]?.arrive) ?? 9999,
      chave: 'escala',
      tag: '✈ só de avião, com escala',
      total: c.total,
      resumo: c.completa ? 'ida e volta, 4 trechos' : 'só ida — sem volta nesta janela',
      corpo: bloco(c.pernas, c.esperaMin, `ida · ${fmt(c.idaTotal)}`)
        + (c.pernasVolta ? bloco(c.pernasVolta, c.esperaVoltaMin, `volta · ${fmt(c.voltaTotal)}`) : ''),
      nota: `Sem ônibus: tudo de avião, parando em <b>${esc(c.hub.city)}</b>.
             São <b>bilhetes separados</b> — a conexão não é garantida pela companhia,
             e um atraso faz perder o voo seguinte.${(() => {
               const f = alvoFinal(r);
               return f.city !== r.dest.city
                 ? ` O voo chega em ${esc(r.dest.city)}; de lá ainda faltam
                     ${Math.round(distanciaSimples(r.dest, f))} km até ${esc(f.city)}.`
                 : '';
             })()}`,
      acao: '',
      pontos: paradas,
    });
  }

  if (!opcoes.length) { caixa.hidden = true; return; }

  // Fora as opções que perdem em TUDO.
  //
  // A tela promete duas coisas: a mais rápida e a mais barata. Uma opção que é
  // ao mesmo tempo mais cara e mais lenta que outra não é nenhuma das duas — é
  // só ruído ocupando metade do espaço. Para o Porto o site chegou a mostrar um
  // voo + ônibus de € 339 em 8h34 ao lado de uma escala de € 102 em 7h25, com
  // esta última marcada como "mais rápida e mais barata": a própria tela dizia
  // que a outra não servia para nada.
  //
  // A folga de 5% no preço evita descartar por diferença irrelevante — uma
  // opção € 3 mais cara mas duas horas mais curta continua valendo a pena.
  const dominada = (a, b) =>
    b.total <= a.total * 0.95 && b.duracao <= a.duracao;
  const sobreviventes = opcoes.filter(o => !opcoes.some(x => x !== o && dominada(o, x)));
  if (sobreviventes.length) opcoes.length = 0, opcoes.push(...sobreviventes);

  // Esquerda: a mais rápida, em dourado. Direita: a mais barata, em verde.
  // Quando só há uma opção, ela fica sozinha e sem disputa.
  const maisBarata = [...opcoes].sort((a, b) => a.total - b.total)[0];
  const maisRapida = [...opcoes].sort((a, b) => a.duracao - b.duracao)[0];
  opcoes.sort((a, b) => (a === maisRapida ? -1 : 1) - (b === maisRapida ? -1 : 1));

  const selo = o => {
    if (opcoes.length < 2) return '';
    if (o === maisRapida && o === maisBarata) return '<span class="selo-duplo">mais rápida e mais barata</span>';
    if (o === maisRapida) return '<span class="selo-rapido">mais rápida</span>';
    if (o === maisBarata) return '<span class="selo-barato">mais barata</span>';
    return '';
  };
  const tom = o => (opcoes.length > 1 && o === maisBarata && o !== maisRapida) ? 'verde' : 'ouro';

  caixa.classList.add('conexao-direta');
  caixa.classList.toggle('duas-opcoes', opcoes.length > 1);
  caixa.innerHTML = opcoes.map(o => `
    <div class="caminho caminho-${tom(o)}" data-caminho="${o.chave}">
      <div class="conexao-head">
        <div class="conexao-id">
          <span class="conexao-tag ${tom(o) === 'verde' ? 'tag-verde' : 'tag-ouro'}">${o.tag}</span>
          ${selo(o)}
          <small>${esc(o.resumo)}${o.duracao < 9999 ? ` · ${fmtDuracao(o.duracao)} de viagem` : ''}</small>
        </div>
        <b class="conexao-preco">${fmt(o.total)}</b>
      </div>
      <div class="conexao-bloco">${o.corpo}</div>
      <p class="conexao-nota">${o.nota} ${o.acao}</p>
    </div>`).join('');

  // passar o mouse por uma opção desenha aquele caminho no mapa
  caixa.querySelectorAll('.caminho').forEach(el => {
    const o = opcoes.find(x => x.chave === el.dataset.caminho);
    el.addEventListener('mouseenter', () => desenharCaminho(o.pontos));
    el.addEventListener('mouseleave', () => desenharRotaFixa());
  });
  caixa.querySelector('[data-alt]')?.addEventListener('click', e => {
    e.stopPropagation();
    select(e.currentTarget.dataset.alt, { fly:true });
  });

  state.conexao = null;
  realcarBusca(false);
  // Achamos caminhos com preço confirmado: a coluna "pesquisar no Google" vira
  // ruído — manda a pessoa procurar de novo o que ela acabou de receber pronto.
  // Tirá-la devolve a largura para os dois cards, que é onde a decisão acontece.
  esconderColunaBusca();
  fixarCaminho(r.dest.id, opcoes[0].pontos);
  // Os caminhos chegam segundos depois do clique, quando a barra já abriu na
  // altura do que existia antes. Sem reajustar aqui, a opção recém-encontrada
  // nasce abaixo da dobra — e é justamente a informação que a pessoa esperou.
  ajustarAlturaAoConteudo();
}

const googleTerra = (de, para) => 'https://www.google.com/search?' + new URLSearchParams({
  q: `ônibus ou trem de ${de} para ${para}`, hl:'pt-BR',
});







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
  pedirTarifasReais();
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

  // guarda o lugar pedido com coordenadas: é ele que vale como destino final
  state.destinoAlvo = {
    ...alvo,
    pedido: lugar.city,
    pedidoLat: lugar.lat,
    pedidoLon: lugar.lon,
    kmDoPedido: distancia,
  };
  $('#destino').value = lugar.city;
  $('#destinoList').hidden = true;
  $('#btnLimparDestino').hidden = false;
  $('#destinoHint').innerHTML = distancia > 25
    ? `Não temos voos para ${esc(lugar.city)}. O ponto mais próximo é
       <b>${esc(alvo.city)}</b>, a ${distancia} km.`
    : `Procurando o melhor caminho até <b>${esc(alvo.city)}</b>.`;

  // Leva o mapa até lá e abre o destino. O `state.selected` é definido ANTES
  // da busca: assim o filtro por área já sabe que este destino tem de entrar
  // na lista. Sem isso, a busca rodava com a lista da área anterior, não
  // encontrava o destino e recolhia a barra logo depois de abri-la.
  state.selected = alvo.id;
  state.ignorarMove = true;
  map.setView([alvo.lat, alvo.lon], 6, { animate:false });
  setTimeout(() => {
    search({ refit:false });
    select(alvo.id, { fly:false });
    // garante a abertura: a busca acima é assíncrona por dentro e, dependendo
    // da ordem em que termina, deixava a barra recolhida logo após abri-la
    $('#details').dataset.state = 'open';
    $('#detailsHandle').setAttribute('aria-expanded', 'true');
  }, 120);
}

function limparDestino() {
  state.destinoAlvo = null;
  state.caminho = null;
  clearDetails({ forcar:true });
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

/**
 * Pinta o trecho do trilho à esquerda do polegar.
 *
 * Um `input[type=range]` nativo não sabe fazer isso: o navegador desenha o
 * trilho inteiro de uma cor só. O jeito é um gradiente cujo ponto de virada
 * acompanha o valor — daí a porcentagem precisar vir do JS a cada movimento.
 */
function pintarTrilho(range) {
  const min = +range.min, max = +range.max;
  const pct = max > min ? ((+range.value - min) / (max - min)) * 100 : 0;
  range.style.setProperty('--pct', pct.toFixed(1) + '%');
}

/* ------------------------------------------------------------- datas ---- */
/**
 * Os dois jeitos de dizer quando a viagem é.
 *
 * "Por duração" é o modo de quem ainda está sonhando: sete dias em setembro,
 * qualquer semana serve — e a busca varre o mês inteiro atrás do mais barato.
 * "Por datas" é o de quem já tem as férias marcadas: parte neste dia e volta
 * naquele, e aí não adianta mostrar uma tarifa de outra semana.
 *
 * Os dois alimentam o mesmo par `state.month` / `state.days`, que é o que o
 * motor de cálculo entende. O modo datas acrescenta a janela exata, que vai
 * para o provedor por `RYA.definirDatas`.
 */
function setupQuando() {
  const sel = $('#month');
  MONTHS.forEach((m, i) => sel.appendChild(new Option(m, i, false, i === state.month)));

  const hoje = new Date();
  // a companhia não vende para hoje; três dias de folga é o mínimo realista
  const minIda = new Date(hoje.getTime() + 3 * 864e5).toISOString().slice(0, 10);
  $('#dataIda').min = minIda;
  $('#dataVolta').min = minIda;

  const diasEntre = (a, b) =>
    Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);

  // Recalcula tudo que depende das datas e refaz a busca. `tarifas` diz se as
  // tarifas reais precisam ser buscadas de novo — mudar o mês ou a duração
  // invalida o que está no mapa, mudar só os viajantes não.
  const aplicarQuando = () => {
    if (state.quando === 'datas' && state.dataIda) {
      const ida = state.dataIda;
      let volta = state.dataVolta;
      if (volta && diasEntre(ida, volta) < 1) volta = '';     // volta antes da ida não existe
      state.month = +ida.slice(5, 7) - 1;
      state.days  = volta ? Math.max(1, diasEntre(ida, volta)) : 7;
      RYA.definirDatas(ida, volta);
      $('#datasHint').textContent = volta
        ? `${diasEntre(ida, volta)} ${diasEntre(ida, volta) === 1 ? 'dia' : 'dias'} de viagem. ` +
          'Só entram voos que partem e voltam nesses dias.'
        : 'Volta em aberto: buscamos qualquer retorno até um mês depois da ida.';
    } else {
      RYA.definirDatas(null);
      state.days = clamp(+$('#days').value || 7, 1, 90);
      state.month = +sel.value;
    }
    state.realFares = new Map();       // outra janela, outras tarifas
    state.caminhosPorDestino.clear();  // e outros caminhos
    debouncedSearch();
    pedirTarifasReais(700);
  };

  // alternância entre os dois modos
  $$('[data-quando]').forEach(b => b.addEventListener('click', () => {
    if (state.quando === b.dataset.quando) return;
    $$('[data-quando]').forEach(x => x.classList.toggle('is-active', x === b));
    state.quando = b.dataset.quando;
    $('#blocoDuracao').hidden = state.quando !== 'duracao';
    $('#blocoDatas').hidden   = state.quando !== 'datas';

    // Entrando no modo datas sem nada preenchido, sugerimos a mesma viagem que
    // já estava montada: mesmo mês, mesma duração. Trocar de modo não deve
    // zerar o que a pessoa acabou de escolher.
    if (state.quando === 'datas' && !state.dataIda) {
      const ano = state.month < hoje.getMonth() ? hoje.getFullYear() + 1 : hoje.getFullYear();
      const sugerida = new Date(Date.UTC(ano, state.month, 1));
      const ida = new Date(Math.max(sugerida.getTime(), new Date(minIda + 'T00:00:00Z').getTime()));
      const volta = new Date(ida.getTime() + state.days * 864e5);
      state.dataIda   = ida.toISOString().slice(0, 10);
      state.dataVolta = volta.toISOString().slice(0, 10);
      $('#dataIda').value   = state.dataIda;
      $('#dataVolta').value = state.dataVolta;
    }
    aplicarQuando();
  }));

  sel.addEventListener('change', aplicarQuando);
  $('#days').addEventListener('input', aplicarQuando);

  $('#dataIda').addEventListener('change', e => {
    state.dataIda = e.target.value;
    // a volta nunca pode ser antes da ida
    $('#dataVolta').min = state.dataIda || minIda;
    if (state.dataVolta && state.dataVolta <= state.dataIda) {
      state.dataVolta = '';
      $('#dataVolta').value = '';
    }
    aplicarQuando();
  });
  $('#dataVolta').addEventListener('change', e => {
    state.dataVolta = e.target.value;
    aplicarQuando();
  });
}

/* --------------------------------------------------------- formulário -- */
function setupForm() {
  pintarTrilho($('#budgetRange'));
  setupQuando();

  // orçamento (campo + slider sincronizados)
  const budget = $('#budget'), range = $('#budgetRange');
  const syncBudget = (v, from) => {
    // o campo aceita qualquer valor; a barra só representa até o seu máximo
    state.budget = Math.max(1, Math.round(v));
    if (from !== 'input') budget.value = state.budget;
    if (from !== 'range') range.value = Math.min(+range.max, Math.max(+range.min, state.budget));
    range.classList.toggle('is-beyond', state.budget > +range.max);
    pintarTrilho(range);
  };
  budget.addEventListener('input', () => { syncBudget(+budget.value || 0, 'input'); debouncedSearch(); });
  range.addEventListener('input', () => { syncBudget(+range.value, 'range'); debouncedSearch(); });

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
    pintarTrilho(range);
    $('#rangeMaxLabel').textContent = FX.money(1000, next);
    search({ refit:false });
  }));

  // o que entra na conta: voo + hospedagem, só voo ou só hospedagem
  $$('[data-mode]').forEach(b => b.addEventListener('click', () => {
    $$('[data-mode]').forEach(x => x.classList.toggle('is-active', x === b));
    state.mode = b.dataset.mode;
    search({ refit:false });
  }));

  // botões do mapa: clicar no que já está ligado volta a mostrar tudo
  const alterna = modo => () => {
    state.filtro = state.filtro === modo ? 'todos' : modo;
    pintarFiltros();
    search({ refit:false });
  };
  $('#btnConfirmado').addEventListener('click', alterna('confirmado'));
  $('#btnDireto').addEventListener('click', alterna('direto'));
  $('#btnLimparSelecao').addEventListener('click', limparSelecao);

  // Esc é o gesto que todo mundo já tenta para sair de um estado
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('dialog[open]')) return;   // o diálogo fecha sozinho
    if (state.selected || state.destinoAlvo) limparSelecao();
  });

  // Não há botão de pesquisar: a busca acompanha os campos em tempo real.
  // O submit ainda é interceptado porque Enter num campo dispara o form.
  $('#tripForm').addEventListener('submit', e => e.preventDefault());

  setupDetailsResizer();

  // barra inferior
  $('#detailsHandle').addEventListener('click', () => {
    const d = $('#details');
    const open = d.dataset.state === 'open';

    // No estado de descanso não há o que expandir: a barra já mostra tudo o
    // que existe sem destino escolhido. Quem abre a barra é o clique num
    // destino do mapa, e a alça diz exatamente isso.
    if (!open && !state.selected) return;

    // Recolher a barra com um destino aberto é a mesma intenção de limpar: a
    // pessoa quer o mapa de volta. Deixar a seleção de pé mantinha o arco e os
    // outros destinos escondidos, sem nada na tela explicando por quê.
    if (open && state.selected) return limparSelecao();

    d.dataset.state = open ? 'collapsed' : 'open';
    $('#detailsHandle').setAttribute('aria-expanded', String(!open));
    // a faixa de anúncios só existe com a barra aberta: agora dá para montá-la
    if (!open) setTimeout(() => mountAllAds($('#detailsBody')), 60);
    // recolher devolve altura ao mapa, abrir tira: nos dois casos o trajeto
    // precisa ser reenquadrado no retângulo novo
    setTimeout(reenquadrarSeNecessario, 260);
  });

  // Mudar o tamanho da janela muda o retângulo do mapa pelo mesmo motivo.
  let redimTimer;
  window.addEventListener('resize', () => {
    clearTimeout(redimTimer);
    redimTimer = setTimeout(reenquadrarSeNecessario, 200);
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
/**
 * Abre a barra na altura exata da informação — sem rolagem para ler o essencial.
 *
 * Mede até o fim da grade de conteúdo, e não o `scrollHeight` do corpo todo:
 * o strip de anúncios vem depois e é alto, então incluí-lo fazia a conta
 * estourar o teto e o que sobrava era justamente o conteúdo espremido, com os
 * anúncios ocupando a altura conquistada. Anúncio abaixo da dobra é normal;
 * o preço do voo não pode estar.
 *
 * Uma altura escolhida à mão vira piso, não teto: a pessoa continua mandando
 * no tamanho da barra, mas nunca fica com menos do que a informação precisa.
 */
function ajustarAlturaAoConteudo() {
  const corpo = $('#detailsBody');
  if (!corpo) return;
  // setTimeout e não requestAnimationFrame: rAF fica parado com a aba em
  // segundo plano e a barra nunca se ajustaria.
  setTimeout(() => {
    // Recolhida, o corpo tem altura 0 e a medição vira lixo: o teto sai
    // negativo, cai no mínimo, e a altura guardada do destino aberto se perde —
    // reabrir a barra devolvia 150 px em vez do tamanho que ela tinha.
    if ($('#details').dataset.state !== 'open') return;
    const grade = corpo.querySelector('.dgrid');
    if (!grade) return;
    const base = corpo.getBoundingClientRect().top;
    const fim  = grade.getBoundingClientRect().bottom;
    const estilo = getComputedStyle(corpo);
    const precisa = Math.ceil(fim - base + parseFloat(estilo.paddingBottom || 0));

    let piso = 0;
    try { piso = +localStorage.getItem('ppi.detailsH') || 0; } catch {}

    // O teto sai de uma regra sobre o MAPA, não sobre a barra: o mapa é o
    // produto e tem um tamanho abaixo do qual deixa de servir. Antes o limite
    // era uma fração do corpo da barra e ignorava a alça e o aviso — num
    // monitor de 720 px a barra chegou a 593 px e sobraram 23 px de mapa.
    const barra = $('#details');
    const extras = barra.offsetHeight - corpo.clientHeight;   // alça + aviso + bordas
    const topo = document.querySelector('.topbar')?.offsetHeight || 0;
    const mapaMinimo = Math.max(260, Math.round(window.innerHeight * 0.3));
    const teto = Math.max(ALTURA_MIN, window.innerHeight - topo - mapaMinimo - extras);

    const alvo = Math.max(Math.min(piso, teto), Math.min(precisa + 6, teto));
    if (alvo <= corpo.clientHeight + 4) return;
    aplicarAltura(alvo);
  }, 60);
}

const ALTURA_MIN = 150;
// Arrastando a alça a pessoa manda, mas nem ela deve conseguir apagar o mapa:
// 72% ainda deixa uma faixa navegável.
const alturaMax = () => Math.round(window.innerHeight * 0.72);

function aplicarAltura(px, { salvar = false } = {}) {
  const h = Math.round(Math.min(alturaMax(), Math.max(ALTURA_MIN, px)));
  const antes = getComputedStyle(document.documentElement).getPropertyValue('--details-h');
  document.documentElement.style.setProperty('--details-h', h + 'px');
  if (salvar) { try { localStorage.setItem('ppi.detailsH', h); } catch {} }
  // A barra roubou (ou devolveu) altura do mapa: o trajeto precisa caber no
  // retângulo novo, senão some atrás dos cards.
  if (antes.trim() !== h + 'px') setTimeout(reenquadrarSeNecessario, 40);
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
let searchTimer;
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
