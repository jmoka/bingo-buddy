# Bingo App - Documentação Técnica Completa

## 1. Visão Geral do Sistema 2.6

Este documento fornece uma análise técnica detalhada do Bingo App. O sistema é uma aplicação web real-time para jogos de bingo, com gerenciamento de partidas, jogadores, cartelas e um sistema financeiro robusto baseado em **créditos decimais**.

## 2. Funcionalidades Principais

### Para Jogadores
-   **Lobby de Partidas:** Visualização de partidas em tempo real (Ao Vivo, Abertas, Agendadas e Finalizadas).
-   **Hall da Fama (Ranking):** Sistema de classificação que destaca os maiores vencedores da plataforma.
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
-   **Precisão Numérica:** Uso do tipo `numeric` no banco de dados e `Number` no JavaScript para evitar erros de arredondamento.

## 4. Funcionamento Detalhado

### 4.1. Banco de Dados (Schema `public`)

Todas as colunas financeiras utilizam `numeric(10,2)` para suportar casas decimais:

-   **`perfis`**: `credits` (saldo real) e `fake_credits` (saldo de brincar).
-   **`configuracoes`**: Custos globais, lucro do admin e parâmetros do motor automático.
-   **`partidas`**: Preço da cartela, pote acumulado e lucro gerado por partida.
-   **`vitorias`**: Registro histórico de cada bingo realizado, utilizado para gerar o **Ranking**.

### 4.2. Lógica de Negócio (Edge Functions)

-   **`call-number`**: Processa o sorteio, marca cartelas, verifica vencedores e distribui prêmios.
-   **`auto-match-engine`**: Cria partidas em slots de tempo fixos respeitando a agenda configurada.
-   **`join-match` / `leave-match`**: Gerencia a entrada e saída de jogadores com estorno exato.

---

## 5. Evolução Recente

### Versão 1.1: Gamificação e Engajamento
-   Implementação do **Hall da Fama**: Uma página dedicada a listar os jogadores com mais vitórias, incentivando a competição saudável.
-   Integração do Ranking no Lobby e Menu Lateral para acesso rápido.

### Versão 1.0: Créditos Decimais
-   Migração completa de números inteiros para decimais em todo o ecossistema financeiro do app.
-   Adição de suporte a "Créditos de Brincar" com botão de recarga gratuita para testes e diversão.

---

## 6. Próximos Passos e Melhorias

-   **Otimização de Realtime**: Refinar as inscrições de canais do Supabase para reduzir o tráfego.
-   **Relatórios Avançados**: Criação de gráficos de lucro e volume de apostas no painel administrativo.
-   **Notificações Push**: Avisar jogadores quando uma partida automática estiver prestes a começar.