# Backend (`@sythm/backend`)

API Fastify 5 + PostgreSQL. Responsável por compilação remota, contas, workspace na nuvem e amigos/compartilhamento.

## Estrutura

```
apps/backend/src
├── main.ts                         # bootstrap: config → pool → migrations → servidor
├── config.ts                       # leitura/validação de env (zod); falha cedo em produção
├── application/ports/IAuthStore.ts # contrato de persistência + AppError
└── infrastructure
    ├── auth/        passwords.ts (scrypt async) · TokenService.ts (HMAC, exp, versão)
    ├── db/          pool.ts (pg + migrations) · migrations.ts · migrate.ts · import-json.ts
    ├── http/        server.ts (rotas) · schemas.ts (zod + LIMITS)
    └── storage/     PostgresAuthStore.ts
apps/backend/tests   # vitest: config/token, rotas (InMemoryAuthStore), integração Postgres
```

`buildServer({ config, store })` recebe a persistência por injeção, o que permite testar todas as rotas sem banco.

## Banco de dados (PostgreSQL)

Qualquer Postgres >= 14 serve (o driver é o `pg`, via `DATABASE_URL`). Provedores gerenciados normalmente exigem TLS: use `DATABASE_SSL=true`.

```bash
docker compose up -d db                       # Postgres local (user/senha/db: sythm)
cp apps/backend/.env.example apps/backend/.env
pnpm dev                                       # aplica migrations ao iniciar
```

> **pgx.dev**: a página do serviço não pôde ser lida durante a implementação (renderiza só no cliente), então a integração foi feita de forma agnóstica de provedor. Basta copiar a connection string do painel para `DATABASE_URL`. Se o provedor exigir TLS, defina `DATABASE_SSL=true`. Se for um banco descartável/efêmero, lembre que dados e contas somem junto com ele.

### Esquema

| Tabela | Conteúdo |
| --- | --- |
| `users` | `id uuid`, `username` (único, case-insensitive), `email` (único), `password_hash`, `token_version`, `created_at` |
| `workspaces` | `user_id` → `data jsonb` (todo o workspace do usuário), `updated_at` |
| `friendships` | pares `(user_id, friend_id)` nas duas direções (amizade simétrica) |
| `shared_snippets` | código compartilhado entre amigos (`from_user_id`, `to_user_id`, `title`, `code`) |
| `schema_migrations` | controle das migrations aplicadas |

### Migrations

Ficam em `src/infrastructure/db/migrations.ts` como lista ordenada por `id`. São aplicadas na inicialização (ou com `pnpm --filter @sythm/backend migrate`), cada uma em transação e sob *advisory lock* (seguro com várias instâncias). **Nunca edite uma migration publicada**: adicione uma nova com o próximo `id`.

### Migrando do JSON legado

```bash
pnpm --filter @sythm/backend import:json data/sythm-db.json
```

Idempotente. Os hashes de senha têm o mesmo formato (`salt:scrypt`), então os usuários mantêm suas senhas. Os tokens antigos deixam de valer (o formato mudou): é preciso fazer login de novo.

## Configuração (variáveis de ambiente)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` ativa as validações estritas |
| `PORT` / `HOST` | `3001` / `0.0.0.0` | Endereço de escuta |
| `DATABASE_URL` | – | Connection string. **Obrigatória em produção** |
| `DATABASE_SSL` | `false` | `true` para TLS |
| `DATABASE_POOL_MAX` | `10` | Tamanho do pool |
| `SYTHM_AUTH_SECRET` | – | **Obrigatório em produção, >= 32 chars.** Em dev, vazio gera um segredo efêmero |
| `SYTHM_TOKEN_TTL_HOURS` | `168` | Validade do token |
| `CORS_ORIGINS` | – | Allowlist separada por vírgula. Em produção, vazio = bloqueia cross-origin |
| `TRUST_PROXY` | `false` | `true` atrás de proxy/LB, para o rate limit usar o IP real |
| `RATE_LIMIT_MAX` | `300` | Requisições/min por IP (global) |
| `RATE_LIMIT_AUTH_MAX` | `10` | Requisições/min por IP em login e registro |

## Segurança e limites

- **Segredo**: sem valor padrão no código. Produção não inicia sem ele.
- **Rate limit**: global + limite estrito em `login`/`register`; excedido retorna `429`.
- **Entrada**: `bodyLimit` 1 MB (5 MB no workspace); `code` <= 200.000 caracteres; todo body/param passa por schema `zod` (`schemas.ts`). O compilador já limita a 2000 eventos e profundidade 16 de `PERFORM`.
- **Senhas**: 8–128 caracteres, `scrypt` assíncrono. O login gasta o mesmo tempo com usuário inexistente (evita enumeração por timing).
- **Tokens**: HMAC-SHA256 com `exp` (7 dias) e `ver`. `POST /api/auth/refresh` renova; `POST /api/auth/logout-all` incrementa `token_version` e invalida todos os tokens do usuário. Cada requisição autenticada consulta o usuário no banco para conferir a versão.
- **CORS/headers**: allowlist por env e `@fastify/helmet`.
- **Logs**: o header `Authorization` é omitido dos logs.

## Testes

```bash
pnpm --filter @sythm/backend test                                   # sem banco (18 testes)
TEST_DATABASE_URL=postgres://... pnpm --filter @sythm/backend test  # + integração (recria o schema public!)
```

Use um banco **descartável** para `TEST_DATABASE_URL`: o teste executa `DROP SCHEMA public CASCADE`. No CI isso roda contra um serviço Postgres do GitHub Actions.
