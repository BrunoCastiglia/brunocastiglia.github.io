/* ==========================================================================
   Origens
   --------------------------------------------------------------------------
   A busca de origem tem duas camadas:
   1) lista local (instantânea) — cidades de partida mais comuns;
   2) Nominatim/OpenStreetMap — qualquer cidade do mundo, sem chave de API.
   ======================================================================== */

import { DESTINATIONS } from './destinations.js?v=60';

/* Cidades que costumam ser origem mas não estão na lista de destinos */
const EXTRA_ORIGINS = [
  { city:'Brasília',      country:'Brasil',        lat:-15.79, lon:-47.88 },
  { city:'Belo Horizonte',country:'Brasil',        lat:-19.92, lon:-43.94 },
  { city:'Curitiba',      country:'Brasil',        lat:-25.43, lon:-49.27 },
  { city:'Porto Alegre',  country:'Brasil',        lat:-30.03, lon:-51.23 },
  { city:'Belém',         country:'Brasil',        lat:-1.46,  lon:-48.50 },
  { city:'Goiânia',       country:'Brasil',        lat:-16.69, lon:-49.26 },
  { city:'Campinas',      country:'Brasil',        lat:-22.91, lon:-47.06 },
  { city:'Natal',         country:'Brasil',        lat:-5.79,  lon:-35.21 },
  { city:'Maceió',        country:'Brasil',        lat:-9.67,  lon:-35.74 },
  { city:'Vitória',       country:'Brasil',        lat:-20.32, lon:-40.34 },
  { city:'Frankfurt',     country:'Alemanha',      lat:50.11,  lon:8.68  },
  { city:'Colônia',       country:'Alemanha',      lat:50.94,  lon:6.96  },
  { city:'Düsseldorf',    country:'Alemanha',      lat:51.23,  lon:6.78  },
  { city:'Stuttgart',     country:'Alemanha',      lat:48.78,  lon:9.18  },
  { city:'Genebra',       country:'Suíça',         lat:46.20,  lon:6.14  },
  { city:'Basileia',      country:'Suíça',         lat:47.56,  lon:7.59  },
  { city:'Toulouse',      country:'França',        lat:43.60,  lon:1.44  },
  { city:'Marselha',      country:'França',        lat:43.30,  lon:5.37  },
  { city:'Bordeaux',      country:'França',        lat:44.84,  lon:-0.58 },
  { city:'Bolonha',       country:'Itália',        lat:44.49,  lon:11.34 },
  { city:'Turim',         country:'Itália',        lat:45.07,  lon:7.69  },
  { city:'Bari',          country:'Itália',        lat:41.12,  lon:16.87 },
  { city:'Bilbao',        country:'Espanha',       lat:43.26,  lon:-2.93 },
  { city:'Alicante',      country:'Espanha',       lat:38.35,  lon:-0.48 },
  { city:'Manchester',    country:'Reino Unido',   lat:53.48,  lon:-2.24 },
  { city:'Glasgow',       country:'Reino Unido',   lat:55.86,  lon:-4.25 },
  { city:'Roterdã',       country:'Países Baixos', lat:51.92,  lon:4.48  },
  { city:'Boston',        country:'EUA',           lat:42.36,  lon:-71.06},
  { city:'Washington',    country:'EUA',           lat:38.91,  lon:-77.04},
  { city:'Houston',       country:'EUA',           lat:29.76,  lon:-95.37},
  { city:'Atlanta',       country:'EUA',           lat:33.75,  lon:-84.39},
  { city:'Seattle',       country:'EUA',           lat:47.61,  lon:-122.33},
  { city:'Montreal',      country:'Canadá',        lat:45.50,  lon:-73.57},
  { city:'Luanda',        country:'Angola',        lat:-8.84,  lon:13.23 },
  { city:'Maputo',        country:'Moçambique',    lat:-25.97, lon:32.57 },
];

/** Lista local de origens: destinos + extras, ordenada alfabeticamente. */
export const LOCAL_ORIGINS = [
  ...DESTINATIONS.map(d => ({ city:d.city, country:d.country, lat:d.lat, lon:d.lon })),
  ...EXTRA_ORIGINS,
].sort((a, b) => a.city.localeCompare(b.city, 'pt-BR'));

/** Remove acentos e caixa para comparar texto digitado. */
export const norm = s =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Busca na lista local (síncrona, instantânea). */
export function searchLocal(query, limit = 6) {
  const q = norm(query);
  if (q.length < 2) return [];
  const starts = [], contains = [];
  for (const o of LOCAL_ORIGINS) {
    const c = norm(o.city);
    if (c.startsWith(q)) starts.push(o);
    else if (c.includes(q) || norm(o.country).startsWith(q)) contains.push(o);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Busca global no OpenStreetMap (Nominatim). Sem chave, uso leve. */
export async function searchRemote(query, signal) {
  const url = 'https://nominatim.openstreetmap.org/search'
    + '?format=jsonv2&addressdetails=1&limit=5&accept-language=pt-BR'
    + '&featureType=city&q=' + encodeURIComponent(query);
  const res = await fetch(url, { signal, headers:{ 'Accept':'application/json' } });
  if (!res.ok) throw new Error('geocoding indisponível');
  const rows = await res.json();
  return rows.map(r => ({
    city: (r.name || r.display_name.split(',')[0] || '').trim(),
    country: r.address?.country || r.display_name.split(',').pop().trim(),
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    remote: true,
  })).filter(o => o.city && Number.isFinite(o.lat));
}
