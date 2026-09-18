/* ==========================================================================
   Coleta de tarifas — Aviasales/Travelpayouts, em tempo de publicação
   --------------------------------------------------------------------------
   Por que isto roda AQUI e não no navegador: a API do Travelpayouts não manda
   cabeçalho de CORS, e eles próprios avisam que o token não pode trafegar numa
   requisição de página ("you must make requests to the API from the server").
   Não temos servidor — mas temos a publicação. Este script roda na Action,
   grava JSON no repositório, e o site lê o próprio arquivo: mesma origem, sem
   CORS, sem token exposto, e funciona mesmo se a API estiver fora do ar.

   O que a API devolve é cache de buscas reais feitas no Aviasales nas últimas
   48 h. Não é cotação: é "alguém viu este preço há pouco". Por isso estes
   números entram no site num degrau ABAIXO da Ryanair, que dá tarifa
   confirmada com número de voo e link de compra. A diferença tem de aparecer
   na tela — foi exatamente confundir os dois níveis que já encheu o mapa de
   promessa que não se cumpria.

   O que ela acrescenta: o mundo inteiro e todas as companhias. Hoje quem sai
   do Brasil (ou de qualquer lugar fora da malha da Ryanair) só vê estimativa.
   ======================================================================== */

import { writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESTINATIONS } from '../assets/js/data/destinations.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(RAIZ, 'assets', 'data', 'fares');

/* Dois nomes aceitos para o mesmo segredo. Não é desleixo: é que o nome do
   segredo é escolhido na interface do GitHub, por uma pessoa, e obrigar um
   nome exato só cria uma ida e volta a mais para descobrir que faltava um
   sufixo. O marker não é segredo — ele aparece em toda URL de afiliado —,
   então pode vir de segredo ou de variável, e a coleta funciona sem ele. */
const TOKEN  = process.env.TRAVELPAYOUTS_TOKEN || process.env.TRAVELPAYOUTS || '';
const MARKER = process.env.TRAVELPAYOUTS_MARKER || process.env.MARKER || '';

const API = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';

/* Cem consultas por minuto é o teto que eles publicam para a API de links;
   não achei número para esta, então adotamos o mesmo e com folga. Uma de cada
   vez, sem paralelismo: a coleta tem a madrugada inteira e nada ganha em
   correr. */
const INTERVALO_MS = 700;

const MESES = 6;        // a janela que o site oferece
const POR_MES = 200;    // destinos guardados por mês, do mais barato para cima

/* --------------------------------------------------------------- origens --
   Onde a Ryanair não chega é onde este arquivo faz diferença, então o Brasil
   vem primeiro e completo. Depois os aeroportos de onde as pessoas mais
   procuram na Europa, que servem de rede quando a Ryanair não cobre a data.

   Cada entrada precisa de coordenada: o site escolhe o arquivo pelo aeroporto
   mais próximo de quem está olhando, e não pelo nome da cidade. */
