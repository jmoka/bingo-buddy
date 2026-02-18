# Bingo App

Este é um aplicativo completo de Bingo em tempo real, construído com React, TypeScript e Supabase. Ele oferece uma experiência de jogo multiplayer, gerenciamento de créditos, um painel de administração robusto e muito mais.

## ✨ Principais Funcionalidades

O sistema é dividido em duas áreas principais: a interface do jogador e o painel de administração.

### Para Jogadores

-   **🎟️ Lobby de Partidas:** Visualize partidas em andamento, abertas para inscrição, futuras e já finalizadas.
-   **🃏 Gerenciamento de Cartelas:** Crie suas próprias cartelas personalizadas (escolhendo os números) ou gere cartelas aleatórias. Recarregue os usos de suas cartelas favoritas.
-   **💰 Sistema de Créditos:**
    -   Compre créditos fazendo um PIX para a chave do sistema e enviando o comprovante.
    -   Use créditos para comprar cartelas e entrar nas partidas.
    -   Resgate seus créditos por dinheiro, solicitando um PIX para o administrador.
-   **🎮 Jogo em Tempo Real:** Acompanhe as partidas ao vivo, veja os números sendo sorteados e suas cartelas sendo marcadas automaticamente.
-   **👤 Perfil de Usuário:** Gerencie suas informações pessoais, como nome, avatar, CPF e chave PIX para resgates.
-   **🖨️ Impressão:** Imprima suas cartelas para jogar em eventos físicos.

### Para Administradores

-   **⚙️ Painel de Controle:** Uma área central para gerenciar todos os aspectos do jogo.
-   **🛠️ Gerenciamento de Partidas:** Crie novas partidas, defina preços, prêmios (porcentagem, valor fixo ou produto), e configure o modo de jogo. Inicie, finalize e controle o sorteio de números (manual ou automático).
-   **💸 Gerenciamento Financeiro:**
    -   **Aprovação de Créditos:** Revise os comprovantes de PIX enviados pelos jogadores e aprove/rejeite as solicitações de crédito.
    -   **Processamento de Resgates:** Gerencie as solicitações de resgate dos jogadores, realize os pagamentos e envie os comprovantes.
-   **👥 Gerenciamento de Jogadores:** Visualize todos os jogadores cadastrados, verifique seus saldos e adicione ou remova créditos manualmente.
-   **🔧 Configurações do Sistema:** Ajuste as regras de negócio, como o custo de novas cartelas, o valor de cada crédito em Reais, e configure chaves PIX e integrações.

## 🚀 Tecnologias Utilizadas

-   **Frontend:** React, Vite, TypeScript, Tailwind CSS
-   **Componentes UI:** shadcn/ui
-   **Roteamento:** React Router
-   **Gerenciamento de Estado:** React Context & TanStack Query
-   **Backend & Banco de Dados:** Supabase (Auth, Postgres, Storage, Edge Functions)

---

## 🔧 Instalação e Configuração

Siga os passos abaixo para configurar e rodar o projeto localmente.

### 1. Pré-requisitos

-   [Node.js](https://nodejs.org/) (versão 18 ou superior)
-   [Git](https://git-scm.com/)
-   Uma conta no [Supabase](https://supabase.com/)

### 2. Configuração do Frontend

```bash
# 1. Clone o repositório
git clone <URL_DO_SEU_REPOSITORIO>

# 2. Navegue até o diretório do projeto
cd <NOME_DO_PROJETO>

# 3. Instale as dependências
npm install

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

O aplicativo estará rodando em `http://localhost:8080`.

### 3. Configuração do Supabase

O backend do projeto é totalmente gerenciado pelo Supabase.

#### a. Crie um Projeto no Supabase

1.  Acesse sua conta no Supabase e crie um novo projeto.
2.  Guarde a **URL do Projeto** e a chave **`anon` (public)**.

#### b. Configure o Cliente Supabase no Código

Abra o arquivo `src/integrations/supabase/client.ts` e substitua os valores das constantes `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` pelos dados do seu projeto.

#### c. Execute as Migrações do Banco de Dados

As migrações contêm toda a estrutura de tabelas, funções e políticas de segurança necessárias.

1.  No painel do seu projeto Supabase, vá para **SQL Editor**.
2.  Clique em **New query**.
3.  Navegue até a pasta `supabase/migrations/` neste repositório.
4.  **Copie e cole o conteúdo de CADA arquivo `.sql`**, um de cada vez, na ordem numérica, e execute no SQL Editor.

> **Importante:** Execute os scripts na ordem correta (ex: `0001_...`, `0002_...`, etc.) para evitar erros de dependência.

#### d. Configure o Supabase Storage

O sistema precisa de dois "buckets" para armazenar arquivos.

1.  No painel do Supabase, vá para **Storage**.
2.  Crie um novo bucket chamado `avatars`. Marque-o como **Public**.
3.  Crie outro bucket chamado `receipts`. Marque-o como **Public**.
4.  Crie um último bucket chamado `prizes`. Marque-o como **Public**.

#### e. Implante as Edge Functions

As funções de backend estão na pasta `supabase/functions/`. Para que elas funcionem em seu projeto, você precisa implantá-las.

A implantação de Edge Functions geralmente é feita através da [Supabase CLI](https://supabase.com/docs/guides/cli). Siga a documentação oficial para fazer o deploy das funções contidas no projeto.

---

Pronto! Com o frontend rodando e o backend Supabase configurado, o sistema estará totalmente funcional.