/* ==========================================================================
   Tarifas vistas — Aviasales/Travelpayouts, lidas de arquivo estático
   --------------------------------------------------------------------------
   Estes preços NÃO vêm da rede em tempo de visita. Uma Action colhe da API
   todo dia de madrugada e grava `assets/data/fares/<IATA>.json` no próprio
   repositório; aqui a gente só lê o arquivo. É de propósito: a API deles não
   manda cabeçalho de CORS, e eles próprios avisam que o token não pode
   trafegar numa requisição de página. O efeito colateral é bom — carrega
   instantâneo, não gasta cota de ninguém e continua de pé se a API cair.

   O que estes números SÃO: a tarifa mais barata que alguém viu no Aviasales
   nos últimos dias, para aquele mês e aquela duração de viagem, com companhia,
   número do voo e datas.

   O que eles NÃO SÃO: cotação. Ninguém confirmou que o lugar ainda está lá por
   esse valor. Por isso ficam um degrau abaixo da Ryanair, que responde ao vivo
   e dá link de compra — e a tela precisa dizer isso, porque confundir os dois
   níveis foi exatamente o que já encheu o mapa de promessa que não se cumpria.

   O que eles acrescentam: o mundo inteiro e todas as companhias. Quem sai do
   Brasil, do Chile ou de Angola só via estimativa até aqui.
   ======================================================================== */

import { distanceKm } from '../engine.js?v=71';
import { ligadosPorTerra } from '../data/landmass.js?v=71';

const BASE = 'assets/data/fares/';
const RAIO_KM = 320;          // até onde faz sentido chamar um aeroporto de "o seu"

/* As mesmas faixas que a coleta usa. Precisam casar, senão o site pede uma
   gaveta que ninguém encheu. */
const FAIXAS = [
  { id:'curta',  min:1,  max:4  },
  { id:'semana', min:5,  max:9  },
  { id:'quinze', min:10, max:16 },
  { id:'longa',  min:17, max:60 },
];

export const faixaDe = noites =>
  FAIXAS.find(f => noites >= f.min && noites <= f.max)?.id || null;

/** Rótulo honesto da faixa, para a tela dizer de que viagem é o preço. */
export const nomeDaFaixa = id => ({
  curta:  'até 4 noites',
  semana: '5 a 9 noites',
  quinze: '10 a 16 noites',
  longa:  '17 noites ou mais',
}[id] || '');

let indicePromise = null;
let marker = '';                     // ID de afiliado; público, vem no índice
const arquivos = new Map();          // IATA -> dados já baixados

/** O índice das origens colhidas. Uma requisição, guardada para a sessão. */
function carregarIndice() {
  if (!indicePromise) {
    indicePromise = fetch(BASE + 'index.json')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('index ' + r.status)))
      .then(i => { marker = i?.marker || ''; return i; })
      .catch(() => null);           // sem índice o site segue sem esta camada
  }
  return indicePromise;
}

/**
 * Todas as origens colhidas, da mais perto para a mais longe.
 *
 * Antes isto devolvia UMA — a mais próxima — e era pouco: de Nuoro a mais
 * próxima é Roma, mas a Ryanair também leva a Barcelona, Madri e Milão por
 * trocados, e de lá saem voos intercontinentais que Roma não tem ou tem mais
 * caro. Escolher o hub pela distância é escolher pelo critério errado; quem
 * decide é o preço somado das duas pernas, destino a destino.
 *
 * São 41 aeroportos no mundo, e não a malha inteira: colher todos seria um
 * repositório impraticável. Quem chama é que decide até onde vale olhar.
 */
export async function origensColhidas(ponto) {
  const indice = await carregarIndice();
  if (!indice?.origens?.length || !ponto) return [];

  return indice.origens
    .map(o => ({
      ...o,
      km: Math.round(distanceKm(ponto, o)),
      porTerra: ligadosPorTerra(ponto, o),
    }))
    .sort((a, b) => a.km - b.km);
}

/**
 * A origem colhida mais próxima de um ponto, dentro do raio.
 */
