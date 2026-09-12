/* ==========================================================================
   Links de busca / reserva
   --------------------------------------------------------------------------
   É aqui que entra o dinheiro de afiliado: preencha AFFILIATE com os seus
   identificadores e todo clique passa a ser rastreado.

   Booking.com  -> aid=SEU_ID        (Booking Affiliate Partner Programme)
   Airbnb       -> via Stay22 ou rede de afiliados
   Kiwi.com     -> affilid=SEU_ID    (Travelpayouts / Kiwi Tequila)
   ======================================================================== */

export const AFFILIATE = {
  bookingAid: '',    // ex.: '1234567'
  kiwiAffilid: '',   // ex.: 'praondepossoir'
};

/** Datas plausíveis para o mês escolhido: dia 10 + duração. */
export function tripDates(month, days) {
  const now = new Date();
  let year = now.getFullYear();
  if (month < now.getMonth()) year++;               // mês já passou → ano que vem
  const start = new Date(Date.UTC(year, month, 10));
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + days);
  const iso = d => d.toISOString().slice(0, 10);
  return { checkin: iso(start), checkout: iso(end) };
}

const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ----------------------------------------------------------- buscadores --- */
/*
   Só entram aqui links que abrem a busca DE VERDADE já preenchida — testados
   um a um no navegador:

     Ryanair  ✓ abre o voo exato, com datas e preço
     Booking  ✓ abre os resultados da cidade, com datas e hóspedes
     Airbnb   ✓ com ?query= (a forma /s/Cidade/homes caía na cidade vizinha)

   Ficaram de fora porque NÃO preenchem a busca:
     Google Flights — o parâmetro ?q= deixou de preencher os campos
     Kiwi.com       — a URL de resultados cai na página inicial

   Onde não há link direto, vai uma busca comum no Google: a pessoa chega na
   pesquisa já escrita e é só apertar enter no resultado que quiser.
*/

const q = obj => new URLSearchParams(obj).toString();

const MONTH_NAMES = ['janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro'];

/** Busca comum do Google, já escrita. */
export const googleWeb = termos =>
  'https://www.google.com/search?' + q({ q: termos, hl: 'pt-BR' });

/** Voo: busca no Google normal com origem, destino e mês. */
export function flightSearch(origin, dest, month) {
  return googleWeb(`voos ${origin.city} para ${dest.city} ${dest.country} ${MONTH_NAMES[month]}`);
}

/**
 * Booking.com já filtrado pela faixa escolhida — abre nos resultados.
 * style 0 = hostel · 1 = hotel 3★ · 2 = hotel 4★
 */
export function bookingSearch(dest, month, days, people, style = 1) {
  const { checkin, checkout } = tripDates(month, days);
  const nflt = style === 0 ? 'ht_id=203' : style === 2 ? 'class=4' : 'class=3';
  return 'https://www.booking.com/searchresults.html?' + q({
    ss: `${dest.city}, ${dest.country}`, checkin, checkout,
    group_adults: people, no_rooms: style === 0 ? 1 : Math.ceil(people / 2),
    group_children: 0, selected_currency: 'EUR', nflt,
    ...(AFFILIATE.bookingAid ? { aid: AFFILIATE.bookingAid } : {}),
  });
}

/** Airbnb com cidade, datas e hóspedes preenchidos. */
export function airbnbSearch(dest, month, days, people) {
  const { checkin, checkout } = tripDates(month, days);
  return 'https://www.airbnb.com.br/s/homes?' + q({
    query: `${dest.city}, ${dest.country}`, checkin, checkout, adults: people,
  });
}

/** Links da coluna "Reservar", filtrados por modo em app.js. */
export function bookingLinks(origin, r, month) {
  const d = r.dest, people = r.people, days = r.days;
  return [
    { kind:'flight', href: flightSearch(origin, d, month),
      label:'Pesquisar voos no Google', note:'busca pronta' },
    { kind:'stay',   href: bookingSearch(d, month, days, people, r.style),
      label:'Ver hospedagem', note:'Booking.com' },
    { kind:'stay',   href: airbnbSearch(d, month, days, people),
      label:'Ver apartamentos', note:'Airbnb' },
    { kind:'stay',   href: googleWeb(`hotel em ${d.city} ${d.country} ${MONTH_NAMES[month]}`),
      label:'Pesquisar hospedagem no Google', note:'busca pronta' },
  ];
}
