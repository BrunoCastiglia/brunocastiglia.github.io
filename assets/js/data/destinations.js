/* ==========================================================================
   Base de destinos
   --------------------------------------------------------------------------
   Todos os valores estão em EUR e representam medianas de planejamento
   (fontes cruzadas: Numbeo, Budget Your Trip, médias de tarifa hoteleira).

   stay  : diária de hospedagem  [hostel/quarto simples, hotel 3★/apto, hotel 4★]

   food  : gasto diário com comida [mercado+comida de rua, restaurante simples, jantar bom]
   local : transporte local + atrações por dia [básico, médio, confortável]
           ^ food e local NÃO entram no cálculo do site: gasto com comida e
             passeios varia demais de pessoa para pessoa e estimá-lo só
             atrapalharia a decisão. Os números ficam aqui como referência,
             caso um dia você queira mostrá-los em algum lugar.
   air   : fator de preço aéreo (1 = rota normal; <1 rota com low cost; >1 rota cara/remota)
   tags  : usados nos filtros de tipo de destino
   ======================================================================== */

export const DESTINATIONS = [
  // ---------------------------------------------------------- Europa Ocidental
  { id:'lis', city:'Lisboa',     country:'Portugal',  cc:'PT', lat:38.72,  lon:-9.14,  region:'EUR-MED', cur:'EUR', air:0.85, stay:[30,78,150],  food:[20,36,70],  local:[8,15,28], tags:['praia','cultura','gastronomia','noite'] },
  { id:'opo', city:'Porto',      country:'Portugal',  cc:'PT', lat:41.15,  lon:-8.61,  region:'EUR-MED', cur:'EUR', air:0.85, stay:[26,68,135],  food:[18,32,62],  local:[7,13,24], tags:['cultura','gastronomia','barato'] },
  { id:'fao', city:'Algarve',    country:'Portugal',  cc:'PT', lat:37.08,  lon:-8.06,  region:'EUR-MED', cur:'EUR', air:0.85, stay:[32,80,170],  food:[20,36,68],  local:[9,16,30], tags:['praia','relax'] },
  { id:'fnc', city:'Madeira (Funchal)', country:'Portugal', cc:'PT', lat:32.66, lon:-16.91, region:'EUR-MED', cur:'EUR', air:0.9, stay:[26,70,140], food:[19,34,66], local:[9,17,32], tags:['natureza','praia','relax','romance'] },
  { id:'mad', city:'Madri',      country:'Espanha',   cc:'ES', lat:40.42,  lon:-3.70,  region:'EUR-MED', cur:'EUR', air:0.88, stay:[32,88,165],  food:[22,40,75],  local:[9,16,30], tags:['cultura','noite','gastronomia'] },
  { id:'bcn', city:'Barcelona',  country:'Espanha',   cc:'ES', lat:41.39,  lon:2.17,   region:'EUR-MED', cur:'EUR', air:0.88, stay:[36,98,185],  food:[24,44,82],  local:[10,17,32], tags:['praia','cultura','noite'] },
  { id:'agp', city:'Málaga',     country:'Espanha',   cc:'ES', lat:36.72,  lon:-4.42,  region:'EUR-MED', cur:'EUR', air:0.85, stay:[30,78,150],  food:[20,37,70],  local:[8,15,28], tags:['praia','relax','gastronomia'] },
  { id:'svq', city:'Sevilha',    country:'Espanha',   cc:'ES', lat:37.39,  lon:-5.98,  region:'EUR-MED', cur:'EUR', air:0.88, stay:[28,74,145],  food:[20,36,68],  local:[8,14,26], tags:['cultura','gastronomia'] },
  { id:'pmi', city:'Palma de Maiorca', country:'Espanha', cc:'ES', lat:39.57, lon:2.65, region:'EUR-MED', cur:'EUR', air:0.9, stay:[38,102,200], food:[24,44,85],  local:[11,19,35], tags:['praia','relax','noite'] },
  { id:'cdg', city:'Paris',      country:'França',    cc:'FR', lat:48.86,  lon:2.35,   region:'EUR-W',   cur:'EUR', air:0.9,  stay:[45,125,255], food:[28,54,110], local:[12,22,42], tags:['cultura','gastronomia','romance'] },
  { id:'nce', city:'Nice',       country:'França',    cc:'FR', lat:43.70,  lon:7.27,   region:'EUR-MED', cur:'EUR', air:0.95, stay:[42,112,225], food:[26,50,98],  local:[11,19,36], tags:['praia','relax','romance'] },
  { id:'lys', city:'Lyon',       country:'França',    cc:'FR', lat:45.76,  lon:4.84,   region:'EUR-W',   cur:'EUR', air:1.0,  stay:[35,95,185],  food:[24,46,92],  local:[10,17,32], tags:['gastronomia','cultura'] },
  { id:'fco', city:'Roma',       country:'Itália',    cc:'IT', lat:41.90,  lon:12.50,  region:'EUR-MED', cur:'EUR', air:0.88, stay:[35,98,195],  food:[24,44,85],  local:[10,18,34], tags:['cultura','gastronomia','romance'] },
  { id:'mil', city:'Milão',      country:'Itália',    cc:'IT', lat:45.46,  lon:9.19,   region:'EUR-W',   cur:'EUR', air:0.88, stay:[38,105,205], food:[25,47,92],  local:[11,19,35], tags:['cultura','compras','gastronomia'] },
  { id:'vce', city:'Veneza',     country:'Itália',    cc:'IT', lat:45.44,  lon:12.33,  region:'EUR-MED', cur:'EUR', air:0.95, stay:[42,120,240], food:[27,50,100], local:[14,24,45], tags:['cultura','romance'] },
  { id:'nap', city:'Nápoles',    country:'Itália',    cc:'IT', lat:40.85,  lon:14.27,  region:'EUR-MED', cur:'EUR', air:0.9,  stay:[28,74,148],  food:[19,35,68],  local:[9,16,30], tags:['gastronomia','cultura','praia','barato'] },
  { id:'flr', city:'Florença',   country:'Itália',    cc:'IT', lat:43.77,  lon:11.26,  region:'EUR-MED', cur:'EUR', air:0.95, stay:[36,100,200], food:[24,45,88],  local:[10,18,34], tags:['cultura','romance','gastronomia'] },
  { id:'cta', city:'Sicília (Catânia)', country:'Itália', cc:'IT', lat:37.50, lon:15.09, region:'EUR-MED', cur:'EUR', air:0.88, stay:[28,72,145], food:[19,35,68], local:[10,18,32], tags:['praia','gastronomia','natureza'] },
  { id:'ath', city:'Atenas',     country:'Grécia',    cc:'GR', lat:37.98,  lon:23.73,  region:'EUR-MED', cur:'EUR', air:0.9,  stay:[26,68,140],  food:[18,33,64],  local:[8,14,27], tags:['cultura','praia','barato'] },
  { id:'jtr', city:'Santorini',  country:'Grécia',    cc:'GR', lat:36.39,  lon:25.46,  region:'EUR-MED', cur:'EUR', air:1.15, stay:[45,135,290], food:[26,50,100], local:[14,25,48], tags:['praia','romance','relax'] },
  { id:'her', city:'Creta',      country:'Grécia',    cc:'GR', lat:35.34,  lon:25.14,  region:'EUR-MED', cur:'EUR', air:0.95, stay:[28,74,155],  food:[19,35,68],  local:[11,19,35], tags:['praia','natureza','relax'] },
  { id:'mla', city:'Malta',      country:'Malta',     cc:'MT', lat:35.90,  lon:14.51,  region:'EUR-MED', cur:'EUR', air:0.95, stay:[28,76,155],  food:[20,37,72],  local:[9,16,30], tags:['praia','cultura','noite'] },
  { id:'ams', city:'Amsterdã',   country:'Países Baixos', cc:'NL', lat:52.37, lon:4.90, region:'EUR-W',  cur:'EUR', air:0.85, stay:[42,125,250], food:[26,50,98],  local:[11,20,38], tags:['cultura','noite'] },
  { id:'bru', city:'Bruxelas',   country:'Bélgica',   cc:'BE', lat:50.85,  lon:4.35,   region:'EUR-W',   cur:'EUR', air:0.9,  stay:[34,92,180],  food:[24,45,88],  local:[10,17,33], tags:['cultura','gastronomia'] },
  { id:'ber', city:'Berlim',     country:'Alemanha',  cc:'DE', lat:52.52,  lon:13.40,  region:'EUR-W',   cur:'EUR', air:0.85, stay:[30,85,165],  food:[21,40,78],  local:[9,16,31], tags:['cultura','noite','barato'] },
  { id:'muc', city:'Munique',    country:'Alemanha',  cc:'DE', lat:48.14,  lon:11.58,  region:'EUR-W',   cur:'EUR', air:0.9,  stay:[36,100,195], food:[24,45,88],  local:[10,18,34], tags:['cultura','natureza','gastronomia'] },
  { id:'ham', city:'Hamburgo',   country:'Alemanha',  cc:'DE', lat:53.55,  lon:9.99,   region:'EUR-W',   cur:'EUR', air:0.9,  stay:[32,90,175],  food:[22,42,82],  local:[9,17,32], tags:['cultura','noite'] },
  { id:'vie', city:'Viena',      country:'Áustria',   cc:'AT', lat:48.21,  lon:16.37,  region:'EUR-W',   cur:'EUR', air:0.9,  stay:[30,86,170],  food:[22,41,80],  local:[9,17,32], tags:['cultura','romance'] },
  { id:'zrh', city:'Zurique',    country:'Suíça',     cc:'CH', lat:47.38,  lon:8.54,   region:'EUR-W',   cur:'CHF', air:1.0,  stay:[62,175,330], food:[38,72,145], local:[16,28,52], tags:['natureza','cultura'] },
  { id:'lon', city:'Londres',    country:'Reino Unido', cc:'GB', lat:51.51, lon:-0.13, region:'EUR-W',   cur:'GBP', air:0.85, stay:[42,135,270], food:[28,55,110], local:[13,24,45], tags:['cultura','compras','noite'] },
  { id:'edi', city:'Edimburgo',  country:'Reino Unido', cc:'GB', lat:55.95, lon:-3.19, region:'EUR-N',   cur:'GBP', air:0.9,  stay:[36,105,205], food:[25,48,95],  local:[10,18,34], tags:['cultura','natureza'] },
  { id:'dub', city:'Dublin',     country:'Irlanda',   cc:'IE', lat:53.35,  lon:-6.26,  region:'EUR-N',   cur:'EUR', air:0.85, stay:[38,115,225], food:[26,50,98],  local:[10,19,35], tags:['cultura','noite','natureza'] },

  // ------------------------------------------------------------------ Nórdicos
  { id:'cph', city:'Copenhague', country:'Dinamarca', cc:'DK', lat:55.68,  lon:12.57,  region:'EUR-N',   cur:'DKK', air:0.9,  stay:[48,140,275], food:[32,62,125], local:[13,23,42], tags:['cultura','gastronomia'] },
  { id:'sto', city:'Estocolmo',  country:'Suécia',    cc:'SE', lat:59.33,  lon:18.07,  region:'EUR-N',   cur:'SEK', air:0.9,  stay:[42,125,245], food:[29,56,112], local:[12,21,40], tags:['cultura','natureza'] },
  { id:'osl', city:'Oslo',       country:'Noruega',   cc:'NO', lat:59.91,  lon:10.75,  region:'EUR-N',   cur:'NOK', air:0.95, stay:[50,145,285], food:[34,66,130], local:[13,24,44], tags:['natureza','cultura'] },
  { id:'hel', city:'Helsinque',  country:'Finlândia', cc:'FI', lat:60.17,  lon:24.94,  region:'EUR-N',   cur:'EUR', air:0.95, stay:[42,120,230], food:[28,54,105], local:[12,21,38], tags:['natureza','cultura'] },
  { id:'kef', city:'Reykjavík',  country:'Islândia',  cc:'IS', lat:64.15,  lon:-21.94, region:'EUR-N',   cur:'ISK', air:1.05, stay:[55,155,300], food:[36,70,140], local:[20,38,70], tags:['natureza','aventura'] },

  // --------------------------------------------------------- Europa Central/Leste
  { id:'prg', city:'Praga',      country:'Chéquia',   cc:'CZ', lat:50.08,  lon:14.44,  region:'EUR-E',   cur:'CZK', air:0.85, stay:[20,58,118],  food:[15,28,55],  local:[7,12,23], tags:['cultura','noite','barato'] },
  { id:'krk', city:'Cracóvia',   country:'Polônia',   cc:'PL', lat:50.06,  lon:19.94,  region:'EUR-E',   cur:'PLN', air:0.8,  stay:[16,48,100],  food:[13,25,48],  local:[6,11,20], tags:['cultura','barato','noite'] },
  { id:'waw', city:'Varsóvia',   country:'Polônia',   cc:'PL', lat:52.23,  lon:21.01,  region:'EUR-E',   cur:'PLN', air:0.8,  stay:[17,52,105],  food:[14,26,52],  local:[6,11,21], tags:['cultura','barato'] },
  { id:'bud', city:'Budapeste',  country:'Hungria',   cc:'HU', lat:47.50,  lon:19.04,  region:'EUR-E',   cur:'HUF', air:0.8,  stay:[18,52,108],  food:[14,26,52],  local:[6,11,21], tags:['cultura','noite','barato','relax'] },
  { id:'otp', city:'Bucareste',  country:'Romênia',   cc:'RO', lat:44.43,  lon:26.10,  region:'EUR-E',   cur:'RON', air:0.8,  stay:[16,46,96],   food:[12,23,46],  local:[5,10,19], tags:['barato','noite','cultura'] },
  { id:'sof', city:'Sofia',      country:'Bulgária',  cc:'BG', lat:42.70,  lon:23.32,  region:'EUR-E',   cur:'BGN', air:0.8,  stay:[15,42,90],   food:[11,21,43],  local:[5,9,18],  tags:['barato','natureza','cultura'] },
  { id:'beg', city:'Belgrado',   country:'Sérvia',    cc:'RS', lat:44.79,  lon:20.45,  region:'EUR-E',   cur:'RSD', air:0.85, stay:[15,44,92],   food:[12,22,45],  local:[5,10,19], tags:['barato','noite','cultura'] },
  { id:'zag', city:'Zagreb',     country:'Croácia',   cc:'HR', lat:45.81,  lon:15.98,  region:'EUR-E',   cur:'EUR', air:0.9,  stay:[20,58,118],  food:[16,30,58],  local:[7,12,23], tags:['cultura','barato'] },
  { id:'spu', city:'Split',      country:'Croácia',   cc:'HR', lat:43.51,  lon:16.44,  region:'EUR-MED', cur:'EUR', air:0.95, stay:[26,72,150],  food:[19,35,68],  local:[9,16,30], tags:['praia','natureza','noite'] },
  { id:'dbv', city:'Dubrovnik',  country:'Croácia',   cc:'HR', lat:42.65,  lon:18.09,  region:'EUR-MED', cur:'EUR', air:1.05, stay:[32,92,190],  food:[22,41,80],  local:[11,19,36], tags:['praia','cultura','romance'] },
  { id:'lju', city:'Liubliana',  country:'Eslovênia', cc:'SI', lat:46.06,  lon:14.51,  region:'EUR-E',   cur:'EUR', air:0.95, stay:[24,66,132],  food:[18,33,64],  local:[7,13,25], tags:['natureza','cultura','barato'] },
  { id:'tia', city:'Tirana',     country:'Albânia',   cc:'AL', lat:41.33,  lon:19.82,  region:'EUR-MED', cur:'ALL', air:0.85, stay:[13,38,82],   food:[10,19,40],  local:[5,9,17],  tags:['barato','praia','natureza'] },
  { id:'sjj', city:'Sarajevo',   country:'Bósnia',    cc:'BA', lat:43.86,  lon:18.41,  region:'EUR-E',   cur:'BAM', air:0.9,  stay:[13,38,80],   food:[10,19,39],  local:[5,9,17],  tags:['barato','cultura','natureza'] },
  { id:'tgd', city:'Kotor',      country:'Montenegro',cc:'ME', lat:42.42,  lon:18.77,  region:'EUR-MED', cur:'EUR', air:0.95, stay:[18,52,110],  food:[14,26,52],  local:[7,12,23], tags:['praia','natureza','barato'] },
  { id:'rix', city:'Riga',       country:'Letônia',   cc:'LV', lat:56.95,  lon:24.11,  region:'EUR-E',   cur:'EUR', air:0.85, stay:[17,50,102],  food:[14,26,52],  local:[6,11,21], tags:['barato','cultura'] },
  { id:'vno', city:'Vilnius',    country:'Lituânia',  cc:'LT', lat:54.69,  lon:25.28,  region:'EUR-E',   cur:'EUR', air:0.85, stay:[17,48,100],  food:[13,25,50],  local:[6,11,20], tags:['barato','cultura'] },
  { id:'tll', city:'Tallinn',    country:'Estônia',   cc:'EE', lat:59.44,  lon:24.75,  region:'EUR-E',   cur:'EUR', air:0.85, stay:[19,55,112],  food:[15,29,56],  local:[6,12,22], tags:['cultura','barato'] },
  { id:'ist', city:'Istambul',   country:'Turquia',   cc:'TR', lat:41.01,  lon:28.98,  region:'EUR-MED', cur:'TRY', air:0.85, stay:[16,46,105],  food:[11,21,45],  local:[5,10,20], tags:['cultura','gastronomia','barato','compras'] },
  { id:'ayt', city:'Antália',    country:'Turquia',   cc:'TR', lat:36.89,  lon:30.71,  region:'EUR-MED', cur:'TRY', air:0.85, stay:[18,52,115],  food:[12,22,46],  local:[6,11,21], tags:['praia','relax','barato'] },
  { id:'nav', city:'Capadócia',  country:'Turquia',   cc:'TR', lat:38.64,  lon:34.83,  region:'EUR-MED', cur:'TRY', air:0.95, stay:[18,55,125],  food:[12,23,47],  local:[9,18,38], tags:['natureza','aventura','romance'] },

  // --------------------------------------------------------- Norte da África / MENA
  { id:'rak', city:'Marraquexe', country:'Marrocos',  cc:'MA', lat:31.63,  lon:-8.01,  region:'MENA',    cur:'MAD', air:0.85, stay:[14,44,105],  food:[10,20,44],  local:[6,12,26], tags:['cultura','barato','aventura','compras'] },
  { id:'fez', city:'Fez',        country:'Marrocos',  cc:'MA', lat:34.04,  lon:-4.99,  region:'MENA',    cur:'MAD', air:0.95, stay:[12,38,92],   food:[9,18,40],   local:[5,11,23], tags:['cultura','barato'] },
  { id:'tng', city:'Tânger',     country:'Marrocos',  cc:'MA', lat:35.78,  lon:-5.81,  region:'MENA',    cur:'MAD', air:0.9,  stay:[13,40,95],   food:[9,18,40],   local:[5,11,22], tags:['praia','cultura','barato'] },
  { id:'cai', city:'Cairo',      country:'Egito',     cc:'EG', lat:30.04,  lon:31.24,  region:'MENA',    cur:'EGP', air:0.95, stay:[11,36,95],   food:[8,16,38],   local:[6,13,28], tags:['cultura','aventura','barato'] },
  { id:'hrg', city:'Hurghada',   country:'Egito',     cc:'EG', lat:27.26,  lon:33.81,  region:'MENA',    cur:'EGP', air:0.95, stay:[14,45,110],  food:[9,18,40],   local:[6,12,25], tags:['praia','relax','barato','aventura'] },
  { id:'tun', city:'Túnis',      country:'Tunísia',   cc:'TN', lat:36.81,  lon:10.18,  region:'MENA',    cur:'TND', air:0.9,  stay:[13,40,90],   food:[9,18,38],   local:[5,10,20], tags:['praia','cultura','barato'] },
  { id:'sid', city:'Ilha do Sal',country:'Cabo Verde',cc:'CV', lat:16.73,  lon:-22.94, region:'AFR',     cur:'CVE', air:1.15, stay:[22,62,140],  food:[15,29,58],  local:[8,15,30], tags:['praia','relax'] },
  { id:'dxb', city:'Dubai',      country:'Emirados',  cc:'AE', lat:25.20,  lon:55.27,  region:'ME',      cur:'AED', air:0.95, stay:[30,92,210],  food:[20,42,95],  local:[10,20,42], tags:['compras','praia','noite'] },
  { id:'auh', city:'Abu Dhabi',  country:'Emirados',  cc:'AE', lat:24.45,  lon:54.38,  region:'ME',      cur:'AED', air:1.0,  stay:[30,88,200],  food:[19,40,90],  local:[10,19,40], tags:['praia','cultura','compras'] },
  { id:'doh', city:'Doha',       country:'Catar',     cc:'QA', lat:25.29,  lon:51.53,  region:'ME',      cur:'QAR', air:1.0,  stay:[32,95,215],  food:[20,42,95],  local:[10,19,40], tags:['cultura','compras'] },
  { id:'amm', city:'Amã',        country:'Jordânia',  cc:'JO', lat:31.95,  lon:35.93,  region:'ME',      cur:'JOD', air:1.05, stay:[18,55,125],  food:[14,27,58],  local:[10,20,40], tags:['cultura','aventura','natureza'] },
  { id:'tbs', city:'Tbilisi',    country:'Geórgia',   cc:'GE', lat:41.72,  lon:44.79,  region:'ASIA-C',  cur:'GEL', air:0.95, stay:[13,40,90],   food:[10,20,42],  local:[5,10,20], tags:['barato','gastronomia','natureza','cultura'] },
  { id:'evn', city:'Ierevan',    country:'Armênia',   cc:'AM', lat:40.18,  lon:44.51,  region:'ASIA-C',  cur:'AMD', air:1.0,  stay:[13,40,88],   food:[10,20,42],  local:[5,10,20], tags:['barato','cultura','natureza'] },
  { id:'ala', city:'Almaty',     country:'Cazaquistão',cc:'KZ',lat:43.24,  lon:76.89,  region:'ASIA-C',  cur:'KZT', air:1.05, stay:[14,42,95],   food:[10,20,42],  local:[5,11,22], tags:['natureza','aventura','barato'] },

  // ----------------------------------------------------------- África Subsaariana
  { id:'cpt', city:'Cidade do Cabo', country:'África do Sul', cc:'ZA', lat:-33.92, lon:18.42, region:'AFR', cur:'ZAR', air:1.0, stay:[16,52,125], food:[13,26,55], local:[9,18,38], tags:['praia','natureza','gastronomia','aventura'] },
  { id:'jnb', city:'Joanesburgo',country:'África do Sul', cc:'ZA', lat:-26.20, lon:28.05, region:'AFR',   cur:'ZAR', air:1.0,  stay:[15,48,115],  food:[12,24,52],  local:[9,18,36], tags:['cultura','aventura'] },
  { id:'nbo', city:'Nairóbi',    country:'Quênia',    cc:'KE', lat:-1.29,  lon:36.82,  region:'AFR',     cur:'KES', air:1.1,  stay:[15,48,115],  food:[11,23,50],  local:[12,26,55], tags:['aventura','natureza'] },
  { id:'znz', city:'Zanzibar',   country:'Tanzânia',  cc:'TZ', lat:-6.16,  lon:39.20,  region:'AFR',     cur:'TZS', air:1.15, stay:[18,58,140],  food:[12,25,54],  local:[8,16,34], tags:['praia','relax','natureza'] },

  // ---------------------------------------------------------- Sudeste Asiático
  { id:'bkk', city:'Bangkok',    country:'Tailândia', cc:'TH', lat:13.76,  lon:100.50, region:'ASIA-SE', cur:'THB', air:1.0,  stay:[10,34,88],   food:[8,17,40],   local:[5,11,24], tags:['barato','gastronomia','noite','cultura','compras'] },
  { id:'cnx', city:'Chiang Mai', country:'Tailândia', cc:'TH', lat:18.79,  lon:98.99,  region:'ASIA-SE', cur:'THB', air:1.05, stay:[8,28,72],    food:[7,14,34],   local:[5,10,22], tags:['barato','natureza','cultura','relax'] },
  { id:'hkt', city:'Phuket',     country:'Tailândia', cc:'TH', lat:7.88,   lon:98.39,  region:'ASIA-SE', cur:'THB', air:1.05, stay:[12,40,105],  food:[9,19,44],   local:[7,14,30], tags:['praia','relax','noite'] },
  { id:'dps', city:'Bali',       country:'Indonésia', cc:'ID', lat:-8.65,  lon:115.22, region:'ASIA-SE', cur:'IDR', air:1.05, stay:[11,36,95],   food:[8,17,40],   local:[6,13,28], tags:['praia','relax','natureza','romance'] },
  { id:'kul', city:'Kuala Lumpur',country:'Malásia',  cc:'MY', lat:3.14,   lon:101.69, region:'ASIA-SE', cur:'MYR', air:1.0,  stay:[10,34,88],   food:[7,15,36],   local:[4,9,20],  tags:['barato','compras','gastronomia'] },
  { id:'sin', city:'Cingapura',  country:'Cingapura', cc:'SG', lat:1.35,   lon:103.82, region:'ASIA-SE', cur:'SGD', air:1.0,  stay:[26,88,190],  food:[15,32,72],  local:[8,16,32], tags:['compras','gastronomia','cultura'] },
  { id:'han', city:'Hanói',      country:'Vietnã',    cc:'VN', lat:21.03,  lon:105.85, region:'ASIA-SE', cur:'VND', air:1.05, stay:[8,28,72],    food:[6,13,32],   local:[5,10,22], tags:['barato','gastronomia','cultura'] },
  { id:'sgn', city:'Ho Chi Minh',country:'Vietnã',    cc:'VN', lat:10.82,  lon:106.63, region:'ASIA-SE', cur:'VND', air:1.05, stay:[8,29,75],    food:[6,13,32],   local:[5,10,22], tags:['barato','gastronomia','noite'] },
  { id:'rep', city:'Siem Reap',  country:'Camboja',   cc:'KH', lat:13.36,  lon:103.86, region:'ASIA-SE', cur:'KHR', air:1.1,  stay:[8,28,72],    food:[7,14,34],   local:[8,16,32], tags:['cultura','barato','aventura'] },
  { id:'mnl', city:'Manila',     country:'Filipinas', cc:'PH', lat:14.60,  lon:120.98, region:'ASIA-SE', cur:'PHP', air:1.1,  stay:[11,34,85],   food:[8,16,38],   local:[6,12,26], tags:['praia','barato','noite'] },
  { id:'mle', city:'Malé',       country:'Maldivas',  cc:'MV', lat:4.18,   lon:73.51,  region:'ASIA-S',  cur:'MVR', air:1.25, stay:[45,160,420], food:[22,48,120], local:[15,30,70], tags:['praia','romance','relax'] },

  // ----------------------------------------------------------------- Ásia Sul/Leste
  { id:'del', city:'Nova Délhi', country:'Índia',     cc:'IN', lat:28.61,  lon:77.21,  region:'ASIA-S',  cur:'INR', air:1.0,  stay:[9,30,80],    food:[6,14,34],   local:[5,11,24], tags:['cultura','barato','gastronomia'] },
  { id:'goi', city:'Goa',        country:'Índia',     cc:'IN', lat:15.30,  lon:74.12,  region:'ASIA-S',  cur:'INR', air:1.05, stay:[10,32,85],   food:[7,15,36],   local:[5,11,24], tags:['praia','relax','barato'] },
  { id:'cmb', city:'Colombo',    country:'Sri Lanka', cc:'LK', lat:6.93,   lon:79.86,  region:'ASIA-S',  cur:'LKR', air:1.1,  stay:[10,32,85],   food:[7,15,36],   local:[6,13,28], tags:['praia','natureza','barato'] },
  { id:'ktm', city:'Katmandu',   country:'Nepal',     cc:'NP', lat:27.72,  lon:85.32,  region:'ASIA-S',  cur:'NPR', air:1.15, stay:[8,26,70],    food:[6,13,32],   local:[6,13,28], tags:['aventura','natureza','barato'] },
  { id:'tyo', city:'Tóquio',     country:'Japão',     cc:'JP', lat:35.68,  lon:139.69, region:'ASIA-E',  cur:'JPY', air:1.05, stay:[24,80,175],  food:[16,34,78],  local:[9,18,36], tags:['cultura','gastronomia','compras','noite'] },
  { id:'osa', city:'Osaka',      country:'Japão',     cc:'JP', lat:34.69,  lon:135.50, region:'ASIA-E',  cur:'JPY', air:1.1,  stay:[22,72,160],  food:[15,32,72],  local:[8,16,33], tags:['gastronomia','cultura'] },
  { id:'sel', city:'Seul',       country:'Coreia do Sul', cc:'KR', lat:37.57, lon:126.98, region:'ASIA-E', cur:'KRW', air:1.05, stay:[20,68,150], food:[14,29,68], local:[7,14,30], tags:['cultura','gastronomia','compras','noite'] },
  { id:'tpe', city:'Taipé',      country:'Taiwan',    cc:'TW', lat:25.03,  lon:121.57, region:'ASIA-E',  cur:'TWD', air:1.1,  stay:[15,52,120],  food:[10,22,52],  local:[6,12,26], tags:['gastronomia','natureza','barato'] },
  { id:'hkg', city:'Hong Kong',  country:'Hong Kong', cc:'HK', lat:22.32,  lon:114.17, region:'ASIA-E',  cur:'HKD', air:1.0,  stay:[22,78,175],  food:[13,28,68],  local:[7,14,30], tags:['compras','gastronomia','cultura'] },
  { id:'pek', city:'Pequim',     country:'China',     cc:'CN', lat:39.90,  lon:116.41, region:'ASIA-E',  cur:'CNY', air:1.0,  stay:[16,55,125],  food:[10,21,50],  local:[6,13,28], tags:['cultura','barato'] },
  { id:'sha', city:'Xangai',     country:'China',     cc:'CN', lat:31.23,  lon:121.47, region:'ASIA-E',  cur:'CNY', air:1.0,  stay:[18,60,140],  food:[11,23,55],  local:[6,13,28], tags:['cultura','compras','noite'] },

  // ------------------------------------------------------------- América do Norte
  { id:'nyc', city:'Nova York',  country:'EUA',       cc:'US', lat:40.71,  lon:-74.01, region:'NAM',     cur:'USD', air:0.9,  stay:[48,155,320], food:[28,58,125], local:[11,22,45], tags:['cultura','compras','noite','gastronomia'] },
  { id:'mia', city:'Miami',      country:'EUA',       cc:'US', lat:25.76,  lon:-80.19, region:'NAM',     cur:'USD', air:0.9,  stay:[38,125,265], food:[25,52,110], local:[12,24,48], tags:['praia','noite','compras'] },
  { id:'lax', city:'Los Angeles',country:'EUA',       cc:'US', lat:34.05,  lon:-118.24,region:'NAM',     cur:'USD', air:0.95, stay:[40,130,270], food:[25,52,112], local:[14,28,55], tags:['praia','cultura','compras'] },
  { id:'sfo', city:'São Francisco',country:'EUA',     cc:'US', lat:37.77,  lon:-122.42,region:'NAM',     cur:'USD', air:0.95, stay:[45,145,300], food:[27,56,120], local:[13,25,50], tags:['cultura','natureza','gastronomia'] },
  { id:'chi', city:'Chicago',    country:'EUA',       cc:'US', lat:41.88,  lon:-87.63, region:'NAM',     cur:'USD', air:0.95, stay:[36,118,245], food:[24,50,105], local:[11,21,42], tags:['cultura','gastronomia','noite'] },
  { id:'yyz', city:'Toronto',    country:'Canadá',    cc:'CA', lat:43.65,  lon:-79.38, region:'NAM',     cur:'CAD', air:0.95, stay:[34,110,225], food:[23,47,98],  local:[11,20,40], tags:['cultura','compras'] },
  { id:'yvr', city:'Vancouver',  country:'Canadá',    cc:'CA', lat:49.28,  lon:-123.12,region:'NAM',     cur:'CAD', air:1.0,  stay:[36,115,235], food:[24,48,100], local:[11,21,42], tags:['natureza','aventura','gastronomia'] },

  // ------------------------------------------------- América Central e Caribe
  { id:'mex', city:'Cidade do México', country:'México', cc:'MX', lat:19.43, lon:-99.13, region:'CAM',  cur:'MXN', air:0.95, stay:[14,48,120],  food:[11,23,52],  local:[6,12,26], tags:['cultura','gastronomia','noite','barato'] },
  { id:'cun', city:'Cancún',     country:'México',    cc:'MX', lat:21.16,  lon:-86.85, region:'CAM',     cur:'MXN', air:0.95, stay:[20,70,175],  food:[14,30,68],  local:[9,18,38], tags:['praia','relax','noite'] },
  { id:'tul', city:'Tulum',      country:'México',    cc:'MX', lat:20.21,  lon:-87.47, region:'CAM',     cur:'MXN', air:1.0,  stay:[22,78,195],  food:[16,34,78],  local:[10,20,42], tags:['praia','relax','natureza','romance'] },
  { id:'hav', city:'Havana',     country:'Cuba',      cc:'CU', lat:23.11,  lon:-82.37, region:'CAR',     cur:'CUP', air:1.1,  stay:[16,48,115],  food:[13,26,55],  local:[8,16,34], tags:['cultura','praia','noite'] },
  { id:'puj', city:'Punta Cana', country:'Rep. Dominicana', cc:'DO', lat:18.58, lon:-68.40, region:'CAR', cur:'DOP', air:1.05, stay:[22,75,180], food:[15,32,70], local:[8,17,36], tags:['praia','relax','noite'] },
  { id:'sju', city:'San Juan',   country:'Porto Rico',cc:'PR', lat:18.47,  lon:-66.11, region:'CAR',     cur:'USD', air:1.05, stay:[26,88,195],  food:[19,40,88],  local:[10,20,40], tags:['praia','cultura','noite'] },
  { id:'gua', city:'Antígua',    country:'Guatemala', cc:'GT', lat:14.56,  lon:-90.73, region:'CAM',     cur:'GTQ', air:1.05, stay:[11,38,95],   food:[9,19,44],   local:[6,13,28], tags:['cultura','natureza','barato','aventura'] },
  { id:'sjo', city:'San José',   country:'Costa Rica',cc:'CR', lat:9.93,   lon:-84.08, region:'CAM',     cur:'CRC', air:1.05, stay:[18,58,140],  food:[14,29,62],  local:[10,20,42], tags:['natureza','aventura','praia'] },

  // ------------------------------------------------------------- América do Sul
  { id:'ctg', city:'Cartagena',  country:'Colômbia',  cc:'CO', lat:10.39,  lon:-75.51, region:'SAM',     cur:'COP', air:1.0,  stay:[13,45,115],  food:[10,21,48],  local:[7,14,30], tags:['praia','cultura','noite'] },
  { id:'bog', city:'Bogotá',     country:'Colômbia',  cc:'CO', lat:4.71,   lon:-74.07, region:'SAM',     cur:'COP', air:0.95, stay:[11,36,92],   food:[8,18,42],   local:[5,11,24], tags:['cultura','barato','gastronomia'] },
  { id:'mde', city:'Medellín',   country:'Colômbia',  cc:'CO', lat:6.24,   lon:-75.57, region:'SAM',     cur:'COP', air:1.0,  stay:[11,38,95],   food:[8,18,42],   local:[5,11,24], tags:['barato','noite','natureza'] },
  { id:'lim', city:'Lima',       country:'Peru',      cc:'PE', lat:-12.05, lon:-77.04, region:'SAM',     cur:'PEN', air:1.0,  stay:[11,38,95],   food:[9,19,48],   local:[6,12,26], tags:['gastronomia','cultura','barato'] },
  { id:'cuz', city:'Cusco',      country:'Peru',      cc:'PE', lat:-13.53, lon:-71.97, region:'SAM',     cur:'PEN', air:1.1,  stay:[10,35,90],   food:[9,18,44],   local:[12,26,55], tags:['cultura','aventura','natureza'] },
  { id:'uio', city:'Quito',      country:'Equador',   cc:'EC', lat:-0.18,  lon:-78.47, region:'SAM',     cur:'USD', air:1.05, stay:[11,36,90],   food:[9,18,42],   local:[6,12,26], tags:['natureza','cultura','barato'] },
  { id:'scl', city:'Santiago',   country:'Chile',     cc:'CL', lat:-33.45, lon:-70.67, region:'SAM',     cur:'CLP', air:1.0,  stay:[15,48,118],  food:[12,25,55],  local:[6,13,27], tags:['natureza','gastronomia','cultura'] },
  { id:'bue', city:'Buenos Aires',country:'Argentina',cc:'AR', lat:-34.60, lon:-58.38, region:'SAM',     cur:'ARS', air:0.95, stay:[13,42,105],  food:[11,23,52],  local:[5,11,23], tags:['cultura','gastronomia','noite','barato'] },
  { id:'brc', city:'Bariloche',  country:'Argentina', cc:'AR', lat:-41.13, lon:-71.31, region:'SAM',     cur:'ARS', air:1.1,  stay:[15,48,120],  food:[12,25,55],  local:[9,19,40], tags:['natureza','aventura','romance'] },
  { id:'mvd', city:'Montevidéu', country:'Uruguai',   cc:'UY', lat:-34.90, lon:-56.16, region:'SAM',     cur:'UYU', air:1.05, stay:[16,50,120],  food:[13,27,58],  local:[6,13,27], tags:['praia','relax','gastronomia'] },
  { id:'rio', city:'Rio de Janeiro',country:'Brasil', cc:'BR', lat:-22.91, lon:-43.17, region:'SAM',     cur:'BRL', air:0.95, stay:[14,48,120],  food:[11,24,55],  local:[6,13,28], tags:['praia','natureza','noite','cultura'] },
  { id:'sao', city:'São Paulo',  country:'Brasil',    cc:'BR', lat:-23.55, lon:-46.63, region:'SAM',     cur:'BRL', air:0.95, stay:[14,46,115],  food:[11,24,58],  local:[6,13,28], tags:['gastronomia','cultura','noite','compras'] },
  { id:'ssa', city:'Salvador',   country:'Brasil',    cc:'BR', lat:-12.97, lon:-38.50, region:'SAM',     cur:'BRL', air:1.0,  stay:[12,40,100],  food:[10,21,48],  local:[6,12,26], tags:['praia','cultura','noite'] },
  { id:'for', city:'Fortaleza',  country:'Brasil',    cc:'BR', lat:-3.73,  lon:-38.52, region:'SAM',     cur:'BRL', air:0.95, stay:[12,40,100],  food:[10,21,48],  local:[6,12,26], tags:['praia','relax','noite'] },
  { id:'rec', city:'Recife',     country:'Brasil',    cc:'BR', lat:-8.05,  lon:-34.88, region:'SAM',     cur:'BRL', air:0.95, stay:[12,40,100],  food:[10,21,48],  local:[6,12,26], tags:['praia','cultura'] },
  { id:'fln', city:'Florianópolis',country:'Brasil',  cc:'BR', lat:-27.60, lon:-48.55, region:'SAM',     cur:'BRL', air:1.0,  stay:[14,46,115],  food:[11,23,52],  local:[7,14,30], tags:['praia','natureza','noite'] },
  { id:'mao', city:'Manaus',     country:'Brasil',    cc:'BR', lat:-3.12,  lon:-60.02, region:'SAM',     cur:'BRL', air:1.1,  stay:[13,42,105],  food:[10,22,50],  local:[12,25,52], tags:['natureza','aventura'] },
  { id:'igu', city:'Foz do Iguaçu',country:'Brasil',  cc:'BR', lat:-25.52, lon:-54.59, region:'SAM',     cur:'BRL', air:1.05, stay:[12,40,100],  food:[10,21,48],  local:[10,20,42], tags:['natureza','aventura'] },
  { id:'asu', city:'Assunção',   country:'Paraguai',  cc:'PY', lat:-25.28, lon:-57.64, region:'SAM',     cur:'PYG', air:1.05, stay:[12,38,92],   food:[9,19,42],   local:[5,10,22], tags:['barato','compras'] },
  { id:'lpb', city:'La Paz',     country:'Bolívia',   cc:'BO', lat:-16.50, lon:-68.15, region:'SAM',     cur:'BOB', air:1.1,  stay:[9,30,78],    food:[7,15,36],   local:[5,11,24], tags:['barato','natureza','aventura'] },

  // ------------------------------------------------------------------- Oceania
  { id:'syd', city:'Sydney',     country:'Austrália', cc:'AU', lat:-33.87, lon:151.21, region:'OCE',     cur:'AUD', air:1.05, stay:[34,110,230], food:[24,48,100], local:[11,21,42], tags:['praia','cultura','natureza'] },
  { id:'mel', city:'Melbourne',  country:'Austrália', cc:'AU', lat:-37.81, lon:144.96, region:'OCE',     cur:'AUD', air:1.05, stay:[32,102,215], food:[23,46,96],  local:[10,20,40], tags:['cultura','gastronomia','noite'] },
  { id:'akl', city:'Auckland',   country:'Nova Zelândia', cc:'NZ', lat:-36.85, lon:174.76, region:'OCE', cur:'NZD', air:1.1,  stay:[30,95,200],  food:[22,44,92],  local:[11,22,44], tags:['natureza','aventura'] },
  { id:'nan', city:'Fiji',       country:'Fiji',      cc:'FJ', lat:-17.75, lon:177.44, region:'OCE',     cur:'FJD', air:1.25, stay:[22,75,190],  food:[16,33,72],  local:[9,18,38], tags:['praia','relax','romance'] },

  // ---------------------------------- Sardenha e outras ilhas do Mediterrâneo
  { id:'cag', city:'Cagliari',   country:'Itália',    cc:'IT', lat:39.22,  lon:9.12,   region:'EUR-MED', cur:'EUR', air:0.88, stay:[24,64,130],  food:[19,34,66],  local:[8,15,28], tags:['praia','cultura','gastronomia'] },
  { id:'olb', city:'Olbia (Costa Smeralda)', country:'Itália', cc:'IT', lat:40.92, lon:9.50, region:'EUR-MED', cur:'EUR', air:0.9, stay:[30,88,210], food:[22,40,85], local:[10,19,38], tags:['praia','relax','romance'] },
  { id:'aho', city:'Alghero',    country:'Itália',    cc:'IT', lat:40.56,  lon:8.32,   region:'EUR-MED', cur:'EUR', air:0.9,  stay:[24,66,138],  food:[19,35,68],  local:[9,16,30], tags:['praia','cultura','natureza'] },
  { id:'pmo', city:'Palermo',    country:'Itália',    cc:'IT', lat:38.12,  lon:13.36,  region:'EUR-MED', cur:'EUR', air:0.88, stay:[22,58,120],  food:[17,32,62],  local:[8,15,28], tags:['cultura','gastronomia','praia','barato'] },

  // ------------------------------------------------- Itália: mais cidades
  { id:'psa', city:'Pisa',       country:'Itália',    cc:'IT', lat:43.72,  lon:10.40,  region:'EUR-MED', cur:'EUR', air:0.85, stay:[26,70,140],  food:[20,37,72],  local:[8,15,28], tags:['cultura','gastronomia'] },
  { id:'blq', city:'Bolonha',    country:'Itália',    cc:'IT', lat:44.49,  lon:11.34,  region:'EUR-MED', cur:'EUR', air:0.85, stay:[28,78,155],  food:[21,40,78],  local:[9,16,30], tags:['gastronomia','cultura'] },
  { id:'trn', city:'Turim',      country:'Itália',    cc:'IT', lat:45.07,  lon:7.69,   region:'EUR-W',   cur:'EUR', air:0.88, stay:[25,68,138],  food:[19,36,70],  local:[8,15,28], tags:['cultura','gastronomia','natureza'] },
  { id:'vrn', city:'Verona',     country:'Itália',    cc:'IT', lat:45.44,  lon:10.99,  region:'EUR-MED', cur:'EUR', air:0.9,  stay:[28,76,152],  food:[21,39,76],  local:[9,16,30], tags:['cultura','romance'] },
  { id:'bri', city:'Bari',       country:'Itália',    cc:'IT', lat:41.12,  lon:16.87,  region:'EUR-MED', cur:'EUR', air:0.88, stay:[22,60,124],  food:[18,33,64],  local:[8,15,28], tags:['praia','gastronomia','cultura'] },

  // --------------------------------------------------- Espanha: mais cidades
  { id:'vlc', city:'Valência',   country:'Espanha',   cc:'ES', lat:39.47,  lon:-0.38,  region:'EUR-MED', cur:'EUR', air:0.85, stay:[26,70,140],  food:[19,36,70],  local:[8,15,28], tags:['praia','gastronomia','cultura'] },
  { id:'alc', city:'Alicante',   country:'Espanha',   cc:'ES', lat:38.35,  lon:-0.48,  region:'EUR-MED', cur:'EUR', air:0.82, stay:[24,64,132],  food:[18,34,66],  local:[8,14,26], tags:['praia','relax','noite'] },
  { id:'ibz', city:'Ibiza',      country:'Espanha',   cc:'ES', lat:38.91,  lon:1.43,   region:'EUR-MED', cur:'EUR', air:0.95, stay:[38,110,240], food:[26,48,95],  local:[12,22,42], tags:['praia','noite','relax'] },
  { id:'bio', city:'Bilbao',     country:'Espanha',   cc:'ES', lat:43.26,  lon:-2.93,  region:'EUR-W',   cur:'EUR', air:0.88, stay:[28,76,150],  food:[22,42,82],  local:[8,15,28], tags:['gastronomia','cultura'] },
  { id:'scq', city:'Santiago de Compostela', country:'Espanha', cc:'ES', lat:42.88, lon:-8.54, region:'EUR-W', cur:'EUR', air:0.88, stay:[24,64,130], food:[19,36,70], local:[7,13,24], tags:['cultura','natureza'] },
  { id:'tfs', city:'Tenerife',   country:'Espanha',   cc:'ES', lat:28.47,  lon:-16.25, region:'EUR-MED', cur:'EUR', air:0.95, stay:[28,78,165],  food:[20,37,72],  local:[10,18,34], tags:['praia','natureza','relax'] },
  { id:'lpa', city:'Gran Canária', country:'Espanha', cc:'ES', lat:27.93,  lon:-15.39, region:'EUR-MED', cur:'EUR', air:0.95, stay:[26,74,158],  food:[20,36,70],  local:[10,18,34], tags:['praia','relax','natureza'] },
  { id:'ace', city:'Lanzarote',  country:'Espanha',   cc:'ES', lat:28.96,  lon:-13.60, region:'EUR-MED', cur:'EUR', air:0.95, stay:[26,74,158],  food:[20,36,70],  local:[10,18,34], tags:['praia','natureza','relax'] },

  // -------------------------------------------------------------- Portugal
  { id:'pdl', city:'Açores (Ponta Delgada)', country:'Portugal', cc:'PT', lat:37.74, lon:-25.67, region:'EUR-MED', cur:'EUR', air:1.0, stay:[24,66,140], food:[19,35,68], local:[11,20,38], tags:['natureza','aventura','relax'] },

  // ---------------------------------------------------------------- França
  { id:'tls', city:'Toulouse',   country:'França',    cc:'FR', lat:43.60,  lon:1.44,   region:'EUR-W',   cur:'EUR', air:0.88, stay:[28,76,150],  food:[22,42,82],  local:[9,16,30], tags:['cultura','gastronomia'] },
  { id:'mrs', city:'Marselha',   country:'França',    cc:'FR', lat:43.30,  lon:5.37,   region:'EUR-MED', cur:'EUR', air:0.88, stay:[28,76,152],  food:[22,42,82],  local:[9,16,30], tags:['praia','cultura','gastronomia'] },
  { id:'bod', city:'Bordeaux',   country:'França',    cc:'FR', lat:44.84,  lon:-0.58,  region:'EUR-W',   cur:'EUR', air:0.9,  stay:[30,82,165],  food:[23,44,88],  local:[9,16,30], tags:['gastronomia','cultura'] },

  // -------------------------------------------------------------- Alemanha
  { id:'cgn', city:'Colônia',    country:'Alemanha',  cc:'DE', lat:50.94,  lon:6.96,   region:'EUR-W',   cur:'EUR', air:0.85, stay:[30,84,165],  food:[22,41,80],  local:[9,16,31], tags:['cultura','noite'] },
  { id:'dus', city:'Düsseldorf', country:'Alemanha',  cc:'DE', lat:51.23,  lon:6.78,   region:'EUR-W',   cur:'EUR', air:0.85, stay:[30,86,170],  food:[22,42,82],  local:[9,17,32], tags:['cultura','compras'] },
  { id:'nue', city:'Nuremberg',  country:'Alemanha',  cc:'DE', lat:49.45,  lon:11.08,  region:'EUR-W',   cur:'EUR', air:0.88, stay:[28,78,155],  food:[21,40,78],  local:[8,15,29], tags:['cultura','gastronomia'] },

  // --------------------------------------------------------------- Polônia
  { id:'gdn', city:'Gdansk',     country:'Polônia',   cc:'PL', lat:54.35,  lon:18.65,  region:'EUR-E',   cur:'PLN', air:0.8,  stay:[16,48,100],  food:[13,25,50],  local:[6,11,20], tags:['praia','cultura','barato'] },
  { id:'wro', city:'Wroclaw',    country:'Polônia',   cc:'PL', lat:51.11,  lon:17.03,  region:'EUR-E',   cur:'PLN', air:0.8,  stay:[15,46,96],   food:[13,24,48],  local:[5,10,19], tags:['cultura','barato','noite'] },
  { id:'poz', city:'Poznan',     country:'Polônia',   cc:'PL', lat:52.41,  lon:16.93,  region:'EUR-E',   cur:'PLN', air:0.8,  stay:[15,44,94],   food:[12,24,47],  local:[5,10,19], tags:['cultura','barato'] },

  // ----------------------------------------------------------------- Grécia
  { id:'skg', city:'Tessalônica',country:'Grécia',    cc:'GR', lat:40.64,  lon:22.94,  region:'EUR-MED', cur:'EUR', air:0.9,  stay:[22,58,120],  food:[17,31,60],  local:[7,13,24], tags:['cultura','gastronomia','noite','barato'] },
  { id:'cfu', city:'Corfu',      country:'Grécia',    cc:'GR', lat:39.62,  lon:19.92,  region:'EUR-MED', cur:'EUR', air:0.95, stay:[26,70,148],  food:[19,35,68],  local:[10,18,34], tags:['praia','natureza','relax'] },
  { id:'rho', city:'Rodes',      country:'Grécia',    cc:'GR', lat:36.44,  lon:28.22,  region:'EUR-MED', cur:'EUR', air:0.98, stay:[26,70,148],  food:[19,35,68],  local:[10,18,34], tags:['praia','cultura','relax'] },
  { id:'kgs', city:'Kos',        country:'Grécia',    cc:'GR', lat:36.89,  lon:27.29,  region:'EUR-MED', cur:'EUR', air:0.98, stay:[24,66,140],  food:[18,34,66],  local:[9,17,32], tags:['praia','relax','noite'] },

  // ------------------------------------------------ Reino Unido e Irlanda
  { id:'man', city:'Manchester', country:'Reino Unido', cc:'GB', lat:53.48, lon:-2.24, region:'EUR-N',  cur:'GBP', air:0.85, stay:[30,88,175],  food:[23,44,88],  local:[9,17,32], tags:['cultura','noite','compras'] },
  { id:'brs', city:'Bristol',    country:'Reino Unido', cc:'GB', lat:51.45, lon:-2.59, region:'EUR-N',  cur:'GBP', air:0.85, stay:[30,86,172],  food:[23,44,88],  local:[9,16,30], tags:['cultura','noite'] },
  { id:'ork', city:'Cork',       country:'Irlanda',   cc:'IE', lat:51.90,  lon:-8.47,  region:'EUR-N',   cur:'EUR', air:0.9,  stay:[32,90,180],  food:[24,46,90],  local:[9,17,32], tags:['cultura','natureza'] },

  // ---------------------------------------------------------------- Romênia
  { id:'clj', city:'Cluj-Napoca',country:'Romênia',   cc:'RO', lat:46.77,  lon:23.59,  region:'EUR-E',   cur:'RON', air:0.8,  stay:[15,44,92],   food:[12,23,46],  local:[5,10,19], tags:['cultura','barato','noite'] },
  { id:'tsr', city:'Timisoara',  country:'Romênia',   cc:'RO', lat:45.75,  lon:21.23,  region:'EUR-E',   cur:'RON', air:0.8,  stay:[14,42,88],   food:[11,22,44],  local:[5,9,18],  tags:['cultura','barato'] },

  // --------------------------------------------------------------- Eslováquia
  { id:'bts', city:'Bratislava', country:'Eslováquia',cc:'SK', lat:48.15,  lon:17.11,  region:'EUR-E',   cur:'EUR', air:0.85, stay:[18,54,112],  food:[15,28,55],  local:[6,12,22], tags:['cultura','barato','noite'] },

  // ===================== lacunas encontradas cruzando a malha da Ryanair =====
  // (aeroportos que a companhia serve e que não tinham destino equivalente)

  // ------------------------------------------------------- ilhas gregas
  { id:'zth', city:'Zakynthos',  country:'Grécia',    cc:'GR', lat:37.75,  lon:20.88,  region:'EUR-MED', cur:'EUR', air:0.98, stay:[24,66,140],  food:[18,34,66],  local:[9,17,32], tags:['praia','natureza','relax'] },
  { id:'efl', city:'Cefalônia',  country:'Grécia',    cc:'GR', lat:38.12,  lon:20.50,  region:'EUR-MED', cur:'EUR', air:1.0,  stay:[24,66,140],  food:[18,34,66],  local:[9,17,32], tags:['praia','natureza','relax'] },
  { id:'jsi', city:'Skiathos',   country:'Grécia',    cc:'GR', lat:39.18,  lon:23.50,  region:'EUR-MED', cur:'EUR', air:1.0,  stay:[26,70,148],  food:[19,35,68],  local:[9,17,32], tags:['praia','relax','noite'] },
  { id:'klx', city:'Kalamata',   country:'Grécia',    cc:'GR', lat:37.07,  lon:22.03,  region:'EUR-MED', cur:'EUR', air:0.95, stay:[22,60,126],  food:[17,32,62],  local:[8,15,28], tags:['praia','cultura','natureza'] },

  // --------------------------------------------------------------- Chipre
  { id:'lca', city:'Larnaca',    country:'Chipre',    cc:'CY', lat:34.92,  lon:33.63,  region:'EUR-MED', cur:'EUR', air:1.0,  stay:[24,66,140],  food:[19,35,70],  local:[9,17,32], tags:['praia','relax','cultura'] },
  { id:'pfo', city:'Pafos',      country:'Chipre',    cc:'CY', lat:34.77,  lon:32.42,  region:'EUR-MED', cur:'EUR', air:1.0,  stay:[24,68,145],  food:[19,35,70],  local:[9,17,32], tags:['praia','cultura','relax'] },

  // ------------------------------------------------------------- Marrocos
  { id:'aga', city:'Agadir',     country:'Marrocos',  cc:'MA', lat:30.43,  lon:-9.60,  region:'MENA',    cur:'MAD', air:0.9,  stay:[14,44,105],  food:[10,20,44],  local:[6,12,25], tags:['praia','relax','barato'] },
  { id:'esu', city:'Essaouira',  country:'Marrocos',  cc:'MA', lat:31.51,  lon:-9.77,  region:'MENA',    cur:'MAD', air:0.95, stay:[13,40,98],   food:[9,19,42],   local:[5,11,23], tags:['praia','cultura','barato','relax'] },
  { id:'rba', city:'Rabat',      country:'Marrocos',  cc:'MA', lat:34.02,  lon:-6.84,  region:'MENA',    cur:'MAD', air:0.9,  stay:[13,40,96],   food:[9,19,42],   local:[5,11,23], tags:['cultura','barato'] },

  // ------------------------------------------------------------- Bulgária
  { id:'boj', city:'Burgas',     country:'Bulgária',  cc:'BG', lat:42.51,  lon:27.47,  region:'EUR-E',   cur:'BGN', air:0.85, stay:[15,44,95],   food:[12,22,45],  local:[5,10,19], tags:['praia','relax','barato'] },
  { id:'var', city:'Varna',      country:'Bulgária',  cc:'BG', lat:43.21,  lon:27.92,  region:'EUR-E',   cur:'BGN', air:0.85, stay:[15,44,95],   food:[12,22,45],  local:[5,10,19], tags:['praia','noite','barato'] },
  { id:'pdv', city:'Plovdiv',    country:'Bulgária',  cc:'BG', lat:42.14,  lon:24.75,  region:'EUR-E',   cur:'BGN', air:0.85, stay:[13,40,88],   food:[11,21,42],  local:[5,9,18],  tags:['cultura','barato','gastronomia'] },

  // --------------------------------------------------------------- Espanha
  { id:'mah', city:'Menorca',    country:'Espanha',   cc:'ES', lat:39.86,  lon:4.22,   region:'EUR-MED', cur:'EUR', air:0.95, stay:[30,84,175],  food:[21,39,76],  local:[10,18,34], tags:['praia','relax','natureza'] },
  { id:'lei', city:'Almería',    country:'Espanha',   cc:'ES', lat:36.84,  lon:-2.46,  region:'EUR-MED', cur:'EUR', air:0.85, stay:[22,60,124],  food:[18,33,64],  local:[7,14,26], tags:['praia','natureza','barato'] },
  { id:'zaz', city:'Zaragoza',   country:'Espanha',   cc:'ES', lat:41.65,  lon:-0.89,  region:'EUR-MED', cur:'EUR', air:0.82, stay:[22,58,120],  food:[18,33,64],  local:[7,13,25], tags:['cultura','gastronomia','barato'] },

  // --------------------------------------------------------------- Croácia
  { id:'puy', city:'Pula',       country:'Croácia',   cc:'HR', lat:44.87,  lon:13.85,  region:'EUR-MED', cur:'EUR', air:0.95, stay:[24,66,136],  food:[18,34,66],  local:[8,15,28], tags:['praia','cultura','natureza'] },

  // ----------------------------------------------------------------- Itália
  { id:'aoi', city:'Ancona',     country:'Itália',    cc:'IT', lat:43.62,  lon:13.51,  region:'EUR-MED', cur:'EUR', air:0.9,  stay:[24,64,132],  food:[19,35,68],  local:[8,15,28], tags:['praia','cultura'] },
  { id:'suf', city:'Calábria (Lamezia)', country:'Itália', cc:'IT', lat:38.91, lon:16.24, region:'EUR-MED', cur:'EUR', air:0.9, stay:[22,58,122], food:[17,32,62], local:[8,15,28], tags:['praia','natureza','barato'] },
  { id:'psr', city:'Pescara',    country:'Itália',    cc:'IT', lat:42.44,  lon:14.18,  region:'EUR-MED', cur:'EUR', air:0.9,  stay:[22,60,126],  food:[18,33,64],  local:[8,15,28], tags:['praia','relax'] },

  // ------------------------------------------------------------ Reino Unido
  { id:'bfs', city:'Belfast',    country:'Reino Unido', cc:'GB', lat:54.60, lon:-5.93, region:'EUR-N',   cur:'GBP', air:0.85, stay:[28,80,160],  food:[22,42,84],  local:[9,16,30], tags:['cultura','natureza'] },
  { id:'ncl', city:'Newcastle',  country:'Reino Unido', cc:'GB', lat:54.98, lon:-1.61, region:'EUR-N',   cur:'GBP', air:0.85, stay:[28,80,160],  food:[22,42,84],  local:[9,16,30], tags:['cultura','noite'] },
  { id:'abz', city:'Aberdeen',   country:'Reino Unido', cc:'GB', lat:57.15, lon:-2.10, region:'EUR-N',   cur:'GBP', air:0.9,  stay:[30,84,168],  food:[23,44,88],  local:[9,17,32], tags:['natureza','cultura'] },

  // ------------------------------------------------------------------ França
  { id:'nte', city:'Nantes',     country:'França',    cc:'FR', lat:47.22,  lon:-1.55,  region:'EUR-W',   cur:'EUR', air:0.88, stay:[28,76,150],  food:[22,42,82],  local:[9,16,30], tags:['cultura','gastronomia'] },
  { id:'pgf', city:'Perpignan',  country:'França',    cc:'FR', lat:42.70,  lon:2.90,   region:'EUR-MED', cur:'EUR', air:0.9,  stay:[26,70,142],  food:[20,38,74],  local:[8,15,28], tags:['praia','natureza'] },
  { id:'lrh', city:'La Rochelle',country:'França',    cc:'FR', lat:46.16,  lon:-1.15,  region:'EUR-W',   cur:'EUR', air:0.92, stay:[28,76,152],  food:[21,40,78],  local:[8,15,28], tags:['praia','cultura','relax'] },

  // ----------------------------------------------------------------- Nórdicos
  { id:'rvn', city:'Rovaniemi (Lapônia)', country:'Finlândia', cc:'FI', lat:66.50, lon:25.73, region:'EUR-N', cur:'EUR', air:1.0, stay:[40,110,225], food:[26,50,98], local:[18,34,62], tags:['natureza','aventura','romance'] },
  { id:'got', city:'Gotemburgo', country:'Suécia',    cc:'SE', lat:57.71,  lon:11.97,  region:'EUR-N',   cur:'SEK', air:0.88, stay:[36,104,205], food:[26,50,100], local:[11,19,36], tags:['cultura','gastronomia'] },
  { id:'aar', city:'Aarhus',     country:'Dinamarca', cc:'DK', lat:56.16,  lon:10.20,  region:'EUR-N',   cur:'DKK', air:0.9,  stay:[40,115,225], food:[28,54,108], local:[11,20,38], tags:['cultura','gastronomia'] },
  { id:'plq', city:'Palanga',    country:'Lituânia',  cc:'LT', lat:55.92,  lon:21.07,  region:'EUR-E',   cur:'EUR', air:0.88, stay:[18,52,108],  food:[14,27,54],  local:[6,11,21], tags:['praia','relax','barato'] },

  // ---------------------------------------------------- Centro e Leste Europeu
  { id:'lnz', city:'Linz',       country:'Áustria',   cc:'AT', lat:48.31,  lon:14.29,  region:'EUR-W',   cur:'EUR', air:0.9,  stay:[26,72,145],  food:[20,38,74],  local:[8,15,28], tags:['cultura','natureza'] },
  { id:'lux', city:'Luxemburgo', country:'Luxemburgo',cc:'LU', lat:49.61,  lon:6.13,   region:'EUR-W',   cur:'EUR', air:0.95, stay:[34,96,190],  food:[25,48,95],  local:[9,17,32], tags:['cultura','natureza'] },
  { id:'ksc', city:'Kosice',     country:'Eslováquia',cc:'SK', lat:48.72,  lon:21.26,  region:'EUR-E',   cur:'EUR', air:0.85, stay:[16,46,98],   food:[13,25,50],  local:[5,10,19], tags:['cultura','barato'] },
  { id:'osr', city:'Ostrava',    country:'Chéquia',   cc:'CZ', lat:49.84,  lon:18.29,  region:'EUR-E',   cur:'CZK', air:0.85, stay:[16,46,98],   food:[13,25,50],  local:[5,10,19], tags:['barato','natureza'] },
  { id:'ias', city:'Iasi',       country:'Romênia',   cc:'RO', lat:47.16,  lon:27.59,  region:'EUR-E',   cur:'RON', air:0.8,  stay:[13,40,86],   food:[11,21,43],  local:[5,9,18],  tags:['cultura','barato'] },
  { id:'luz', city:'Lublin',     country:'Polônia',   cc:'PL', lat:51.25,  lon:22.57,  region:'EUR-E',   cur:'PLN', air:0.8,  stay:[14,42,90],   food:[12,23,46],  local:[5,10,19], tags:['cultura','barato'] },
  { id:'rze', city:'Rzeszow',    country:'Polônia',   cc:'PL', lat:50.04,  lon:22.00,  region:'EUR-E',   cur:'PLN', air:0.8,  stay:[14,42,90],   food:[12,23,46],  local:[5,10,19], tags:['barato','natureza'] },
  { id:'szz', city:'Szczecin',   country:'Polônia',   cc:'PL', lat:53.43,  lon:14.55,  region:'EUR-E',   cur:'PLN', air:0.8,  stay:[15,44,94],   food:[12,24,47],  local:[5,10,19], tags:['cultura','barato'] },
  { id:'ini', city:'Nis',        country:'Sérvia',    cc:'RS', lat:43.32,  lon:21.90,  region:'EUR-E',   cur:'RSD', air:0.85, stay:[13,38,84],   food:[11,21,42],  local:[5,9,17],  tags:['barato','cultura'] },
  { id:'noc', city:'Oeste da Irlanda (Knock)', country:'Irlanda', cc:'IE', lat:53.91, lon:-8.82, region:'EUR-N', cur:'EUR', air:0.92, stay:[28,80,160], food:[22,42,84], local:[9,17,32], tags:['natureza','cultura'] },
];

/* Rótulos dos filtros de tipo de destino */
export const TAG_LABELS = {
  praia:'Praia', natureza:'Natureza', cultura:'Cultura', gastronomia:'Gastronomia',
  noite:'Vida noturna', aventura:'Aventura', relax:'Relax', romance:'Romance',
  compras:'Compras', barato:'Custo baixo',
};
