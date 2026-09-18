/* ==========================================================================
   Provedor: ESTIMATIVAS (padrão, sem chave de API)
   --------------------------------------------------------------------------
   Gera as opções de voo e hospedagem mostradas na barra inferior a partir do
   modelo de custo. São faixas de preço típicas — nunca cotações reais, e por
   isso nenhuma companhia aérea ou hotel é citado pelo nome.

   Para trocar por dados reais (Amadeus, Travelpayouts, Booking...), veja
   providers/index.js — basta implementar a mesma assinatura.
   ======================================================================== */

import { flightSearch, bookingSearch, googleWeb } from '../links.js?v=48';

const round = n => Math.round(n);

/**
 * Opções de transporte até o destino (ida e volta, por pessoa).
 *
 * Deliberadamente curto. Antes mostrávamos três faixas inventadas
 * ("promocional", "padrão", "melhor horário") que davam ares de cotação a
 * números que eram só a mesma estimativa multiplicada — enchia a tela com
 * informação que não existe. Agora são no máximo três linhas, todas reais
 * no que dizem ser:
 *
 *   1. o voo com preço confirmado, quando existe (Ryanair);
 *   2. uma única estimativa de mercado, marcada como estimativa, que leva a
 *      uma busca no Google;
 *   3. a alternativa terrestre, só quando ela é mesmo mais barata que voar.
 */
export function flightOptions(r, ctx) {
  const out = [];
  const stopsTxt = n => n === 0 ? 'voo direto' : n === 1 ? '1 escala' : `${n} escalas`;

  if (r.useGround && r.groundPP !== null) {
    out.push({
      name: r.km < 350 ? 'Trem ou ônibus' : 'Ônibus/trem de longa distância',
      meta: `${round(r.km)} km · cerca de ${Math.max(1, Math.round(r.km / 75))} h por trecho · estimativa`,
      price: r.groundPP,
      pick: true,
      href: googleWeb(`ônibus ou trem de ${ctx.origin.city} para ${r.dest.city}`),
      hrefNote: 'buscar no Google',
    });
  }

  // Com preço real na mão, a estimativa serve de referência das outras
  // companhias; sem ele, é o número que o site usou na conta.
  const base = r.real ? r.estimatedAirPP : r.airPP;
  out.push({
    estimativa: true,        // o painel esconde esta linha; ver renderDetails
    name: r.real ? 'Outras companhias' : 'Estimativa de mercado',
    meta: `${stopsTxt(r.stops)} · ~${r.hours} h · valor aproximado, não é cotação`,
    price: base,
    pick: !r.useGround && !r.real,
    href: flightSearch(ctx.origin, r.dest, r.month),
    hrefNote: 'pesquisar no Google',
  });

  return out;
}

/** Opções de hospedagem (diária e total do período). */
export function stayOptions(r, ctx) {
  const f = 1 + (r.season - 1) * 0.6;          // mesmo ajuste sazonal do motor
  const labels = [
    { name:'Hostel / quarto compartilhado', meta:'cama em dormitório ou quarto simples, cozinha comum' },
    { name:'Hotel 3★ ou apartamento',        meta:'quarto privativo, bem localizado, café incluso' },
    { name:'Hotel 4★ / apartamento amplo',   meta:'boa localização, serviço completo' },
  ];

  return r.dest.stay.map((base, i) => {
    const nightly = round(base * f);
    const rooms = i === 0 ? r.people : Math.ceil(r.people / 2);
    return {
      ...labels[i],
      price: nightly * rooms * r.nights,
      nightly,
      rooms,
      pick: i === r.style,
      unit: i === 0
        ? `${nightly}/noite por pessoa · ${r.nights} noites`
        : `${nightly}/noite · ${rooms} quarto${rooms > 1 ? 's' : ''} · ${r.nights} noites`,
      href: bookingSearch(r.dest, r.month, r.days, r.people, i),
      hrefNote: 'ver no Booking.com',
    };
  });
}

/**
 * Último trecho por terra, quando o voo deixa a pessoa numa cidade vizinha.
 *
 * Valores de planejamento: ônibus e trem regionais na Europa custam por volta
 * de € 0,085/km e andam a uns 70 km/h de média, contando paradas.
 */
export function groundLeg(km) {
  const minutos = Math.round(km / 70 * 60);
  const tempo = minutos < 60
    ? `${minutos} min`
    : `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`;
  return {
    km,
    modo: km <= 120 ? 'trem ou ônibus' : 'ônibus',
    tempo,
    preco: Math.max(12, Math.round(km * 0.085)) * 2,   // ida e volta
  };
}
