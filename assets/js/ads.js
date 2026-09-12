/* ==========================================================================
   Anúncios (Google AdSense)
   --------------------------------------------------------------------------
   Enquanto ENABLED for false, os espaços aparecem como caixas tracejadas —
   útil para conferir o layout sem violar as regras do AdSense.

   Para ativar:
   1. Cadastre o site em adsense.google.com e espere a aprovação.
   2. Descomente a tag <script> do AdSense no <head> do index.html.
   3. Preencha CLIENT e os SLOTS abaixo e mude ENABLED para true.
   ======================================================================== */

export const ADS = {
  ENABLED: false,
  CLIENT: 'ca-pub-XXXXXXXXXXXXXXXX',
  SLOTS: {
    sidebar: '0000000000',   // retângulo 300x250 na barra lateral
    strip1:  '0000000000',   // faixa inferior, bloco 1
    strip2:  '0000000000',   // faixa inferior, bloco 2
    strip3:  '0000000000',   // faixa inferior, bloco 3
  },
};

/** Monta um bloco de anúncio dentro do elemento indicado. */
export function mountAd(el, slotKey) {
  if (!el || !ADS.ENABLED || !ADS.SLOTS[slotKey]) return;
  if (el.dataset.mounted === '1') return;
  el.dataset.mounted = '1';
  el.innerHTML = '';

  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.dataset.adClient = ADS.CLIENT;
  ins.dataset.adSlot = ADS.SLOTS[slotKey];
  ins.dataset.adFormat = 'auto';
  ins.dataset.fullWidthResponsive = 'true';
  el.appendChild(ins);

  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
}

/** Ativa todos os espaços marcados com data-ad no documento. */
export function mountAllAds(root = document) {
  root.querySelectorAll('[data-ad]').forEach(el => mountAd(el, el.dataset.ad));
}
