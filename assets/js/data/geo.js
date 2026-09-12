/* ==========================================================================
   Onde a pessoa está
   --------------------------------------------------------------------------
   Duas formas, em camadas, porque nenhuma é confiável sozinha:

   1) Por IP — instantâneo e sem pedir permissão, mas impreciso: costuma
      apontar a cidade do provedor. Serve para a tela já abrir com algo útil.
   2) Por GPS do navegador — preciso, mas abre um pedido de permissão, demora
      alguns segundos e a pessoa pode recusar. Quando chega, corrige o item 1.

   Nada disso é gravado: a origem só fica salva quando a pessoa escolhe uma
   cidade à mão. Assim quem viaja não fica preso à localização da semana
   passada, e quem escolheu um ponto de partida tem a escolha respeitada.
   ======================================================================== */

/** Provedores de IP que funcionam no navegador (CORS aberto, sem chave). */
const IP_PROVIDERS = [
  { url:'https://get.geojs.io/v1/ip/geo.json',
    parse: j => ({ city:j.city, country:j.country, lat:+j.latitude, lon:+j.longitude }) },
  { url:'https://ipwho.is/',
    parse: j => ({ city:j.city, country:j.country, lat:+j.latitude, lon:+j.longitude }) },
];

const valida = o =>
  o && o.city && Number.isFinite(o.lat) && Number.isFinite(o.lon) ? o : null;

/** Converte coordenadas em nome de cidade (OpenStreetMap). */
async function reverso(lat, lon, signal) {
  const url = 'https://nominatim.openstreetmap.org/reverse?'
    + new URLSearchParams({ format:'jsonv2', lat, lon, zoom:12, 'accept-language':'pt-BR' });
  const res = await fetch(url, { signal, headers:{ Accept:'application/json' } });
  if (!res.ok) throw new Error('reverse ' + res.status);
  const j = await res.json();
  const a = j.address || {};
  // j.name pode trazer o país quando o zoom cai em nível regional: nesse caso
  // é melhor um rótulo genérico do que chamar "Itália" de cidade.
  const nome = a.city || a.town || a.village || a.municipality || a.county
    || (j.name && j.name !== a.country ? j.name : '')
    || 'Sua localização';
  return { city: nome, country: a.country || '', lat, lon };
}

/** Localização aproximada pelo IP. Devolve null se nenhum provedor responder. */
export async function locateByIP(signal) {
  for (const p of IP_PROVIDERS) {
    try {
      const res = await fetch(p.url, { signal });
      if (!res.ok) continue;
      const o = valida(p.parse(await res.json()));
      if (!o) continue;

      // Os serviços de IP respondem em inglês ("Italy") — pedimos ao
      // OpenStreetMap só o nome do PAÍS em português. A cidade continua sendo a
      // do provedor de IP: o reverso em zoom regional devolvia "Itália" no
      // lugar de "Olbia", trocando a cidade pelo país.

      try {
        const pt = await reverso(o.lat, o.lon, signal);
        if (pt?.country) return { ...o, country: pt.country, precisao:'ip' };
      } catch { /* segue com o nome em inglês */ }

      return { ...o, precisao:'ip' };
    } catch { /* tenta o próximo */ }
  }
  return null;
}

/**
 * Localização precisa, via GPS do navegador.
 * @param {number} timeoutMs quanto esperar antes de desistir
 * @returns {Promise<object|null>} null se recusado, indisponível ou demorado
 */
export function locateByGPS(timeoutMs = 12000) {
  if (!navigator.geolocation || !window.isSecureContext) return Promise.resolve(null);

  return new Promise(resolve => {
    let respondido = false;
    const acabou = v => { if (!respondido) { respondido = true; resolve(v); } };

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude:lat, longitude:lon } = pos.coords;
        try {
          const o = await reverso(lat, lon);
          acabou({ ...valida(o), precisao:'gps' });
        } catch {
          // sem nome de cidade ainda dá para calcular: as coordenadas bastam
          acabou({ city:'Sua localização', country:'', lat, lon, precisao:'gps' });
        }
      },
      () => acabou(null),                       // recusado ou indisponível
      { enableHighAccuracy:false, timeout:timeoutMs, maximumAge:10 * 60e3 },
    );

    setTimeout(() => acabou(null), timeoutMs + 500);
  });
}
