# Correção de Estabilidade - Erro de Manipulação de DOM (removeChild)

## Descrição
Documentação da correção do erro fatal `Failed to execute 'removeChild' on 'Node'`. O erro ocorria durante o processo de redirecionamento para o Checkout do PagBank, onde o sistema tentava criar e remover um link temporário para burlar restrições de segurança do banco em ambiente local.

## Entradas
- `checkout_link` (String): URL gerada pela API do PagBank.
- `rel="noreferrer noopener"` (Atributos): Utilizados para garantir privacidade e segurança no redirecionamento.

## Saídas
- Abertura de uma nova aba no navegador com a página de pagamento oficial.

## Fluxo de Execução
1. O frontend recebe o link de pagamento da Edge Function.
2. O sistema utiliza o método `window.open(url, '_blank', 'noreferrer,noopener')`.
3. O navegador processa a abertura da nova aba sem enviar o cabeçalho `Referer` (escondendo o localhost).
4. O React continua sua execução normal sem interrupções ou erros de sincronia de elementos.

## Dependências
- Objeto global `window` do navegador.

## Chamado por
- `handlePagbankPayment` em `CreditRequestDialog.tsx`.
- `handlePagbankPayment` em `PagarCartela.tsx`.

## Riscos / Observações
- **Risco Mitigado:** Crash da aplicação (Tela Branca) por conflito de manipulação de DOM.
- **Observação:** O uso de `window.open` é a prática recomendada para redirecionamentos externos em SPAs (Single Page Applications) para evitar que o estado da aplicação principal seja perdido ou corrompido.

## Histórico de Alterações
- **Data:** Atual
- **Alteração:** Substituição de `document.createElement('a')` por `window.open`.
- **Motivo:** Erro de execução `removeChild` que impedia o funcionamento do checkout em diversos cenários.