const ORIGENS = [
  // Brasil
  { iata:'GRU', city:'São Paulo',      lat:-23.43, lon:-46.47 },
  { iata:'GIG', city:'Rio de Janeiro', lat:-22.81, lon:-43.25 },
  { iata:'BSB', city:'Brasília',       lat:-15.87, lon:-47.92 },
  { iata:'CNF', city:'Belo Horizonte', lat:-19.62, lon:-43.97 },
  { iata:'CWB', city:'Curitiba',       lat:-25.53, lon:-49.17 },
  { iata:'POA', city:'Porto Alegre',   lat:-29.99, lon:-51.17 },
  { iata:'SSA', city:'Salvador',       lat:-12.91, lon:-38.33 },
  { iata:'REC', city:'Recife',         lat:-8.13,  lon:-34.92 },
  { iata:'FOR', city:'Fortaleza',      lat:-3.78,  lon:-38.53 },
  { iata:'BEL', city:'Belém',          lat:-1.38,  lon:-48.48 },
  { iata:'MAO', city:'Manaus',         lat:-3.04,  lon:-60.05 },
  { iata:'VCP', city:'Campinas',       lat:-23.01, lon:-47.13 },
  { iata:'NAT', city:'Natal',          lat:-5.77,  lon:-35.37 },
  { iata:'MCZ', city:'Maceió',         lat:-9.51,  lon:-35.79 },
  { iata:'VIX', city:'Vitória',        lat:-20.26, lon:-40.29 },
  { iata:'FLN', city:'Florianópolis',  lat:-27.67, lon:-48.55 },
  // América do Sul e Central
  { iata:'EZE', city:'Buenos Aires',   lat:-34.82, lon:-58.54 },
  { iata:'SCL', city:'Santiago',       lat:-33.39, lon:-70.79 },
  { iata:'LIM', city:'Lima',           lat:-12.02, lon:-77.11 },
  { iata:'BOG', city:'Bogotá',         lat:4.70,   lon:-74.15 },
  { iata:'MVD', city:'Montevidéu',     lat:-34.84, lon:-56.03 },
  { iata:'MEX', city:'Cidade do México', lat:19.44, lon:-99.07 },
  // Portugal e Espanha
  { iata:'LIS', city:'Lisboa',         lat:38.77,  lon:-9.13  },
  { iata:'OPO', city:'Porto',          lat:41.24,  lon:-8.68  },
  { iata:'MAD', city:'Madri',          lat:40.49,  lon:-3.57  },
  { iata:'BCN', city:'Barcelona',      lat:41.30,  lon:2.08   },
  // Resto da Europa
  { iata:'CDG', city:'Paris',          lat:49.01,  lon:2.55   },
  { iata:'LON', city:'Londres',        lat:51.47,  lon:-0.45  },
  { iata:'FCO', city:'Roma',           lat:41.80,  lon:12.25  },
  { iata:'MIL', city:'Milão',          lat:45.63,  lon:8.72   },
  { iata:'FRA', city:'Frankfurt',      lat:50.04,  lon:8.56   },
  { iata:'AMS', city:'Amsterdã',       lat:52.31,  lon:4.76   },
  { iata:'BRU', city:'Bruxelas',       lat:50.90,  lon:4.48   },
  { iata:'ZRH', city:'Zurique',        lat:47.46,  lon:8.55   },
  { iata:'VIE', city:'Viena',          lat:48.11,  lon:16.57  },
  { iata:'DUB', city:'Dublin',         lat:53.43,  lon:-6.25  },
  // América do Norte
  { iata:'NYC', city:'Nova York',      lat:40.64,  lon:-73.78 },
  { iata:'MIA', city:'Miami',          lat:25.79,  lon:-80.29 },
  { iata:'YYZ', city:'Toronto',        lat:43.68,  lon:-79.63 },
  // África lusófona, que quase nenhum buscador cobre bem
  { iata:'LAD', city:'Luanda',         lat:-8.86,  lon:13.23  },
  { iata:'MPM', city:'Maputo',         lat:-25.92, lon:32.57  },
];

/* Só guardamos destino que o site conhece: o resto seria peso morto no
   repositório e no navegador de quem acessa. */
const CONHECIDOS = new Set(DESTINATIONS.map(d => d.id.toUpperCase()));

const espera = ms => new Promise(r => setTimeout(r, ms));

