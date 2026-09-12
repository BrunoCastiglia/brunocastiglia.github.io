/* ==========================================================================
   Anúncios (Google AdSense)
   --------------------------------------------------------------------------
   O script do AdSense já está no <head> do index.html, com o ID de publisher
   real. Ele sozinho basta para a revisão do site e para os anúncios
   automáticos, que se ligam no painel do AdSense e não aqui.

   Os blocos MANUAIS (o retângulo da lateral e os três da faixa inferior)
   dependem de IDs de bloco, que só existem depois de você criar cada bloco em
   AdSense → Anúncios → Por unidade de anúncio. Cada bloco criado devolve um
   número de 10 dígitos: é ele que entra em SLOTS.

   Enquanto ENABLED for false, esses quatro espaços aparecem como caixas
   tracejadas — dá para conferir o layout sem servir anúncio nenhum.

   Para ligar os blocos manuais:
   1. crie os quatro blocos no painel do AdSense;
   2. cole os números em SLOTS;
   3. mude ENABLED para true.
   ======================================================================== */

export const ADS = {
  ENABLED: false,
  CLIENT: 'ca-pub-8514640441352876',
  SLOTS: {
    sidebar: '0000000000',   // retângulo 300x250 na barra lateral
    strip1:  '0000000000',   // faixa inferior, bloco 1
    strip2:  '0000000000',   // faixa inferior, bloco 2
    strip3:  '0000000000',   // faixa inferior, bloco 3
  },
};

/* Marca o documento quando há anúncio para valer.
   A barra inferior só fica em estado de descanso — baixa, com a faixa à vista —
   quando existe anúncio a mostrar. Sem isso ela reservaria 110 px de tela para
   exibir caixas vazias a quem visita o site. */
if (ADS.ENABLED) document.documentElement.classList.add('com-anuncios');

/** Monta um bloco de anúncio dentro do elemento indicado. */
export function mountAd(el, slotKey) {
  if (!el || !ADS.ENABLED || !ADS.SLOTS[slotKey]) return;
  if (el.dataset.mounted === '1') return;

  // Nunca montar num espaço invisível.
  //
  // A barra inferior abre recolhida, e `.details-body` fica com display:none.
  // Como os três blocos da faixa vivem lá dentro, eles eram montados e
  // contavam impressão sem ninguém poder vê-los — o AdSense proíbe anúncio em
  // elemento oculto, e isso derruba conta. Quem estiver escondido é montado
  // depois, quando a barra abrir (mountAllAds roda de novo nessa hora).
  if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
  if (!el.getBoundingClientRect().width) return;

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