export async function origemMaisProxima(ponto) {
  const indice = await carregarIndice();
  if (!indice?.origens?.length || !ponto) return null;

  const perto = indice.origens
    .map(o => ({ ...o, km: Math.round(distanceKm(ponto, o)) }))
    .filter(o => o.km <= RAIO_KM)
    .sort((a, b) => a.km - b.km);

  if (!perto.length) return null;

  /* Primeiro o que se alcança de carro ou ônibus: quem está em Olbia não "sai
     de Roma" como quem sai de casa — são 270 km com o mar Tirreno no meio.
     Mas cortar a ilha inteira foi longe demais na direção oposta: para ir ao
     Rio, sair de Roma É a resposta realista, e recusá-la deixava a pessoa sem
     resposta nenhuma. Então o de fora do continente entra, marcado — e a tela
     diz de onde o voo parte, para o trajeto até lá não virar surpresa. */
  const porTerra = perto.find(o => ligadosPorTerra(ponto, o));
  return porTerra
    ? { ...porTerra, porTerra: true }
    : { ...perto[0], porTerra: false };
}

/** O arquivo de uma origem, baixado uma vez por sessão. */
async function carregarOrigem(iata) {
  if (arquivos.has(iata)) return arquivos.get(iata);

  const p = fetch(`${BASE}${iata}.json`)
    .then(r => r.ok ? r.json() : Promise.reject(new Error(iata + ' ' + r.status)))
    .catch(() => null);

  arquivos.set(iata, p);
  return p;
}

/**
 * Tarifas vistas para um mês e uma duração, já casadas com os destinos do site.
 *
 * @param {object} ponto  onde a pessoa está
 * @param {number} month  0–11, como no resto do site
 * @param {number} days   dias de viagem pedidos
 * @returns {Promise<{origem:object, faixa:string, tarifas:Map<string,object>}|null>}
 */
export async function tarifasDe(iata, month, days) {
  const dados = await carregarOrigem(iata);
  if (!dados?.meses) return null;

  // O ano é o mesmo critério do resto do site: mês já passado é do ano que vem.
  const hoje = new Date();
  const ano = month < hoje.getMonth() ? hoje.getFullYear() + 1 : hoje.getFullYear();
  const chave = `${ano}-${String(month + 1).padStart(2, '0')}`;

  const doMes = dados.meses[chave];
  if (!doMes?.length) return null;

  const faixa = faixaDe(days);
  const tarifas = new Map();

  /* A faixa pedida manda — mas calar quando ela está vazia é pior que
     responder fora dela. O Rio saindo da Sardenha existe em 16 noites e não em
     7, e o site simplesmente não mostrava: quem procurava ficava sem saber se
     não há voo ou se não há voo NAQUELES dias. São coisas muito diferentes.

     Então a de outra duração entra, marcada, e a tela diz quantas noites são.
     Entre as de fora, ganha a mais próxima do que foi pedido; entre as de
     mesma distância, a mais barata. */
  for (const f of doMes) {
    if (f.d !== f.d) continue;
    const dentro = !faixa || f.f === faixa;
    const anterior = tarifas.get(f.d);

    if (anterior) {
      const anteriorDentro = !anterior.foraDaFaixa;
      if (anteriorDentro && !dentro) continue;               // o de dentro fica
      if (anteriorDentro === dentro) {
        if (dentro) { if (anterior.p <= f.p) continue; }
        else {
          const dA = Math.abs(anterior.n - days), dF = Math.abs(f.n - days);
          if (dA < dF || (dA === dF && anterior.p <= f.p)) continue;
        }
      }
    }
    tarifas.set(f.d, dentro ? f : { ...f, foraDaFaixa: true });
  }

  return { faixa, tarifas, atualizado: dados.atualizado };
}

