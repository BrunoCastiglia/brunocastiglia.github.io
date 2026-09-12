# brunocastiglia.github.io

Site raiz do domínio `brunocastiglia.github.io`. Serve para duas coisas:

1. uma página inicial que aponta para os projetos publicados;
2. hospedar o **`ads.txt`**, que precisa ficar na raiz do domínio.

## Por que o `ads.txt` mora aqui

O Google procura o arquivo em `https://brunocastiglia.github.io/ads.txt`, e só
ali. Um arquivo dentro do repositório `moneytogo` seria publicado em
`/moneytogo/ads.txt`, onde nenhum rastreador procura.

## Estado

O `ads.txt` já está preenchido com o ID de publisher real:

```
google.com, pub-8514640441352876, DIRECT, f08c47fec0942fa0
```

O `f08c47fec0942fa0` é o identificador do Google e é igual para todos os
publishers — o que muda é só o `pub-`.

Confira em <https://brunocastiglia.github.io/ads.txt>. O Google leva de algumas
horas a um dia para rastrear o arquivo depois de publicado.
