export interface Migration {
  id: number;
  name: string;
  sql: string;
}

/**
 * Migrations versionadas, aplicadas em ordem. Nunca edite uma migration já
 * publicada: crie uma nova com o próximo `id`.
 */
export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'init',
    sql: `
      CREATE TABLE users (
        id            uuid PRIMARY KEY,
        username      text        NOT NULL,
        email         text        NOT NULL,
        password_hash text        NOT NULL,
        token_version integer     NOT NULL DEFAULT 0,
        created_at    timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));
      CREATE UNIQUE INDEX users_email_key ON users (email);

      CREATE TABLE workspaces (
        user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data       jsonb       NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- Amizade é simétrica: guardamos as duas direções.
      CREATE TABLE friendships (
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, friend_id),
        CHECK (user_id <> friend_id)
      );

      CREATE TABLE shared_snippets (
        id           uuid PRIMARY KEY,
        from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title        text NOT NULL,
        code         text NOT NULL,
        created_at   timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX shared_snippets_to_idx   ON shared_snippets (to_user_id, created_at DESC);
      CREATE INDEX shared_snippets_from_idx ON shared_snippets (from_user_id, created_at DESC);
    `,
  },
];
