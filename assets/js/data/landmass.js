/* ==========================================================================
   Onde há estrada e onde há mar
   --------------------------------------------------------------------------
   Distância em linha reta não diz se dá para ir de carro. Pisa fica a 300 km
   de Olbia, mas com o mar Tirreno no meio: recomendar sair de lá para quem
   está na Sardenha é mandar a pessoa pegar uma balsa de sete horas sem avisar.

   Aqui cada ilha relevante da malha aérea tem a sua caixa geográfica. Dois
   pontos só são considerados ligados por terra quando estão na mesma massa —
   a mesma ilha, ou os dois no continente.

   Não é um mapa de estradas: é uma salvaguarda simples contra o erro grosseiro
   de ignorar o mar. Caixas retangulares bastam porque as ilhas aqui estão bem
   separadas umas das outras.
   ======================================================================== */

const ILHAS = [
  ['sardenha',      38.80, 41.35,   8.10,  9.95],
  ['corsega',       41.35, 43.05,   8.50,  9.60],
  ['sicilia',       36.60, 38.40,  12.30, 15.70],
  ['maiorca',       39.20, 39.98,   2.30,  3.50],
  ['menorca',       39.78, 40.12,   3.70,  4.35],
  ['ibiza',         38.60, 39.15,   1.15,  1.68],
  ['creta',         34.75, 35.75,  23.40, 26.40],
  ['rodes',         35.80, 36.50,  27.60, 28.30],
  ['kos',           36.70, 37.00,  26.85, 27.40],
  ['corfu',         39.30, 39.85,  19.60, 20.15],
  ['zakynthos',     37.60, 37.98,  20.55, 21.02],
  ['cefalonia',     38.00, 38.42,  20.30, 20.95],
  ['skiathos',      39.08, 39.28,  23.40, 23.62],
  ['malta',         35.75, 36.12,  14.10, 14.62],
  ['chipre',        34.50, 35.80,  32.20, 34.70],
  ['tenerife',      27.98, 28.65, -16.95, -16.10],
  ['gran-canaria',  27.70, 28.20, -15.88, -15.32],
  ['lanzarote',     28.80, 29.32, -13.92, -13.38],
  ['fuerteventura', 28.00, 28.80, -14.62, -13.78],
  ['madeira',       32.58, 33.00, -17.32, -16.60],
  ['acores',        36.90, 39.80, -31.40, -24.70],
  ['irlanda',       51.35, 55.45, -10.70,  -5.35],   // a ilha inteira, incluindo Belfast
  ['gra-bretanha',  49.85, 58.75,  -6.30,   1.85],
  ['islandia',      63.20, 66.65, -24.70, -13.40],
  ['cabo-verde',    14.75, 17.25, -25.40, -22.60],
  ['zanzibar',      -6.50, -5.70,  39.10, 39.60],
  ['maldivas',       -0.70, 7.20,  72.60, 73.80],
  ['bali',          -8.90, -8.03, 114.40, 115.75],
  ['sri-lanka',      5.85,  9.90,  79.50,  81.95],
  ['fiji',         -18.40,-16.00, 176.80, 180.00],
];

/**
 * Em que massa de terra o ponto está: o nome da ilha, ou 'continente'.
 * @param {{lat:number, lon:number}} p
 */
export function massaDeTerra(p) {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return 'continente';
  for (const [nome, latMin, latMax, lonMin, lonMax] of ILHAS) {
    if (p.lat >= latMin && p.lat <= latMax && p.lon >= lonMin && p.lon <= lonMax) return nome;
  }
  return 'continente';
}

/** Dá para ir de um ponto ao outro por terra (sem balsa nem avião)? */
export function ligadosPorTerra(a, b) {
  return massaDeTerra(a) === massaDeTerra(b);
}