/**
 * Link para a busca no Aviasales, com o marker de afiliado quando existe.
 *
 * A API devolve `link` como caminho relativo ao site deles, já com a data e a
 * rota dentro — cai direto no resultado, e não numa busca em branco. Sem
 * marker o link continua válido e útil; só não rende comissão.
 *
 * É síncrona porque quem a chama está montando HTML no meio de um render. O
 * marker já foi lido junto com o índice, bem antes de qualquer destino abrir.
 */
export function linkDaOferta(oferta) {
  if (!oferta?.url) return null;
  const url = new URL(oferta.url, 'https://www.aviasales.com');
  if (marker) url.searchParams.set('marker', marker);
  return url.toString();
}

/**
 * As outras durações da MESMA viagem, para o mesmo destino e mês.
 *
 * O site pergunta quantos dias e responde com uma faixa só. Mas a pessoa que
 * pediu uma semana muitas vezes topa cinco noites ou dez — e a diferença de
 * preço entre as faixas costuma ser grande. Isto já estava no arquivo colhido,
 * guardado e nunca mostrado: não custa nenhuma consulta nova.
 */
export async function outrasDuracoes(iata, month, destId, faixaAtual, dias = 7) {
  const dados = await carregarOrigem(iata);
  if (!dados?.meses) return [];

  const hoje = new Date();
  const ano = month < hoje.getMonth() ? hoje.getFullYear() + 1 : hoje.getFullYear();
  const doMes = dados.meses[`${ano}-${String(month + 1).padStart(2, '0')}`];
  if (!doMes?.length) return [];

  const melhores = new Map();
  for (const f of doMes) {
    if (f.d !== destId || f.f === faixaAtual) continue;
    // Quem pediu uma semana pode topar cinco noites ou dez; 43 noites é outra
    // decisão de vida, não uma alternativa. A faixa "longa" vai até sessenta,
    // e sem este corte ela aparecia como se fosse a mesma viagem mais barata.
    if (f.n > dias * 2.5) continue;
    const antes = melhores.get(f.f);
    if (!antes || antes.p > f.p) melhores.set(f.f, f);
  }
  // As mais parecidas com o que foi pedido primeiro, e no máximo duas: a lista
  // é um complemento, não outro cardápio.
  return [...melhores.values()]
    .sort((a, b) => Math.abs(a.n - dias) - Math.abs(b.n - dias))
    .slice(0, 2);
}

/* ------------------------------------------------------ companhias ------ */
/*
   A tela mostrava "W46217" e "TP1019". Quem viaja pouco não lê códigos IATA:
   não dá para julgar um voo sem saber se é da Wizz Air ou da TAP, nem se é
   low cost — o que muda o que está incluído na passagem e o que vai ser
   cobrado à parte no balcão.
*/
let companhias = null;

/** Carrega a lista uma vez por sessão. Falha em silêncio: fica o código. */
export function carregarCompanhias() {
  if (!companhias) {
    companhias = fetch(BASE + 'airlines.json')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('airlines ' + r.status)))
      .catch(() => ({}));
  }
  return companhias;
}

let porCodigo = {};
carregarCompanhias().then(m => { porCodigo = m || {}; });

/** Nome da companhia, ou o próprio código enquanto a lista não chegou. */
export const nomeDaCompanhia = code => porCodigo[code]?.[0] || code || '';

/** A companhia é low cost? Muda o que está incluído na passagem. */
export const ehLowCost = code => porCodigo[code]?.[1] === 1;

/**
 * "Wizz Air 6217" em vez de "W46217".
 *
 * O número do voo vem colado ao código da companhia nas tarifas colhidas, e
 * separado nas da Ryanair; esta função aceita os dois formatos.
 */
export function vooPorExtenso(cia, voo) {
  const codigo = String(cia || '');
  const numero = String(voo || '').replace(new RegExp('^' + codigo), '');
  const nome = nomeDaCompanhia(codigo);
  return numero ? `${nome} ${numero}` : nome;
}

/** Há quanto tempo estes preços foram colhidos, em horas. */
export function idadeEmHoras(atualizado) {
  if (!atualizado) return null;
  return Math.max(0, Math.round((Date.now() - new Date(atualizado)) / 3600e3));
}
