# Bingo App - Documentação Técnica Completa

## 1. Visão Geral do Sistema

Este documento fornece uma análise técnica detalhada do Bingo App. O sistema é uma aplicação web real-time para jogos de bingo, com gerenciamento de partidas, jogadores, cartelas e um sistema financeiro robusto baseado em **créditos decimais** (suporte a centavos/frações).

## 2. Funcionalidades Principais

### Para Jogadores
-   **Lobby de Partidas:** Visualização de partidas em tempo real (Ao Vivo, Abertas, Agendadas e Finalizadas).
-   **Gerenciamento de Cartelas:** Criação de cartelas (Manual ou Aleatória) com suporte a créditos Reais ou de Brincar.
-   **Sistema de Créditos Decimais:** Compra e resgate de créditos com precisão de centavos (ex: 10.50 cr).
-   **Jogo em Tempo Real:** Marcação automática de números e detecção instantânea de vencedores.
-   **Agenda de Partidas:** Visualização dos próximos horários cravados baseados no motor automático.

### Para Administradores
-   **Painel de Controle:** Gestão de partidas, usuários e configurações globais.
-   **Gestão Financeira:** Aprovação de entradas (PIX) e processamento de saídas (Resgates) com chat integrado.
-   **Motor Automático:** Configuração de intervalos, preços e prêmios decimais para automação total do lobby.
-   **Caixa do Admin:** Acompanhamento de lucro acumulado e realização de retiradas.

## 3. Arquitetura e Tecnologias

-   **Frontend:** React, Vite, TypeScript, Tailwind CSS.
-   **Estado & Cache:** TanStack Query (React Query) para sincronização de dados.
-   **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Realtime).
-   **Precisão Numérica:** Uso do tipo `numeric` no banco de dados e `Number` no JavaScript para evitar erros de arredondamento em transações financeiras.

## 4. Funcionamento Detalhado

### 4.1. Banco de Dados (Schema `public`)

Todas as colunas financeiras foram migradas de `integer` para `numeric(10,2)` para suportar casas decimais:

-   **`perfis`**: `credits` (saldo real) e `fake_credits` (saldo de brincar).
-   **`configuracoes`**: `custo_nova_cartela`, `custo_recarga_cartela`, `valor_por_credito`, `admin_profit`, `auto_engine_card_price` e `auto_engine_prize_value`.
-   **`partidas`**: `card_price`, `pot` e `admin_profit_from_match`.
-   **`solicitacoes_credito` / `solicitacoes_resgate`**: `credits_requested`, `amount_paid` e `amount_to_receive`.

### 4.2. Lógica de Negócio (Edge Functions)

-   **`call-number`**: Processa o sorteio, marca cartelas atomicamente, verifica vencedores e distribui prêmios decimais.
-   **`auto-match-engine`**: Cria partidas em slots de tempo fixos (ex: a cada 60 min) respeitando as configurações decimais de preço e prêmio.
-   **`join-match` / `leave-match`**: Gerencia a entrada e saída de jogadores com estorno exato de créditos.

---

## 5. Evolução do Sistema: Créditos Decimais

O sistema foi atualizado para abandonar o uso de números inteiros em saldos e custos. 

### Mudanças Implementadas:
1.  **Database**: Alteração de tipos de coluna para `numeric` e atualização de funções RPC (`buy_player_card`, `increment_player_credits`) para aceitar parâmetros decimais.
2.  **Frontend**: Substituição de `parseInt` por `Number()` em toda a lógica de cálculo. Adição de `step="0.01"` em todos os campos de `Input` numéricos.
3.  **UI/UX**: Formatação de todos os valores monetários e de crédito usando `.toFixed(2)` para garantir uma exibição consistente (ex: "R$ 10,50" ou "10.00 cr").

---

## 6. Próximos Passos e Melhorias

-   **Otimização de Realtime**: Refinar as inscrições de canais do Supabase para reduzir o tráfego em partidas com muitos jogadores.
-   **Relatórios Avançados**: Criação de gráficos de lucro e volume de apostas por período no painel administrativo.
-   **Notificações Push**: Integração com serviços de notificação para avisar jogadores quando uma partida automática estiver prestes a começar.