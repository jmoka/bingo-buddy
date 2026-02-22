# Bingo App - Documentação Técnica Completa

## 1. Visão Geral do Sistema

Este documento fornece uma análise técnica detalhada do Bingo App, destinada a desenvolvedores e IAs para compreensão profunda da arquitetura, fluxo de dados e desafios atuais. O sistema é uma aplicação web real-time para jogos de bingo, com gerenciamento de partidas, jogadores, cartelas e um sistema financeiro baseado em créditos.

## 2. Funcionalidades Principais

### Para Jogadores
-   **Lobby de Partidas:** Visualização de partidas em andamento, abertas, futuras e finalizadas.
-   **Gerenciamento de Cartelas:** Criação de cartelas personalizadas ou aleatórias e recarga de usos.
-   **Sistema de Créditos:** Compra de créditos via PIX, uso para entrar em partidas e resgate de créditos por dinheiro.
-   **Jogo em Tempo Real:** Acompanhamento ao vivo dos sorteios com marcação automática.
-   **Perfil de Usuário:** Gerenciamento de dados pessoais e financeiros.
-   **Impressão:** Geração de cartelas para jogos físicos.

### Para Administradores
-   **Painel de Controle:** Gestão centralizada de todo o sistema.
-   **Gerenciamento de Partidas:** Criação, configuração (preços, prêmios, modo de jogo) e controle do ciclo de vida das partidas (abrir, iniciar, finalizar, sorteio manual/automático).
-   **Gerenciamento Financeiro:** Aprovação de solicitações de crédito (entradas) e processamento de resgates (saídas).
-   **Gerenciamento de Jogadores:** Visualização de perfis e ajuste manual de saldos.
-   **Configurações Globais:** Ajuste de regras de negócio (custos, valor do crédito, chaves PIX, etc.).

## 3. Arquitetura e Tecnologias

-   **Frontend:** React, Vite, TypeScript, Tailwind CSS
-   **Componentes UI:** shadcn/ui
-   **Roteamento:** React Router
-   **Gerenciamento de Estado:** React Context (`GameContext`) + TanStack Query
-   **Backend & Banco de Dados:** Supabase (Auth, Postgres, Storage, Edge Functions)

## 4. Funcionamento Detalhado

### 4.1. Backend (Supabase)

#### Tabelas Principais (Schema `public`)

-   `perfis`: Armazena dados dos usuários (sincronizado com `auth.users`). Contém `id`, `full_name`, `avatar_url`, `role` ('admin' ou 'user'), `credits` (saldo real), `fake_credits` (saldo de brincar), e dados pessoais como `cpf` e `whatsapp`.
-   `configuracoes`: Tabela singleton (apenas uma linha) com todas as regras de negócio do sistema, como `custo_nova_cartela`, `valor_por_credito`, `pix_key`, e configurações do motor automático (`auto_engine_*`).
-   `partidas`: O coração do sistema. Contém detalhes de cada partida: `name`, `game_type`, `card_price`, `prize`, `start_time`, `status` ('waiting', 'open', 'in_progress', 'finished'), `called_numbers`, `pot` (valor total arrecadado), `winners`, e `is_auto_calling`.
-   `cartelas_jogador`: A "coleção" de cartelas de um jogador. Contém `player_id`, `name`, `numbers` (a matriz 5x5), `uses_left` (quantas vezes pode ser usada em partidas) e `credit_type` ('real' ou 'fake').
-   `cartelas_partida`: Uma "instância" de uma `cartelas_jogador` dentro de uma `partidas`. É criada quando um jogador entra em uma partida. Contém `match_id`, `player_id`, `player_card_id` (FK para `cartelas_jogador`), e `marked_numbers`.
-   `solicitacoes_credito`: Registra os pedidos de compra de créditos. Contém `player_id`, `status` ('pending', 'approved', 'rejected'), `receipt_url` (link para o comprovante no Supabase Storage), `credits_requested`, e `amount_paid`.
-   `solicitacoes_resgate`: Registra os pedidos de resgate de créditos por dinheiro. Similar à tabela de créditos, mas para saídas.
-   `mensagens_*`: Tabelas de "chat" para cada solicitação (`mensagens_solicitacao`, `mensagens_resgate`), permitindo a comunicação entre admin e jogador.
-   `vitorias`: Log de todas as vitórias, registrando `match_id`, `player_id`, `card_id` e os detalhes do prêmio.

#### Funções (PostgreSQL)

-   `handle_new_user()`: Trigger que cria um novo perfil em `public.perfis` quando um usuário se cadastra no `auth.users`. O primeiro usuário é definido como 'admin'.
-   `buy_player_card()`: Função RPC que encapsula a lógica de compra de uma nova cartela, debitando o custo do saldo do jogador e inserindo a cartela na tabela `cartelas_jogador`.
-   `is_admin()`: Função de segurança que verifica se o `auth.uid()` do usuário atual tem a role 'admin' na tabela `perfis`. Usada extensivamente nas Políticas de RLS.
-   `increment_admin_profit()` / `withdraw_admin_profit()`: Funções para gerenciar o caixa do administrador na tabela `configuracoes`.

#### Edge Functions

