# MoneyToGo

**Para onde seu dinheiro te leva.** Diga quanto tem, de onde sai, por quantos
dias e em que mês — o mapa mostra todos os destinos que cabem nesse dinheiro,
com **preço real de voo** onde ele existe.

🔗 **[Abrir o site](https://brunocastiglia.github.io/moneytogo/)**

![feito com](https://img.shields.io/badge/feito%20com-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-2dd4a7)
![sem build](https://img.shields.io/badge/build-nenhum-lightgrey)
![custo](https://img.shields.io/badge/APIs-todas%20gratuitas-2dd4a7)

---

## O que ele faz

- **Mapa com preços**: cada destino mostra quanto custaria a viagem inteira.
- **Preço real de voo** (Ryanair), com número do voo, horários e link de reserva
  — marcado com ★ dourado. O resto é estimativa, e a tela diz qual é qual.
- **Voo + hospedagem, só voo ou só hospedagem** — comida e passeios ficam de
  fora de propósito: variam demais de pessoa para pessoa.
- **Estilo econômico por padrão** (hostel, voo low cost): o site existe para
  achar viagem barata, e começar por hotel 3★ escondia destinos que cabiam.
  Alghero saindo de Olbia é € 202 no econômico e € 524 no equilibrado.
- **Caminhos alternativos**: voo direto de um aeroporto vizinho, destino vizinho
  com voo direto, ou trajeto com escala pela malha da companhia.
- **Busca pela área do mapa**: arrastou, procurou de novo só no que está à vista.
- Moedas **EUR / USD / BRL** com câmbio do dia.

## Como rodar

Não tem build nem dependências:

```bash
npm run dev      # ou: node serve.mjs
```

Depois abra <http://localhost:4173>.
(É preciso um servidor: o site usa módulos ES, que não funcionam abrindo o
arquivo direto.)

## Publicação

O site é estático e está no GitHub Pages: qualquer `push` na branch `main`
publica sozinho, em poucos minutos.

## Aviso

Este site **não vende passagens nem faz reservas**. Os links abrem o site da
companhia ou um buscador, e a compra acontece lá. Os valores são calculados
automaticamente a partir de dados públicos que mudam a todo momento — servem
para explorar possibilidades, não como garantia de preço ou disponibilidade.

## Licença

Todos os direitos reservados — ver [LICENSE](LICENSE). O repositório é público
para consulta; o código não está licenciado para uso de terceiros.

---

# Documentação técnica

## Para onde a pessoa quer ir

Quando o lugar pedido não tem voo, o site escolhe o **destino conhecido mais
próximo** para calcular o voo — mas o último trecho por terra termina **onde a
pessoa pediu**. Pedindo Pontevedra, o voo é calculado até Santiago de Compostela
(51 km) e o ônibus oferecido é **Porto → Pontevedra**, não Porto → Santiago.

A opção só de avião também diz quantos quilômetros ainda faltam do aeroporto de
chegada até o lugar pedido.


Abaixo do campo de origem há um campo opcional de destino. Ele busca nas 212
cidades da base e, se não achar, no mapa do mundo — e aí **fica com o destino
conhecido mais próximo**, dizendo quantos quilômetros faltam. É o "chegar o mais
perto possível com a informação que temos".

Nomes ambíguos são desambiguados na lista: digitar "Santiago" oferece Santiago
do Chile, Santiago de Compostela e Santiago de Cuba, marcando quais têm voos.

## De onde a pessoa está saindo

O site descobre sozinho, em duas camadas:

1. **Por IP** — instantâneo, sem pedir permissão, mas impreciso (costuma cair na
   cidade do provedor). Serve para a tela já abrir com algo útil.
2. **Por GPS do navegador** — preciso, mas abre um pedido de permissão e demora
   alguns segundos. Quando a resposta chega, corrige a primeira camada.

Nenhuma das duas é gravada. A origem só fica salva quando a pessoa **escolhe uma
cidade à mão** — aí a escolha é respeitada nas próximas visitas e nenhum pedido
de localização aparece. O botão ➤ ao lado do campo esquece a escolha e detecta
de novo.

O GPS exige HTTPS (funciona em `localhost` para desenvolvimento), então em
produção isso só roda com o site publicado num domínio com certificado.

## Rodar localmente

```bash
node serve.mjs
```

Depois abra <http://localhost:4173>.
(É preciso um servidor: o site usa módulos ES, que não funcionam abrindo o arquivo direto.)

## O que é preço real e o que é estimativa

| | De onde vem | Custa algo? |
|---|---|---|
| **Voo** | **Preço real da Ryanair** quando existe rota — com datas e link de reserva | Não |
| Voo (fora da malha Ryanair) | Estimativa: distância × temporada × estilo | Não |
| Hospedagem | Estimativa: diária real da cidade por faixa (hostel / 3★ / 4★) | Não |

O selo **real** no card e a caixa no mapa (“N preços reais de voo saindo de XXX”)
mostram quando o número veio da API de verdade.

### Por que a Ryanair

A Ryanair expõe publicamente a API que alimenta o Fare Finder do site dela, e ela
responde com `Access-Control-Allow-Origin: *`. Ou seja: **o navegador chama direto,
sem chave, sem cadastro e sem servidor no meio**. É a única fonte de preço real de
voo que consegui usar de graça e sem back-end.

**Três aeroportos de partida, não um.** Quem está no interior da Sardenha tem
Olbia, Alghero e Cagliari à volta; considerar só o mais próximo escondia a maior
parte das rotas possíveis. O site usa os **3 aeroportos Ryanair mais próximos**
dentro de 260 km e junta as tarifas dos três, ficando com a mais barata de cada
destino. Saindo de Olbia isso levou os preços confirmados de 10 para **19**.

Cada linha diz de onde o voo parte e a que distância ("parte de AHO, a 107 km de
você"), para a pessoa julgar se compensa o deslocamento — Budapeste, por
exemplo, só aparece porque Alghero entrou na conta.

**Varredura em lotes.** A consulta sem filtro devolve só os 20 destinos mais
baratos, e Cagliari sozinha serve 42 rotas — metade dos destinos diretos ficava
sem preço. Filtrar por país não resolvia: essa consulta também corta em 20.

O que resolve é pedir os destinos pelo nome. O parâmetro é
`arrivalAirportIataCodes` — **no plural**, separado por vírgula; a forma singular
e a repetição do parâmetro devolvem zero ofertas, sem erro. Como a resposta tem
teto de 20 (`limit=50` devolve HTTP 400), o site parte a malha de cada saída em
**lotes de 15** e junta as respostas.

Saindo de Olbia, as rotas das 4 saídas próximas são 50 destinos distintos: saem
em **6 lotes, ~4 segundos**, e o que sobra sem preço são só os que não têm voo
nenhum na janela pedida. A cobertura dos voos diretos vai a **100%** — nenhuma
estrela vazia no mapa.

A tela não espera o fim: cada lote que chega já acende suas estrelas, e um
**radar** sobre a origem mostra que a varredura está correndo (`→` seção
seguinte).

### Orçamento de requisições

A API da Ryanair é pública e gratuita, mas tem limite: durante o desenvolvimento
uma busca de caminhos passava de cem requisições e a companhia passou a
responder **403 em tudo**. A recusa vem sem cabeçalhos de CORS, então o
navegador reporta "erro de origem" — parece outro problema, e é fácil perder
tempo investigando a coisa errada.

O site foi reorganizado em torno de um orçamento:

| Momento | Requisições |
|---|---|
| Abertura (por origem/mês/dias) | **~7** — 1 consulta geral + ~6 lotes de destinos |
| Malha de rotas (1ª vez, cache de 30 dias) | 1 por saída |
| Rede de escalas | em segundo plano, só para o filtro do mapa |
| Navegando o mapa | **0** — a varredura já cobriu tudo |
| Abrir um destino | **2** — confere o par exato, com as datas certas |
| Sem voo direto | ~20 — procura os outros caminhos, guardada por destino |

A varredura em lotes substituiu a varredura por país, que custava 16 requisições
para cobrir 80% dos destinos e voltava a gastar a cada movimento do mapa. Os
lotes custam menos, cobrem tudo e acabam na abertura — navegar o mapa depois
disso não consome nada.

> **A armadilha que causou o bloqueio.** O enquadramento automático do trajeto
> movia o mapa; mover o mapa dispara `moveend`; `moveend` refaz a busca; a busca
> redesenha o painel; o painel reenquadra o trajeto. O ciclo girava a cada
> segundo — a tela piscava e a companhia recebia consultas em rajada.
>
> Duas travas quebram isso: o enquadramento acontece **uma vez por destino**
> (`state.enquadrado`), e movimentos feitos pelo próprio código são marcados com
> uma **janela de tempo** (`state.ignorarMoveAte`) em vez de um booleano — o
> `fitBounds` dispara `moveend` *e* `zoomend`, e o booleano era consumido pelo
> primeiro, deixando o segundo passar.
>
> Ao mexer em qualquer coisa que mova o mapa dentro de um fluxo de render, vale
> medir: abrir um destino deve custar **2 redesenhos do painel**, e depois de
> parado o contador não pode subir.

O que segura isso:

- **Fila**: no máximo 2 requisições ao mesmo tempo, 250 ms entre disparos.
- **Pausa automática**: ao receber 403 ou 429, o site para por 5 minutos,
  descarta a fila e avisa na tela. Insistir é o que transforma um limite
  temporário em bloqueio longo.
- **Lotes**: pedir 15 destinos por consulta em vez de um por vez é o que torna a
  cobertura total barata — 50 destinos em 6 requisições.
- **Atraso curto**: a busca de caminhos espera 700 ms com o destino aberto
  antes de disparar. Passear pelo mapa clicando em vários destinos não consome
  nada; só o que fica aberto é consultado. Um botão para pedir a busca chegou a
  ser testado, mas quem abre um destino quer a resposta, não mais um clique.
- **Cache**: tarifas 12 h, rotas e aeroportos 30 dias, tudo em `localStorage`.

Com a API fora do ar o site continua funcionando: mostra as estimativas e avisa
que os preços reais estão indisponíveis.

### Trajeto com escala pela própria malha

A Ryanair não vende bilhete com conexão, mas a malha permite o caminho: dá para
ir de Olbia a Madri parando em Bologna. Quando o destino aberto não tem voo
direto, o site monta esse trajeto e mostra as duas pernas com preço e data.

O truque que evita varrer a malha inteira (224 aeroportos): em vez de perguntar
"para onde cada aeroporto voa?", pedimos as rotas da **origem** e as do
**destino** e cruzamos as duas listas. A interseção já são todas as escalas
possíveis — com duas consultas. De Olbia para Madri são 9 escalas viáveis; o
site testa as 3 de menor desvio geográfico e fica com a mais barata.

As duas pernas são buscadas **em sequência, não em paralelo**: a segunda só pode
partir depois que a primeira chega. Duas armadilhas apareceram aqui:

1. Buscando as duas ao mesmo tempo, cada uma escolhia o dia mais barato por
   conta própria e a conexão saía *antes* da ida.
2. Filtrando pela data de **partida** da primeira perna, um voo que sai às 23:55
   e chega 01:10 do dia seguinte ainda deixava passar conexões impossíveis —
   deu uma espera de **-440 min**. O filtro correto é a hora de **chegada**,
   com 2 h de folga (são bilhetes separados, bagagem e check-in refeitos).

**Ida e volta, quatro trechos.** O trajeto mostra as duas pernas da ida e as
duas da volta, com o total somado. Cada trecho é um **link que abre a reserva
daquele voo** no site da Ryanair — são bilhetes separados, então não há como
comprar tudo de uma vez.

**Três janelas de tempo guardam a coerência do trajeto**, e cada uma nasceu de
um erro real que apareceu testando:

| Regra | O que ela evita |
|---|---|
| Segunda perna em janelas crescentes: 12 h, depois 48 h, depois 7 dias | "12 dias de espera" anunciado como escala curta |
| Filtro pela hora de **chegada**, não de partida | conexão saindo antes de o passageiro pousar (-440 min) |
| Volta dentro da duração pedida (+3 dias) | uma viagem de 7 dias virar uma de 14 |

Quando a rota é pouco frequente e não existe volta na janela justa, o site
amplia a busca e **avisa**: "não há volta por esta rota nos 7 dias pedidos: a
opção encontrada deixa 16 dias fora". O cabeçalho mostra sempre quantos dias
fora o trajeto representa.

A espera é contada da chegada de uma perna à partida da outra e mostrada em
horas. Passando de 6 h, ela aparece destacada e o texto avisa que pode significar
uma noite fora — contar só a diferença de datas escondia esperas de 20 h dizendo
"no mesmo dia". Entre trajetos de preço parecido, o site prefere o de espera
mais curta.

A tela deixa claro que são **dois bilhetes separados** e que a conexão não é
garantida pela companhia — perdeu o segundo voo, perdeu o dinheiro. No mapa o
arco passa pela escala em vez de ir direto.

### Outras companhias: procurei e não achei

Testei, um por um, os endpoints que essas companhias usam no próprio site:

| Companhia | Resultado |
|---|---|
| Wizz Air | 404 |
| Transavia | 401 — exige chave |
| Vueling | 404 |
| Volotea | 404 |
| Norwegian | 403 |
| easyJet | 403 |

A Ryanair segue sendo a única com API pública, sem chave e com
`Access-Control-Allow-Origin: *`. As demais ou pedem credencial (Transavia dá
chave grátis no portal, mas exigiria um proxy) ou bloqueiam a chamada.

Por isso o ganho de variedade veio da varredura por país, e não de uma segunda
companhia.

Limites honestos:

- só voos Ryanair — Europa, Marrocos, Turquia, Jordânia e Israel;
- quem sai do Brasil continua vendo estimativa (o site avisa na caixa do mapa);
- a API devolve os **20 destinos mais baratos** por consulta (o parâmetro
  `offset` é ignorado) — que por sorte é exatamente a pergunta deste site;
- é API não documentada: pode mudar sem aviso. Por isso toda falha é silenciosa
  e o site volta sozinho para a estimativa.

O código fica em `assets/js/providers/ryanair.js`. Respostas ficam em cache por
6 h e a lista de aeroportos por 7 dias, no `localStorage`.

### Por que não tem preço real de hotel

Não existe API gratuita de preço de hospedagem. Booking.com e Expedia exigem
parceria aprovada; o Hotellook, que já teve endpoint aberto, foi desativado
(hoje responde 404). A hospedagem, portanto, é estimativa — e os links de
Booking e Airbnb já vão com cidade, datas e número de hóspedes preenchidos.

## O mapa é gratuito mesmo?

Sim: **tiles raster do OpenStreetMap**, sem chave. Um filtro CSS aplicado só em
`.leaflet-tile-pane` tira parte da saturação (os marcadores ficam em painel
irmão e não são afetados), para que as pílulas coloridas de preço sejam a única
coisa saturada na tela — o mapa é o pano de fundo, o preço é o dado.

Chegamos a usar o **OpenFreeMap** (vetorial, gratuito e sem
limite) através do plugin `maplibre-gl-leaflet`. Ficava mais bonito, mas o plugin
desenha o basemap num canvas maior que o container e, ao arrastar ou dar zoom
out, o mapa saía do lugar em relação aos marcadores — cidades europeias
apareciam no meio do oceano. Um mapa bonito que mostra a cidade errada é pior
que um mapa simples, então voltamos ao raster.

Para conferir o alinhamento depois de mexer no mapa, compare no console:

```js
PPI.map.latLngToContainerPoint([38.72, -9.14])   // onde o Leaflet acha que é
// com a posição real do pino no DOM — o desvio tem de ser 0 px
```

Se um dia quiser o vetorial de volta, o caminho é usar MapLibre puro e desenhar
os marcadores nele (não misturar as duas bibliotecas).

Para tráfego alto, troque a linha `L.tileLayer(...)` em `assets/js/app.js` por um
provedor com plano próprio — a política do OSM não cobre volume.

## Estrutura

```
index.html                     layout: topo · lateral esquerda · mapa · barra inferior
assets/css/style.css           tema claro, responsivo
assets/js/app.js               controlador (formulário, mapa, lista, detalhes)
assets/js/engine.js            MOTOR DE CUSTO — distância, sazonalidade, preço do voo
assets/js/fx.js                câmbio EUR/USD/BRL + moeda local do destino
assets/js/links.js             links de busca e afiliado (Booking, Kiwi, Airbnb…)
assets/js/ads.js               espaços publicitários (Google AdSense)
assets/js/data/destinations.js 212 cidades com preço de hospedagem por faixa
assets/js/data/origins.js      origens locais + busca mundial via OpenStreetMap
assets/js/providers/ryanair.js preços reais de voo (grátis, sem chave)
assets/js/providers/estimates.js  modelo de estimativa (quando não há preço real)
```

## Como o motor foi calibrado

A curva de preço aéreo foi conferida contra os preços reais da Ryanair saindo de
Lisboa. A primeira versão errava feio em rotas curtas europeias (Lisboa–Madri saía
pelo dobro), porque a concorrência low cost derruba o preço nessas rotas. Com o
ajuste `lowCostFactor` (em `engine.js`), o erro absoluto médio caiu de ~45% para
**25%** — bom o bastante para escolher destino, e onde há Ryanair o número real
substitui a estimativa de qualquer forma.

Para refazer essa conferência depois de mexer no modelo, compare
`flightPriceEUR()` com o que a API devolve para o mesmo mês.

## Cada linha da tela é clicável

Nada é beco sem saída: clicar em qualquer opção abre a busca **já preenchida**.
Testei um por um no navegador — só ficou o que realmente abre com a pesquisa
pronta:

| Onde a pessoa clica | Para onde vai | Testado |
|---|---|---|
| Voo com preço real | O voo exato no site da Ryanair, com datas e preço | ✅ abre pronto |
| Tarifa estimada | Busca no Google: "voos ORIGEM para DESTINO MÊS" | ✅ |
| Rota terrestre | Busca no Google por ônibus/trem no trecho | ✅ |
| Hostel / 3★ / 4★ | Booking, na cidade, com datas, hóspedes e filtro da estrela | ✅ abre nos resultados |
| Ver apartamentos | Airbnb, na cidade, com datas e hóspedes | ✅ abre nos resultados |

**O que tirei, e por quê:**

- **Google Flights** — o parâmetro `?q=` deixou de preencher os campos: abria a
  home com a origem solta e o destino em branco. Pior que uma busca comum.
- **Kiwi.com** — a URL de resultados redireciona para a página inicial e perde
  origem, destino e datas.

Em ambos os casos a pessoa teria de redigitar tudo, que é exatamente o trabalho
que este site existe para poupar. Onde não há link direto confiável, vai uma
busca comum no Google, já escrita.

Detalhe do Airbnb: a forma `/s/Cidade/homes` abria a **cidade vizinha**
(Barcelona virava Girona). O certo é `/s/homes?query=Cidade`.

## Só duas linhas de voo, e as duas verdadeiras

O painel já mostrou três faixas de tarifa ("promocional", "padrão", "melhor
horário"). Era a mesma estimativa multiplicada por 0,82 / 1 / 1,3 — parecia
cotação e não era. Enchia a tela com informação que não existe.

Hoje são no máximo três linhas, cada uma honesta sobre o que é:

1. **o voo com preço confirmado** (Ryanair), com datas e link de reserva;
2. **uma única estimativa**, dita com todas as letras ("valor aproximado, não é
   cotação"), levando a uma busca no Google;
3. **a alternativa terrestre**, e só quando ela é de fato mais barata que voar.

## A estrela dourada no mapa

Os destinos com **preço real de voo** aparecem no mapa com uma estrela dourada
antes do valor (★ € 849) e um anel dourado em volta do pino — assim dá para ver
de longe onde o número é cotação de verdade e onde é estimativa. A legenda
embaixo do mapa explica, e o balãozinho de cada destino diz qual é o caso.

## A ordem da informação

Dentro da coluna "Como chegar", o que é **confirmado vem sempre primeiro** e a
estimativa por último:

1. **Voo direto da Ryanair** — com número do voo, dia, hora de partida e de
   chegada, duração, e link para reservar;
2. **Trajeto com escala** — as duas pernas com horários reais e o tempo de
   espera no aeroporto;
3. **Estimativa de mercado** — por último, e dita como estimativa.

Ao abrir um destino, a barra inferior cresce sozinha até **caber a informação
inteira sem rolagem** (no máximo 62% da tela). A medida vai até o fim da grade
de conteúdo e ignora a faixa de anúncios que vem depois: incluí-la fazia a conta
estourar o teto, e o que sobrava espremido era justamente o conteúdo. Anúncio
abaixo da dobra é normal; o preço do voo não pode estar.

Os caminhos alternativos chegam segundos depois do clique, então a medida é
refeita quando eles aparecem — senão a opção recém-encontrada nascia fora da
tela. Uma altura fixada à mão vira **piso**, não teto: você continua mandando no
tamanho da barra, mas nunca fica com menos do que a informação precisa.

## Filtrar só o que tem preço confirmado

> **O filtro pergunta à malha, não às tarifas.** Filtrar por "tem preço
> confirmado" escondia destinos que têm voo direto mas cujo preço ainda não foi
> consultado — e como o preço só é buscado ao abrir o destino, escondê-lo
> impedia que ele fosse buscado. O Porto tem voo direto de Cagliari e sumia com
> o filtro ligado. Agora o filtro usa as **rotas** (cache de 30 dias, 5
> consultas), e o preço chega ao abrir.
>
> No mapa, ★ cheia é preço confirmado e ☆ vazada é "tem voo direto, preço a
> consultar". De Olbia isso levou o filtro de 30 para **41 destinos** — e, com a
> varredura em lotes, os 41 saem com ★ cheia.

### O teto de 20 ofertas, e como contorná-lo

**A API devolve no máximo 20 ofertas por consulta.** Cagliari sozinha serve 42
rotas: pedindo as tarifas do aeroporto vêm as 20 mais baratas e as outras 22
ficam de fora. `arrivalCountryCode` traz até 20 daquele país — o teto é o mesmo,
e por isso ampliar a varredura de oito para catorze países não mudava nada.

A saída é dizer **quais** destinos queremos. O parâmetro certo é
`arrivalAirportIataCodes`, no plural e separado por vírgula:

| Forma | Resultado |
|---|---|
| `arrivalAirportIataCode=OPO&arrivalAirportIataCode=DUS` (repetido) | 0 ofertas |
| `arrivalAirportIataCode=OPO,DUS` (singular com vírgula) | 0 ofertas |
| `arrivalAirportIataCodes=OPO,DUS` | funciona |
| `limit=50` | HTTP 400 |

As duas primeiras formas devolvem **200 com zero ofertas** — falham em silêncio,
que é o pior jeito de falhar. Vale conferir a contagem de respostas, não só o
código HTTP.

Com a lista aceita, a conta muda de figura: manda-se 15 códigos por consulta
(abaixo do teto de 20, para nenhum ser cortado) e recebe-se o preço de todos.
As 42 rotas de Cagliari saem em **3 requisições e 1,7 segundo**; as 50 rotas das
quatro saídas de Olbia, em 6 requisições e ~4 segundos. A cobertura dos voos
diretos passou de ~80% para **100%**.

A consulta do **par exato** (`arrivalAirportIataCode`, singular, sozinho)
continua servindo para quando a pessoa abre um destino: ali interessam as datas
e os voos concretos, não só o menor preço.

Dentro do mapa há dois botões, com a contagem de cada um:

- **★ Só preço confirmado** — destinos com voo direto **ou** alcançáveis com uma
  escala pela malha da Ryanair. Saindo de Olbia: 10 diretos + 46 com escala = 56.
- **✈ Só voo direto** — apenas os 10 com voo direto.

Clicar no botão que já está ligado volta a mostrar tudo; ligar um desliga o
outro. Eles só aparecem quando há o que filtrar e se desligam sozinhos se as
tarifas sumirem (outra origem, outro mês).

Para o primeiro botão saber de antemão quais destinos têm escala — sem esperar o
clique em cada um — o site monta a rede de uma parada assim que as tarifas
chegam: rotas da origem dão os hubs, e as rotas de cada hub dão o alcance. São no
máximo 14 hubs (priorizando as bases da companhia, que são as mais conectadas),
em grupos de 4, com cache de 7 dias.

## O que ganha destaque

O **preço confirmado é dourado** — a mesma cor da estrela no mapa —, e é o único
elemento realçado na coluna de voo. Antes o verde da estimativa competia com ele.

A linha "Estimativa de mercado" saiu de vez: repetia o número que já está no
Resumo e levava ao mesmo Google do botão ao lado. Quando não há preço confirmado,
entra só uma nota sóbria dizendo que o valor do resumo é estimativa.

A busca do Google é a **última saída, e só quando não há saída melhor**. Ela
desaparece assim que existe preço confirmado: no voo direto, quando a tarifa
chega; nos caminhos alternativos, quando eles são encontrados. Mandar a pessoa
pesquisar de novo o que ela acabou de receber pronto é ruído, e o espaço que a
coluna ocupava volta para os cards — que foi o que os deixou lado a lado sem
apertar (430 px → 598 px de largura cada).

Quando **não há nenhum preço confirmado** — nem voo direto, nem trajeto com
escala — a coluna inteira ganha o destaque dourado e passa a ser o caminho
principal da tela: a pessoa não vê um beco sem saída, e sim o atalho para
procurar por conta própria.

### O total saiu do corpo do painel

Havia uma coluna "Resumo" com o total em corpo 27 — o mesmo número que já estava
no cabeçalho da barra, e o mesmo tipo de número que cada card mostra. Três
apresentações do mesmo dado, e a maior delas era a menos útil: ninguém compara
opções pelo total do destino, compara pelo preço de cada caminho.

Sobrou uma faixa de uma linha com o que o cabeçalho não diz — quanto sobra do
orçamento e a divisão voo/hospedagem, esta só quando há as duas coisas. O total
ficou onde já estava: no título.

### O preço de cada card vive no mesmo canto

Nos cards de caminho o preço ficava depois do selo, no meio de uma linha que
embrulhava — e acabava em posições diferentes em cada card. Ancorado no canto
superior direito dos dois, a comparação é um movimento de olho só, sem releitura.
É a mesma razão de o preço de cada opção de voo e de hospedagem ter subido para
19 px e ido para o alto da linha, em vez de centralizado.

### As opções aparecem juntas, não escolhidas por nós

Um voo direto de um aeroporto vizinho é imbatível, então quando existe é o que
aparece. Fora isso, **quem escolhe é quem viaja**: as duas alternativas são
buscadas em paralelo e mostradas uma sob a outra, com o preço de cada uma e um
selo no mais barato.

| Opção | Quando importa |
|---|---|
| **★ voo + ônibus** | mais barato, um voo só, mas com trecho de estrada |
| **✈ só de avião, com escala** | para quem não quer pegar ônibus |

Passar o mouse por uma delas desenha aquele caminho no mapa. Para Amsterdã
saindo de Olbia, por exemplo, a escala via Dublin sai por € 83 e o voo até
Bruxelas mais ônibus por € 122 — quem prefere não pegar ônibus agora vê a opção,
que antes o site escondia ao parar na primeira que encontrava.

Se nada disso existe, a **busca no Google** assume o destaque dourado.

O passo 2 é o caminho que as pessoas realmente fazem. Para **Santiago de
Compostela saindo de Olbia**, o site oferecia uma escala de € 219 só de ida; a
resposta boa é voar Cagliari → Porto por € 104 e pegar 2h45 de ônibus até
Santiago — **€ 136 no total, ida e volta**. Ele procura de propósito: para cada
cidade num raio de 350 km do destino, verifica se há tarifa confirmada e, se não
houver, se existe voo direto até lá saindo de algum aeroporto perto de casa.

O trecho terrestre é estimado em € 0,085/km e 70 km/h de média, e leva a uma
busca no Google — o valor é de planejamento, não cotação.

### Escala: no máximo 28 horas

Acima disso deixa de ser escala e vira outra viagem. As janelas tentadas são
6 h, 12 h e 28 h, nessa ordem; se nada couber, o trajeto é descartado e o site
procura outro caminho em vez de oferecer dois dias num aeroporto.

### Cinco aeroportos de partida

O site usa os **5 aeroportos mais próximos** num raio de 260 km, e o filtro
"só voo direto" enxerga todos — quem pode sair de Olbia também pode sair de
Cagliari. De Olbia isso significa OLB, FSC, AHO, **CAG** e **FCO (Roma)**, e leva
os voos diretos de 19 para **38**.

O custo é controlado escalonando o esforço: uma consulta geral na saída mais
próxima para a primeira pintura, varredura em lotes na malha de todas elas, e
rede de escalas nas duas primeiras. A caixa do mapa mostra de quais aeroportos
as tarifas realmente vieram.

### Distância em linha reta não é distância de estrada

Sugerir Pisa para quem está na Sardenha é mandar a pessoa pegar uma balsa de
sete horas sem avisar. `assets/js/data/landmass.js` guarda a caixa geográfica de
cada ilha relevante da malha, e dois pontos só contam como ligados por terra
quando estão na mesma massa — a mesma ilha, ou os dois no continente.

Isso vale em todo lugar onde o site sugere deslocamento por terra: aeroportos de
partida alternativos, o aeroporto vizinho com voo direto e o último trecho de
ônibus. De Olbia as saídas passaram a ser só **OLB, AHO e CAG** — Figari (na
Córsega) e Roma saíram, apesar de estarem perto em linha reta.

Não é um mapa de estradas: é uma salvaguarda contra o erro grosseiro de ignorar
o mar. Numa ilha sem aeroporto nenhum o site volta aos mais próximos e mostra a
distância, porque não oferecer nada seria pior.

### Três aeroportos de partida não bastavam

O caso que expôs isso: de **Olbia para o Porto**, o site oferecia uma escala
longa. Mas Olbia tem Figari (73 km) e Alghero (107 km) mais perto que Cagliari
(189 km) — e **só Cagliari voa direto para o Porto**. Como as tarifas são
buscadas nos 3 aeroportos mais próximos, Cagliari ficava de fora.

A correção não foi aumentar para 4 (o problema voltaria com o 5º): quando
nenhuma das saídas habituais chega ao destino, o site procura **sob demanda**,
num raio de 400 km, um aeroporto que tenha a rota direta. Consulta a malha, que
já está em cache, e só pede preço dos que realmente voam para lá.

De Olbia para o Porto isso devolve **€ 104 ida e volta, sem escala, saindo de
Cagliari**, com o aviso de que são 189 km por terra até o aeroporto — no lugar
do trajeto com duas escalas.

### O aeroporto ao lado costuma ser a melhor resposta

Antes de oferecer um trajeto sofrido, o site procura um **destino vizinho com
voo direto e preço confirmado** — até 350 km — e sugere no topo da coluna.

O caso que motivou isso: Porto → Olbia não tem voo direto, e o trajeto com
escala saía por € 152 com duas paradas de dois dias em Bergamo e 21 dias fora.
Mas **Cagliari, a 192 km na mesma ilha, tem voo direto de Porto por € 119**. A
sugestão aparece em dourado ("★ voo direto aqui perto") com a distância, o
número do voo e o preço; um clique abre aquele destino.

A busca varre todas as tarifas conhecidas, não só as visíveis no mapa — o
destino vizinho pode estar fora do enquadramento atual.

### Escalas longas são possibilidades, não erros

Numa rota de dois voos por semana, esperar dois dias na escala pode ser a única
forma de chegar — e isso é uma possibilidade legítima, desde que a tela diga
onde e por quanto tempo. Por isso a busca tenta três janelas em ordem:

| Janela | Como aparece |
|---|---|
| até 12 h | "troca de avião em Bergamo, no mesmo dia" |
| até 48 h | "uma noite em Bergamo entre os voos" |
| até 7 dias | "**3 dias em Bergamo** entre um voo e outro" |

O trajeto só é descartado se nem assim houver voo. Quando a parada passa de 30 h,
entra também o aviso de que aquilo é quase uma segunda viagem e exige hospedagem
na cidade da escala.

O site compara as **duas saídas mais próximas** e fica com a melhor: parar na
primeira que funcionasse levava a trajetos de € 179 saindo de um aeroporto a
195 km, quando o aeroporto local resolvia por € 152.

## A base de destinos veio da própria malha

A Sardenha inteira faltava — Porto–Cagliari tem voo direto da Ryanair e nunca
aparecia, porque Cagliari não era um destino cadastrado. Para não depender de
descobrir isso caso a caso, cruzei os 224 aeroportos da malha com a base e
procurei os que não tinham destino a menos de 130 km.

Eram 63. Depois de preencher as lacunas com apelo turístico (ilhas gregas,
Chipre, costa búlgara, Canárias, Lapônia, sul da Itália, Sardenha…), a base foi
de 136 para **212 destinos** e a cobertura da malha de 72% para **92%**. Os 18
que sobraram são aeroportos regionais sem destino turístico próprio.

Vale repetir esse cruzamento sempre que a malha mudar — o script está no
histórico e leva segundos.

## Sair da seleção

Fechar a barra pelo cabeçalho só a recolhia: o destino seguia escolhido, o arco
continuava desenhado e o pino, destacado. Voltar a "olhar o mapa inteiro" exigia
clicar em outro lugar qualquer — um jeito de sair que a pessoa descobre por
acidente, não por desenho.

O botão **✕ Limpar seleção** aparece no mapa junto dos filtros, em cinza: é uma
saída, não mais um filtro, e competir em cor com o dourado e o verde faria ser
lido como um. Ele desfaz a seleção, apaga o arco, recolhe a barra e some sozinho
quando não há nada a limpar. **Esc** faz o mesmo.

O formulário não é tocado — origem, orçamento e datas são o contexto da pessoa,
não a seleção. Só o destino digitado sai junto, porque é ele que prende o mapa a
um lugar só.

## O arco fica enquanto o destino estiver escolhido

Passar o mouse desenha o arco; **clicar fixa**. Enquanto houver um destino
selecionado o trajeto continua na tela — inclusive passando pela escala, quando
é um trajeto com conexão — e acompanha o mapa ao arrastar e dar zoom. Só some ao
escolher outro destino.

## Aviso de responsabilidade

Fica **uma única vez** no pé da barra inferior, fixo no HTML e fora do
`#detailsBody` — por isso o JS não deve reinjetá-lo ao redesenhar o painel, ou
ele aparece duas vezes. O texto: o site não vende passagens nem faz
reservas, os links abrem o site da companhia em nova aba, cada reserva é de
responsabilidade de quem a faz, os trajetos com escala são bilhetes separados
sem proteção de conexão, e tudo é calculado automaticamente, sem revisão humana,
a partir de dados públicos que mudam a todo momento — para explorar
possibilidades, não como garantia.

## A ordem dos passos na tela

Cada região tem o seu espaço — nada fica por cima do mapa. A versão flutuante
foi testada e descartada: a barra e a lateral escondiam justamente os destinos
mais próximos da origem, que são os que mais interessam, e as caixas grandes
deixavam o mapa com menos de um terço da tela.

A disposição segue a ordem em que a pessoa decide, não a ordem em que os campos
existem:

1. **Barra superior, primeira linha** — de onde sai e (opcional) para onde quer
   ir, lado a lado. São as duas pontas da viagem.
2. **Barra superior, segunda linha** — **quanto se tem**, ocupando a largura
   inteira: slider centralizado, moeda à esquerda, valor à direita. É a pergunta
   que o site responde, então é o maior controle da tela. O campo aceita valores
   acima do teto do slider; passando de € 1.000 o trilho se apaga, porque ali
   quem manda é o número digitado.
3. **Lateral esquerda** — quando viaja (por duração ou por datas), quantos são,
   o que entra na conta e o estilo. Ajustes, depois da escolha principal.

Antes tudo isso era uma coluna só à esquerda, com o orçamento perdido entre a
origem e a duração. Quem abria o site não tinha um primeiro passo óbvio.

O slider tem trilho de 10 px e polegar de 26 px. Em 4 px ele lia como uma linha
divisória — a pessoa não percebia que dava para pegar. A parte preenchida é
pintada por um gradiente cujo ponto de virada vem de `--pct`, escrito pelo JS a
cada movimento: um `input[type=range]` nativo pinta o trilho inteiro de uma cor
só, não há como fazer isso em CSS puro.

### Densidade

A primeira versão desta tela tinha informação boa em caixas grandes demais: a
barra de cima sozinha ocupava 190 px e a lateral 312 px, e o mapa — que é o
produto — ficava espremido entre as duas.

| | Antes | Agora |
|---|---|---|
| Barra superior | 190 px | **104 px** |
| Lateral | 312 px | **258 px** |
| Linha de voo nos cards | 45 px | **34 px** |
| Aviso legal | ~100 px | **31 px** (resumo + expansor) |

O que encolheu foi a moldura, não a informação. Os rótulos da barra de cima
passaram a ficar **ao lado** dos campos em vez de acima, e as dicas viraram
legenda fora do fluxo — no fluxo elas cobravam a altura de um campo inteiro para
repetir o que o campo já dizia. O aviso legal virou um resumo de uma linha,
sempre à vista, com o texto completo a um clique.

`--topbar-h` é medido em tempo real por um `ResizeObserver`, porque a barra muda
de altura sozinha (a dica sob a origem passa de "digite 3 letras" para "Itália ·
detectado pelo IP"). Abaixo de 880 px os blocos empilham.

### O mapa tem um tamanho mínimo

O teto da barra inferior sai de uma regra sobre o **mapa**, não sobre a barra:

```js
const mapaMinimo = Math.max(260, window.innerHeight * 0.3);
const teto = window.innerHeight - topbar - mapaMinimo - extras;
```

Antes o limite era uma fração do corpo da barra e ignorava a alça e o aviso
legal, que somam mais de 100 px. Num monitor de 720 px a barra chegou a **593 px
e sobraram 23 px de mapa** — o produto desaparecia para caber o detalhe.

Duas armadilhas que isso expôs:

- **O Leaflet precisa ser avisado.** Abrir a barra encolhe o mapa, mas
  `fitBounds` continuava enquadrando para o retângulo antigo — era por isso que
  a ponta do arco ficava escondida atrás dos cards. `map.invalidateSize()` vem
  antes de todo enquadramento, e o trajeto é reenquadrado sempre que a barra
  muda de altura, alterna aberta/recolhida ou a janela é redimensionada.
- **Recolhida, o corpo mede zero.** A conta do teto saía negativa, caía no
  mínimo e apagava a altura do destino aberto: reabrir a barra devolvia 150 px
  em vez do tamanho que ela tinha. A medição agora só roda com a barra aberta.

## A barra lateral é só o formulário

A lateral esquerda tem apenas os campos da busca. A lista de destinos saiu: o
mapa é a lista, e o detalhe aparece na barra de baixo ao clicar num destino.

**Não há botão de pesquisar.** O mapa refaz a conta a cada campo alterado, com
320 ms de espera para não recalcular a cada tecla. Um botão ali seria um passo a
mais entre mudar o orçamento e ver o efeito — e o efeito é o produto.

### Duração ou datas

São dois jeitos de dizer quando a viagem é, e a pessoa escolhe qual encaixa:

- **Por duração** — sete dias em setembro, qualquer semana serve. A busca varre
  o mês inteiro atrás da tarifa mais barata. É o modo de quem ainda está
  escolhendo para onde ir.
- **Por datas** — parte neste dia, volta naquele. A janela da consulta passa a
  ser exata e o filtro de duração é desligado (com as datas presas, a margem de
  ±1 dia só arriscava descartar um voo que cabia). É o modo de quem já tem as
  férias marcadas. A volta pode ficar vazia: aí o retorno é qualquer dia do mês
  seguinte.

O campo "Quando?" desapareceu do modo datas — o mês já está na data da ida, e
pedir a mesma informação duas vezes é um convite a contradizê-las.

As datas exatas ficam em `RYA.definirDatas` e entram na chave de cache por
`chaveJanela`: sem isso, duas datas diferentes do mesmo mês com a mesma duração
compartilhariam a chave e uma leria a tarifa da outra.

## A abertura do mapa

Na primeira carga o mapa começa vendo o mundo inteiro e se aproxima da origem
detectada. A abertura inteira leva menos de 2 s: 0,3 s parado no mundo e 1,5 s
de voo. Serve para a pessoa entender de onde a busca está
partindo antes de olhar os preços.

Cuidado ao mexer nisso: o `flyTo` do Leaflet roda em `requestAnimationFrame`,
que fica **congelado enquanto a aba está em segundo plano**. Se alguém abre o
site numa aba de fundo, a animação não anda e o mapa ficaria parado no mundo
inteiro. Por isso há uma checagem 1,6 s depois: se o zoom não mudou, o mapa vai
para a origem sem animar.

## A busca acompanha o mapa

Não existe "buscar no mundo inteiro": o site procura **só no pedaço do mapa que
está à vista**. Arrastou ou deu zoom, ele refaz a conta com o que entrou no
enquadramento (com 280 ms de espera, para não recalcular a cada pixel).

Na prática, saindo de Olbia com €900: a área da abertura mostra 45 destinos,
afastando para o mundo todo vão a 132, e um zoom na Itália deixa 2 (Roma e
Nápoles). O título da lista diz sempre "N cabem nesta área".

Nada reenquadra o mapa por conta própria — nem mexer nos campos, nem trocar de
moeda ou de filtro. O enquadramento é de quem está navegando; quem se
ajusta é a busca. A única exceção é a animação de abertura.

Ao clicar num destino o mapa desliza até ele, mas isso **não** dispara nova
busca: movimentos feitos pelo próprio site são marcados com `state.ignorarMove`
para a lista não se refazer sozinha a cada clique.

## Contraste: o que foi medido

As cores foram escolhidas medindo, não olhando. O tema claro herdou tons pensados
para fundo escuro, e três deles reprovavam:

| Elemento | Antes | Agora |
|---|---|---|
| ★ sobre a pílula de preço | **1,58:1** | 4,59:1 |
| dicas sob os campos | **2,89:1** | 5,00:1 |
| selo "mais barata" (9 px) | **4,05:1** | 5,5:1 |
| pílula "cabe" (texto) | 5,54:1 | 6,26:1 |
| pílula "quase lá" | 5,99:1 | 5,44:1 |

A mudança de fundo das pílulas foi a maior: elas eram verde e âmbar vivos com
texto escuro, e sobre tiles claros quase não se destacavam do mapa. Agora são
verde e âmbar **escuros com texto branco** — o texto vai de 3,0:1 para 6,3:1 e a
pílula em si ganha 4,5:1 contra o mapa.

Isso obrigou a separar duas famílias de variável que antes eram uma só:
`--fit` / `--tight` são a cor do **dado** (pontos da legenda, números das
estatísticas, texto sobre branco) e continuam vivas; `--fit-pino` / `--tight-pino`
são o **fundo da pílula**, que carrega texto branco. Usar o mesmo tom nos dois
papéis é o que fazia um deles falhar sempre.

A estrela seguiu o mesmo raciocínio: `--gold` escuro para texto sobre branco,
`--gold-pino` claro para a estrela sobre a pílula escura.

O ponto dos destinos fora do orçamento era `#4a3038`, um vinho escuro herdado do
tema escuro que sobre mapa claro virava sujeira. Virou ponto branco com aro
vermelho: lê como marcador desligado, visível sem competir com os preços.

> **Como medir de verdade.** Comparar `getComputedStyle().color` com o
> `backgroundColor` do pai dá números errados quando o fundo é translúcido — e
> quase todos os nossos são (`--gold-bg` é `#f5b32b14`). O valor vem como
> `rgba(...)` e, se o alfa for ignorado, compara-se o texto contra a cor **sólida**
> da tinta. Numa medição assim o preço do card verde apareceu como 1,45:1
> (reprovado) quando na verdade é 4,82:1. É preciso compor cada camada
> translúcida até achar um fundo opaco, e só então calcular.

## Tema claro

A paleta é clara por escolha, não por ausência de tema escuro — esse virá depois,
como opção. Duas decisões que o claro impõe e o escuro escondia:

**O verde da marca tem dois papéis.** `#2dd4a7` tem contraste de 2,1:1 sobre
branco: serve de fundo de pílula, não de texto. No claro ele escureceu para
`#0d9a72` (texto legível) e o tom vivo migrou para os fundos (`--accent-bg`,
`--accent-chip`). O mesmo vale para o dourado do preço confirmado, que virou dois
valores: `--gold-solid` para fundo de selo e `--gold` para texto e borda. Usar um
tom só nos dois papéis era o que sumia na tela branca.

**O fundo não é branco puro.** `#f4f6f8`: papel branco atrás de texto escuro
cansa a vista, e um cinza de 2% já tira o brilho. Os painéis, esses brancos,
ganham profundidade por contraste com o fundo, sem precisar de sombra pesada.

Os tiles do mapa, que antes eram invertidos para virar mapa escuro, agora só
perdem parte da saturação — o mapa vira pano de fundo calmo e as pílulas de preço
ficam sendo a única coisa saturada da tela, que é onde o olho deve cair primeiro.

## Detalhes da interface

**A barra de orçamento vai até € 1.000** (ou o equivalente na moeda escolhida),
com passos de 25. Valores maiores continuam válidos — é só digitar no campo, e a
barra fica no máximo com o cursor acinzentado, sinalizando que o valor está
acima dela.

**Arco da rota.** Ao passar o mouse por um destino, no mapa ou na lista, um arco
fino é desenhado da origem até ele, com gradiente azul→verde e um traço de
sombra por baixo para destacar do mapa. É enfeite: fica numa camada SVG própria
(`.rota-layer`), não captura cliques e some assim que o ponteiro sai ou o mapa
se mexe. A curvatura acompanha a distância na tela — quanto mais longe, mais
alto o arco.

## Altura da barra inferior

A barra **abre recolhida**: no primeiro acesso a tela é só o mapa e o
formulário, com uma faixa de 48 px embaixo. Ela se abre sozinha ao clicar num
destino e volta a recolher quando a seleção é limpa. O aviso de
responsabilidade acompanha — fica escondido com a barra recolhida e continua
acessível pelo "?" no topo.

Quando aberta, parte de um tamanho discreto e cresce até o necessário.

Tem uma alça na borda de cima: **arraste para escolher quanto espaço ela ocupa**
(entre 150 px e 80% da tela) e **duplo clique volta ao padrão**. A altura
escolhida fica guardada para as próximas visitas.

No celular a alça não aparece: lá a barra cresce junto com o conteúdo e não há o
que ajustar.

## Ligar os anúncios

1. Cadastre o site no [Google AdSense](https://adsense.google.com) e espere a
   aprovação (precisa estar no ar num domínio próprio — AdSense não aprova `localhost`).
2. No `index.html`, descomente a tag `<script>` do AdSense no `<head>` e ponha o seu `ca-pub-…`.
3. Em `assets/js/ads.js`, preencha `CLIENT` e os **quatro** `SLOTS` e mude `ENABLED` para `true`.

São quatro espaços: um retângulo na barra lateral e uma faixa de três blocos
ocupando toda a largura do rodapé, dentro do painel de detalhes.

> Um aviso que vale dinheiro: o AdSense reprova site com **mais anúncio que
> conteúdo**. Quatro blocos numa página de pouca leitura é bastante. Se a
> aprovação demorar ou vier negada, o primeiro corte a fazer é reduzir a faixa
> de três para um ou dois blocos — é só apagar os `<div class="ad-slot">` extras
> em `renderDetails()`.

Enquanto `ENABLED` for `false`, os espaços aparecem como caixas tracejadas — dá
para conferir o layout sem infringir as regras do AdSense.

## Ligar o dinheiro de afiliado

Num site de viagem costuma render bem mais que o AdSense. Em `assets/js/links.js`:

- `bookingAid` — Booking.com Affiliate Partner Programme (comissão por reserva);
- `kiwiAffilid` — Kiwi.com / Travelpayouts (comissão por passagem).

## Publicar

Site estático, sem build:

```bash
npx vercel --prod
```

## Serviços externos usados (todos gratuitos e sem chave)

- **OpenFreeMap** — mapa vetorial, sem limite de uso
- **OpenStreetMap** — tiles raster do fallback e busca de cidades (Nominatim)
- **Ryanair Fare Finder** — preços reais de voo
- **frankfurter.dev** (Banco Central Europeu) — câmbio do dia, com tabela de reserva
