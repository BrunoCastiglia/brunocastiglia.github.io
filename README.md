# brunocastiglia.github.io

Site raiz do domínio `brunocastiglia.github.io`. Serve para duas coisas:

1. uma página inicial que aponta para os projetos publicados;
2. hospedar o **`ads.txt`**, que precisa ficar na raiz do domínio.

## Por que o `ads.txt` mora aqui

O Google procura o arquivo em `https://brunocastiglia.github.io/ads.txt`, e só
ali. Um arquivo dentro do repositório `moneytogo` seria publicado em
`/moneytogo/ads.txt`, onde nenhum rastreador procura.

## Como completar

Assim que a conta do AdSense for aprovada, crie um arquivo `ads.txt` neste
repositório com uma linha, trocando o número pelo seu ID de publisher:

```
google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
```

O `f08c47fec0942fa0` é o identificador do Google e é igual para todo mundo — o
que muda é só o `pub-`.

Não crie o arquivo com um ID inventado: um `ads.txt` inválido é pior que
nenhum, porque o Google passa a tratar como não autorizado o inventário que
antes ele aceitava.