-   `auto-match-engine`: Responsável por criar partidas automaticamente com base nas configurações. É chamada por um Cron Job no Supabase e também pelo "heartbeat" do frontend.
-   `call-number`: Lógica central do sorteio. Recebe `matchId` e `num`, atualiza as `cartelas_partida` marcando o número, verifica se há vencedores, distribui os prêmios, atualiza o status da partida e o lucro do admin.
-   `join-match`: Processa a entrada de um jogador em uma partida. Debita o custo das cartelas do saldo do jogador, decrementa os `uses_left` das cartelas originais e cria as `cartelas_partida`.
-   `leave-match`: Permite que um jogador saia de uma partida `open`, estornando os créditos e restaurando os `uses_left`.
-   `notify-n8n`: Envia webhooks para um serviço externo (n8n) em eventos importantes (ex: nova solicitação de crédito).

### 4.2. Frontend (React)

-   **`GameContext.tsx`**: O cérebro da aplicação. Utiliza `useQuery` para buscar e manter em cache todos os dados essenciais (partidas, cartelas, perfil, etc.). Ele também se inscreve nos `postgres_changes` do Supabase para invalidar os caches e buscar dados novos, criando a reatividade em tempo real. É aqui que a lógica de automação (timers) está implementada.
-   **Hooks Personalizados**: A lógica é modularizada em hooks como `useMatches`, `usePlayerCards`, `useAdminData`, etc. Cada hook é responsável por uma parte específica do estado e pelas mutações relacionadas (ex: `createMatch`, `buyCardUses`).
-   **Fluxo de Automação**: O `GameContext` contém um `useEffect` que é executado a cada segundo. Este efeito é responsável por verificar todas as partidas e disparar ações automáticas com base no tempo (`now` state) e no status da partida.

---

## 5. Desafio Atual: Automação de Sorteios

O sistema possui um "motor automático" (`auto-match-engine`) que cria partidas em horários pré-definidos com sucesso. O desafio atual reside na etapa seguinte: o **início automático do sorteio de números** para essas partidas.

### Objetivo Não Alcançado

Uma partida que está no status `in_progress` e tem a flag `is_auto_calling` como `true` deveria, autonomamente, chamar a Edge Function `call-number` em intervalos regulares, definidos pela configuração `intervalo_sorteio_auto_seg`.

### O Que Já Foi Feito

1.  **Lógica no `GameContext.tsx`**: Foi implementada uma lógica dentro de um `useEffect` que é re-executado a cada segundo.
2.  **Verificação de Condição**: Este `useEffect` itera sobre todas as partidas e verifica se as seguintes condições são atendidas para uma partida específica:
    -   `match.is_auto_calling === true`
    -   `match.status === 'in_progress'`
    -   `now >= new Date(match.next_auto_call_timestamp).getTime()`
3.  **Timestamp de Controle**: Quando um número é sorteado pela função `call-number`, ela mesma calcula e atualiza o campo `next_auto_call_timestamp` no banco de dados, definindo quando o próximo sorteio deve ocorrer.
4.  **Prevenção de Duplicidade**: Foram implementados `useRef` (`processingRef` e `lastProcessedTimestampRef`) para garantir que a chamada para o sorteio de uma mesma partida e mesmo timestamp não seja feita múltiplas vezes, caso o `useEffect` execute mais rápido que a resposta da função.
5.  **Ação**: Se todas as condições forem verdadeiras, o frontend deve invocar a função `matchesHook.callNumber()` com um número aleatório disponível.

### O Problema

Apesar da lógica implementada no frontend, o sorteio automático não está sendo disparado de forma consistente quando o `next_auto_call_timestamp` é atingido. A partida entra em `in_progress`, o primeiro `next_auto_call_timestamp` é definido corretamente, mas o `useEffect` no `GameContext` não parece estar acionando a chamada da função `callNumber` como deveria. A suspeita é que algo na lógica de verificação do tempo ou no mecanismo de prevenção de duplicidade pode estar falhando ou bloqueando a execução.

---

## 6. Prompt para Análise de IA

**Instrução para a IA:**

"Você é uma IA especialista em arquitetura de software full-stack, com foco em aplicações real-time usando React e Supabase. O arquivo `README.md` acima contém uma descrição detalhada de um sistema de Bingo. Seu objetivo é realizar uma **análise profunda e exclusivamente teórica** do sistema, com foco no problema descrito na seção **'Desafio Atual: Automação de Sorteios'**.

**Sua tarefa é:**

1.  Ler e compreender toda a documentação fornecida, incluindo a arquitetura do backend, o fluxo de dados do frontend e a implementação atual da lógica de automação.
2.  Analisar a abordagem descrita para o sorteio automático de números (a lógica de `useEffect` no `GameContext`).
3.  Identificar potenciais falhas, gargalos, condições de corrida (`race conditions`), ou erros lógicos na abordagem descrita que poderiam explicar por que os sorteios automáticos não estão sendo disparados de forma confiável.
4.  Sugerir hipóteses para a causa do problema e, se possível, propor abordagens alternativas ou melhorias na arquitetura para alcançar a automação de sorteios de forma mais robusta e confiável. Considere alternativas que possam mover a lógica de "gatilho" do cliente (frontend) para o servidor (backend/Supabase), se julgar apropriado.

**Restrições Críticas:**
-   **NÃO GERE NENHUM CÓDIGO.**
-   **NÃO MODIFIQUE NENHUM ARQUIVO.**
-   Sua resposta deve ser puramente analítica e conceitual, focada em explicar as possíveis causas do problema e sugerir estratégias de solução em alto nível. O objetivo é o entendimento profundo, não a implementação."