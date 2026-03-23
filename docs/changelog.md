# Log de Alterações (Changelog)

## [2026-03-23] - Estabilização de Pagamentos e Governança

### Alterações
- **Módulo de Pagamento:** Substituída a lógica de redirecionamento manual por `window.open` com política de `noreferrer`.
- **Documentação:** Criado o arquivo `docs/25_fix_dom_manipulation_error.md`.
- **Infraestrutura:** Realizado o Rebuild completo do ambiente para sincronização de arquivos.

### Motivo
- Correção do erro `Failed to execute 'removeChild' on 'Node'` que causava o travamento total da interface ao tentar processar pagamentos via Cartão de Crédito.

### Impactos
- **Esperados:** Estabilidade total na abertura do checkout e conformidade com as regras de segurança do PagBank.
- **Riscos:** Bloqueadores de Pop-up podem interferir na abertura da nova aba (tratado via feedback visual na UI).