# 🎱 Bingo Show de Prêmios - Documentação Técnica completa

# LTS promto para venda 1.0

Bem-vindo à documentação técnica completa do **Bingo Show de Prêmios**, uma plataforma web _real-time_ e multi-tenant para gerenciamento e execução de jogos de bingo e rifas online.

Este sistema foi projetado para ser uma solução robusta e escalável, permitindo que múltiplos administradores (operadores de bingo) gerenciem seus próprios ecossistemas de jogadores, vendedores e finanças de forma isolada e segura.

## ✨ Funcionalidades Principais

O sistema é dividido em três personas principais, cada uma com um conjunto rico de funcionalidades.

### 👨‍💻 Para Administradores (Operadores)

-   **Painel de Controle Multi-Tenant:** Gestão completa de partidas, rifas, jogadores, vendedores e finanças, com dados isolados por administrador.
-   **Gestão Financeira:** Aprovação de entradas de caixa (PIX de jogadores, acertos de vendedores) e processamento de saídas (resgates de prêmios).
-   **Motor de Automação:** Configuração de um "piloto automático" para criar e iniciar partidas de bingo em horários pré-definidos, garantindo um lobby sempre ativo.
-   **Sistema de Vendedores:** Aprovação de cadastros, definição de comissões/descontos e acompanhamento de vendas físicas e online.
-   **Caixa do Admin:** Acompanhamento de lucro acumulado e funcionalidade para realizar retiradas.

### 🏪 Para Vendedores

-   **Painel Dedicado:** Visão geral de vendas, comissões e dívidas (fiado).
-   **Venda Física e Híbrida:** Emissão de bilhetes de bingo e rifas para impressão, com QR Codes para validação e pagamento online pelo cliente.
-   **Gestão de Fiado:** Sistema para registrar vendas "fiadas" e realizar o acerto financeiro posteriormente via PIX ou com o saldo em conta.
-   **Links de Indicação:** Geração de links de venda personalizados que garantem comissão automática em compras online.
-   **Perfil Público:** Página de perfil verificada para que clientes possam confirmar a autenticidade do vendedor.

### 🎮 Para Jogadores

-   **Lobby Real-Time:** Visualização de partidas (Ao Vivo, Abertas, Agendadas) com atualização em tempo real.
-   **Hall da Fama (Ranking):** Tabela de classificação que exibe os maiores vencedores da plataforma.
-   **Gerenciamento de Cartelas:** Criação de cartelas personalizadas (manuais ou aleatórias).
-   **Sistema de Créditos Decimais:** Suporte a créditos "Reais" (comprados) e "de Brincar" (gratuitos), com precisão de centavos.
-   **Gameplay Interativo:** Marcação automática ou manual de números e detecção instantânea de "BINGO!".
-   **Histórico Pessoal:** Área para acompanhar vitórias, solicitações de crédito e resgates.

## 🛠️ Arquitetura e Stack Tecnológica

