/* ==========================================================================
   Seletor de provedor de dados
   --------------------------------------------------------------------------
   Hoje só existe o provedor "estimates" (modelo de custo, sem chave).

   COMO PLUGAR PREÇOS REAIS DEPOIS
   -------------------------------
   1. Crie providers/amadeus.js (ou travelpayouts.js, kiwi.js…) exportando:

        export async function flightOptions(r) -> [{ name, meta, price, pick }]
        export async function stayOptions(r)   -> [{ name, meta, price, nightly, unit, pick }]

      `price` sempre em EUR, ida e volta por pessoa (voo) ou total do período
      (hospedagem). `r` é o objeto devolvido por engine.tripCost().

   2. As APIs de voo exigem chave e NÃO podem ser chamadas do navegador (a
      chave ficaria exposta). Suba um proxy mínimo — uma função serverless na
      Vercel/Netlify em /api/flights — que guarda a chave e devolve o JSON.

   3. Troque a linha abaixo para: export * from './amadeus.js?v=64'

   4. Como as funções viram assíncronas, o app já as aguarda com `await`.

   Opções gratuitas/baratas para começar:
     · Travelpayouts (Aviasales) — dados de preço + comissão de afiliado
     · Amadeus Self-Service      — camada gratuita com limite mensal
     · Booking.com / Stay22      — afiliado de hospedagem
   ======================================================================== */

export * from './estimates.js?v=64';
