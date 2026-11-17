# Registro de decisões e andamento

Documento vivo. Cada item registra *o que* foi feito, *por quê* e o que ficou pendente.

## Fase 1 — Correções da análise inicial

| # | Problema | Estado | Notas |
| --- | --- | --- | --- |
| 1 | Segredo de assinatura com valor padrão | ✅ | `config.ts` exige >= 32 chars em produção |
| 2 | Persistência em arquivo JSON | ✅ | Postgres (`pg`) + migrations + importador do JSON |
| 3 | Sem rate limit / limite de body | ✅ | `@fastify/rate-limit`, `bodyLimit`, limites zod |
| 4 | CORS aberto | ✅ | Allowlist por `CORS_ORIGINS` |
| 5 | Token de 30 dias no localStorage | 🟡 | TTL 7 dias + refresh + revogação. **Continua em `localStorage`** (ver abaixo) |
| 6 | Senha mínima fraca / validação | ✅ | 8–128 chars, e-mail e username validados. Sem verificação de e-mail ainda |
| 7 | Arquivos grandes demais | ⏳ | Parser (2346 linhas), planner (1580), `WebAudioEngine`, `App.tsx` |
| 8 | Cobertura de testes só no core | 🟡 | Backend coberto. Faltam parser por comando, transcritor, `ProjectStorage` |
| 9 | CI sem lint/backend | 🟡 | Lint + testes do backend com Postgres no CI. Falta e2e (Playwright) |

### Decisões

- **Driver `pg` em vez de ORM.** O esquema é pequeno e a interface `IAuthStore` isola a persistência; evita uma dependência pesada. Trocar para Drizzle/Prisma depois só afeta `PostgresAuthStore`.
- **pgx.dev.** A página não renderizou para leitura automática (SPA). Usamos só `DATABASE_URL`, compatível com qualquer Postgres. Se o pgx.dev for um banco descartável, as contas não persistem entre recriações: avaliar para produção.
- **Token continua em `localStorage`.** Migrar para cookie `httpOnly` exige `credentials: 'include'`, proteção CSRF (SameSite/token) e CORS com origem exata. Fica como evolução; por ora mitigamos com TTL curto, refresh e revogação.
- **Migrations em TypeScript** (não arquivos `.sql`), para não precisar copiá-las no build.
- **Compartilhamento só entre amigos.** Antes, qualquer `userId` existente recebia o código.
- **Lint**: `react-hooks` com apenas `rules-of-hooks` e `exhaustive-deps`. As regras do React Compiler (`set-state-in-effect`, `preserve-manual-memoization`) acusam padrões existentes e ficam para uma limpeza dedicada. Prettier configurado, mas o repo ainda **não** foi reformatado em massa (evita um diff gigante); `format:check` não está no CI.

### Pendências conhecidas

- Verificação de e-mail e recuperação de senha.
- Rate limit por conta (hoje só por IP).
- Rodar as migrations e a API contra o pgx.dev real quando houver credenciais.

## Fase 2 — Linguagem e compilador

Ordem combinada: (1) LSP no browser → (2) `COPY`/módulos → (3) variáveis e expressões → (4) teoria musical → (5) mini-notação de padrões.

### 2.1 LSP no browser — concluído (UI sem teste manual)

Detalhes em [language-service.md](./language-service.md).

- **Serviço no `@sythm/core`**, e não no frontend: lógica pura, testável (28 testes) e reutilizável pelo backend. Antes ficava em `sythmEditorLanguage.ts`, acoplado à UI e sem testes.
- **Baseado em tokens, não na AST**: o parser aborta no primeiro erro de sintaxe; o lexer não. Assim hover, definição e rename seguem funcionando com o código quebrado.
- **Sem JSON-RPC.** "LSP" aqui significa o conjunto de recursos, chamados in-process. Um servidor LSP real fica como evolução.
- **Achado**: o quick-fix de ponto final do editor antigo não funcionava (ver language-service.md).
- **Pendente**: painel de outline, completion mais contextual (`PATTERN`, `PLAY SAMPLE`), teste manual/e2e da interação no navegador.

### 2.2 `COPY` (imports/módulos) — concluído (UI sem teste manual)

Detalhes em [copy.md](./copy.md).

- **Fonte dos arquivos: `ProjectStorage`** (decisão do usuário). O core não conhece o storage: recebe um `CopyResolver` injetado; o frontend o monta a partir do workspace.
- **Expansão textual com mapa de origem**, e não na AST/tokens: o lexer/parser/planner ficaram intactos e continuam recebendo uma string. As linhas são traduzidas de volta depois (diagnósticos, playhead, sliders).
- **Eventos de um arquivo incluído apontam para a linha do `COPY`**, não para a do `PERFORM`: nascem no corpo da SECTION, que está na biblioteca.
- **Expansão no cliente**, antes do `/api/compile`: o backend não tem acesso ao workspace do usuário.
- **`COPY` por linha** (regex), não por token: simples e previsível; o custo é não aceitar `COPY` na mesma linha de outro comando.
- **Risco evitado**: `updateControlValueInCode` reescreve o código usando `declarationLine`. Com `COPY` essa linha seria a do `COPY`; por isso `ControlDescriptor.sourceFile` bloqueia a edição.
- **Achado**: `suggestSimilar` comparava maiúsculas com minúsculas e nunca sugeria nomes de arquivo; corrigido.
- **Frontend ganhou Vitest** (9 testes), o primeiro runner da app; entra no `pnpm test` e no CI.
- **Pendente**: `COPY` em links compartilhados por URL; `REPLACING`; teste manual/e2e no navegador; biblioteca de exemplo embutida no workspace padrão.