| Categoria          | Tecnologia                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| **Frontend**       | [React](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **UI & Estilização** | [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)                           |
| **Estado & Cache**   | [TanStack Query](https://tanstack.com/query) (Server State), React Context (Client State)              |
| **Roteamento**       | [React Router](https://reactrouter.com/)                                                               |
| **Formulários**      | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)                                |
| **Backend**        | [Supabase](https://supabase.com/) (PostgreSQL, Auth, Edge Functions, Realtime, Storage)                |

## 🗃️ Modelo de Dados (Schema PostgreSQL)

O banco de dados é o coração do sistema. Todas as colunas financeiras utilizam o tipo `numeric` para garantir precisão decimal. A segurança é garantida por políticas de **Row Level Security (RLS)** em todas as tabelas críticas.

### Entidades Principais

| Tabela                 | Descrição                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `perfis`               | Armazena dados de todos os usuários (jogadores, vendedores, admins). Contém os saldos `credits` e `fake_credits`.                      |
| `partidas`             | Define as partidas de bingo, incluindo tipo, preço, prêmio, status e números sorteados (`called_numbers`).                            |
| `cartelas_jogador`     | As cartelas "mestras" que um jogador possui em sua conta, com os números e usos restantes (`uses_left`).                               |
| `cartelas_partida`     | Uma "cópia" de uma `cartelas_jogador` quando ela é usada para entrar em uma `partida` específica. Armazena os números marcados.        |
| `configuracoes`        | Tabela singleton que armazena todas as configurações globais do sistema, incluindo o lucro do admin (`admin_profit`).                  |
| `vitorias`             | Registro histórico de cada vitória, usado para alimentar o Hall da Fama e o perfil do jogador.                                       |

### Módulo de Vendedores e Vendas Físicas

| Tabela                  | Descrição                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `vendedores_rifa`       | Perfil oficial do vendedor, contendo taxas de comissão/desconto e o código de referência (`codigo_ref`).                               |
| `solicitacoes_vendedor` | Registra os pedidos de usuários para se tornarem vendedores, aguardando aprovação do admin.                                          |
| `vendas_bingo_fisico`   | Armazena cada "folha" de bingo impressa por um vendedor, com seus grids, código de validação e status de pagamento.                   |
| `compras_rifa`          | Similar ao anterior, mas para cotas de rifas vendidas por vendedores.                                                                |
| `acertos_vendedor`      | Registra as transações de "acerto de contas", onde o vendedor repassa o dinheiro das vendas (fiado) para o admin.                      |

### Módulo Financeiro

| Tabela                 | Descrição                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `solicitacoes_credito` | Pedidos de compra de créditos feitos por jogadores via PIX, aguardando aprovação do admin.                                           |
| `solicitacoes_resgate` | Pedidos de jogadores para converter seus créditos em dinheiro (saque), aguardando pagamento do admin.                                |
| `mensagens_solicitacao` | Sistema de chat vinculado a cada solicitação de crédito para comunicação entre jogador e admin.                                      |
| `stripe_payments`      | Log de todas as transações processadas via Stripe para auditoria e prevenção de duplicidade.                                         |

## 🔐 Modelo de Segurança (Row Level Security)

A segurança e o isolamento de dados são pilares da arquitetura, garantidos por políticas RLS.

-   **Isolamento de Usuário:** A política mais comum garante que um usuário só possa ver e modificar seus próprios dados.
    ```sql
    -- Exemplo: Usuários só podem ver suas próprias cartelas.
    CREATE POLICY "Users can manage their own cards"
    ON public.cartelas_jogador FOR ALL
    USING (auth.uid() = player_id);
    ```
-   **Isolamento de Tenant (Multi-Tenant):** A coluna `admins_id` está presente em quase todas as tabelas. As políticas de RLS para administradores garantem que um admin só possa acessar os dados pertencentes ao seu "tenant".
    ```sql
    -- Exemplo: Admins só podem ver partidas que eles criaram.
    CREATE POLICY "Admins view own matches"
    ON public.partidas FOR SELECT
    USING (is_admin() AND admin_id = auth.uid());
    ```
-   **Acesso Público Controlado:** Dados que precisam ser públicos, como partidas no lobby, possuem políticas explícitas para `SELECT`.
    ```sql
    -- Exemplo: Qualquer pessoa (logada ou não) pode ver as partidas.
    CREATE POLICY "Anon read partidas"
    ON public.partidas FOR SELECT
    USING (true);
    ```

## ⚙️ Lógica de Backend (RPCs & Edge Functions)

A lógica de negócio complexa é encapsulada em Funções PostgreSQL (acessíveis via RPC) e Deno Edge Functions.

### Funções PostgreSQL (RPC)

-   `pagar_acerto_com_saldo()`: Processa o pagamento de dívidas de um vendedor usando seu próprio saldo de créditos, calculando e creditando a comissão automaticamente.
-   `reservar_numeros_vendedor()`: Gerencia a venda de cotas de rifa por vendedores, aplicando descontos e tratando pagamentos (à vista ou fiado).
-   `call-number()`: **O coração do jogo.** Sorteia um número, marca automaticamente as cartelas (`mark_number_for_match_cards`), verifica se há vencedores, e se houver, finaliza a partida e distribui os prêmios.
-   `join-match()` / `leave-match()`: Funções seguras que gerenciam a entrada e saída de jogadores, realizando as transações de crédito e estorno de forma atômica.

### Deno Edge Functions (Automação)

As Edge Functions são usadas para tarefas assíncronas e agendadas (cron jobs).

-   **`auto-match-engine`**: Executado a cada X minutos, verifica a agenda configurada pelo admin e cria novas partidas de bingo automaticamente para preencher os "slots" de horários vagos.
-   **`auto-call-engine`**: Executado a cada minuto, este motor verifica:
    1.  Partidas automáticas cujo horário de início já passou e as inicia.
    2.  Partidas em andamento que precisam de um novo número sorteado.
    3.  Se o lobby de partidas automáticas está vazio, ele força a criação de uma nova para garantir atividade contínua.
-   **`stripe-webhook`**: Endpoint seguro para receber eventos do Stripe, processar pagamentos e liberar créditos ou validar cartelas automaticamente.

## 🚀 Estrutura do Projeto

```
/
├── supabase/                # Configurações e scripts do Supabase
│   ├── functions/           # Código das Deno Edge Functions
│   └── migrations/          # Migrações do schema do banco de dados
└── src/                     # Código-fonte do frontend React
    ├── components/          # Componentes reutilizáveis (incluindo /ui para shadcn)
    ├── contexts/            # Provedores de Contexto (AuthContext, GameContext)
    ├── hooks/               # Hooks customizados para lógica de negócio e data fetching
    ├── integrations/        # Configuração de clientes de serviços (Supabase)
    ├── pages/               # Componentes de página (rotas)
    ├── types/               # Definições de tipos TypeScript
    └── utils/               # Funções utilitárias
```

## 🏁 Como Executar Localmente

1.  **Clone o repositório:**
    ```bash
    git clone <repository-url>
    ```
2.  **Instale as dependências:**
    ```bash
    npm install
    ```
3.  **Inicie o ambiente Supabase:**
    (Requer [Supabase CLI](https://supabase.com/docs/guides/cli))
    ```bash
    supabase start
    ```
    Isso iniciará um container Docker com o banco de dados, Auth e outros serviços. As credenciais serão exibidas no terminal.
4.  **Aplique as migrações:**
    ```bash
    supabase db reset
    ```
5.  **Inicie o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```
    A aplicação estará disponível em `http://localhost:8080`.

---
*Este documento foi gerado para fornecer uma visão técnica aprofundada do sistema. Para mais detalhes sobre uma funcionalidade específica, consulte o código-fonte nos hooks e componentes relevantes.*