/** Os próximos N meses, em YYYY-MM, a partir do mês corrente. */
function proximosMeses(n) {
  const hoje = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/**
 * Tarifas de ida e volta de um aeroporto para todo destino, num mês.
 *
 * `unique=true` com só a origem é o que devolve UM registro por destino, que é
 * exatamente a pergunta do site. Sem ele viriam dezenas de variações da mesma
 * rota e o arquivo ficaria inútil.
 */
async function tarifasDoMes(origem, mes) {
  const qs = new URLSearchParams({
    origin: origem,
    departure_at: mes,
    one_way: 'false',
    unique: 'true',
    sorting: 'price',
    currency: 'eur',
    limit: '1000',
    page: '1',
  });

  const res = await fetch(`${API}?${qs}`, {
    headers: { 'X-Access-Token': TOKEN, 'Accept-Encoding': 'gzip, deflate' },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const corpo = await res.json();
  if (!corpo.success) throw new Error(corpo.error || 'resposta sem sucesso');

  const linhas = [];
  for (const f of corpo.data || []) {
    const destino = String(f.destination || '').toUpperCase();
    if (!CONHECIDOS.has(destino)) continue;
    if (!Number.isFinite(f.price)) continue;

    linhas.push({
      d: destino.toLowerCase(),               // id do destino no site
      p: Math.round(f.price),                 // EUR, ida e volta
      apt: f.destination_airport || null,     // pode diferir do código da cidade
      cia: f.airline || null,
      voo: f.flight_number || null,
      ida: f.departure_at?.slice(0, 10) || null,
      volta: f.return_at?.slice(0, 10) || null,
      esc: f.transfers ?? null,               // escalas na ida
      escv: f.return_transfers ?? null,
      min: f.duration ?? null,                // ida e volta, em minutos
      url: f.link || null,                    // caminho; o marker entra no site
    });
  }

  linhas.sort((a, b) => a.p - b.p);
  return linhas.slice(0, POR_MES);
}

/* ------------------------------------------------------------------ main -- */
if (!TOKEN) {
  console.error('Falta o token: defina TRAVELPAYOUTS_TOKEN (ou TRAVELPAYOUTS) nos segredos.');
  process.exit(1);
}

const meses = proximosMeses(MESES);
console.log(`Coletando ${ORIGENS.length} origens × ${meses.length} meses (${meses[0]} a ${meses.at(-1)})`);

await mkdir(SAIDA, { recursive: true });

const indice = [];
let consultas = 0, falhas = 0;

for (const origem of ORIGENS) {
  const porMes = {};
  let total = 0;

  for (const mes of meses) {
    try {
      const linhas = await tarifasDoMes(origem.iata, mes);
      consultas++;
      if (linhas.length) { porMes[mes] = linhas; total += linhas.length; }
    } catch (err) {
      falhas++;
      // Uma origem que falha não derruba a coleta: o arquivo anterior continua
      // no repositório e o site segue usando o que já tinha.
      console.warn(`  ! ${origem.iata} ${mes}: ${err.message}`);
    }
    await espera(INTERVALO_MS);
  }

  if (!total) { console.log(`  - ${origem.iata}: sem dados, pulando`); continue; }

  await writeFile(
    join(SAIDA, `${origem.iata}.json`),
    JSON.stringify({ origem: origem.iata, atualizado: new Date().toISOString(), meses: porMes }),
  );
  indice.push({ ...origem, ofertas: total });
  console.log(`  ✓ ${origem.iata} ${origem.city}: ${total} ofertas em ${Object.keys(porMes).length} meses`);
}

if (!indice.length) {
  console.error('Nenhuma origem trouxe dados — não vou gravar um índice vazio por cima do bom.');
  process.exit(1);
}

/* Origens que saíram da lista deixam arquivo órfão para trás; limpamos para o
   repositório não acumular tarifa velha que ninguém mais lê. */
const vivos = new Set([...indice.map(o => `${o.iata}.json`), 'index.json']);
for (const nome of await readdir(SAIDA)) {
  if (!vivos.has(nome)) { await unlink(join(SAIDA, nome)); console.log(`  × removido ${nome}`); }
}

await writeFile(
  join(SAIDA, 'index.json'),
  JSON.stringify({
    atualizado: new Date().toISOString(),
    marker: MARKER,
    meses,
    origens: indice,
  }, null, 1),
);

console.log(`\n${indice.length} origens gravadas · ${consultas} consultas · ${falhas} falhas`);
