import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

interface StoredUser extends PublicUser {
  passwordHash: string;
}

export interface SharedSnippetRecord {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  title: string;
  code: string;
  createdAt: string;
}

interface DbSchema {
  users: StoredUser[];
  workspaces: Record<string, unknown>;
  friends: Record<string, string[]>;
  sharedSnippets: SharedSnippetRecord[];
}

const DEFAULT_DB: DbSchema = {
  users: [],
  workspaces: {},
  friends: {},
  sharedSnippets: [],
};

const AUTH_SECRET = process.env.SYTHM_AUTH_SECRET || 'sythm-dev-secret-change-in-prod';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function signToken(userId: string): string {
  const payload = toBase64Url(
    JSON.stringify({
      sub: userId,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
    }),
  );
  const sig = createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (!parsed.sub || (parsed.exp && parsed.exp < Date.now())) {
      return null;
    }
    return parsed.sub;
  } catch {
    return null;
  }
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export class AuthStore {
  private readonly dbPath: string;
  private cache: DbSchema | null = null;

  constructor(dbPath?: string) {
    this.dbPath =
      dbPath ||
      process.env.SYTHM_DB_PATH ||
      path.resolve(process.cwd(), 'data', 'sythm-db.json');
  }

  private async load(): Promise<DbSchema> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.dbPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DbSchema>;
      this.cache = {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        workspaces: parsed.workspaces && typeof parsed.workspaces === 'object' ? parsed.workspaces : {},
        friends: parsed.friends && typeof parsed.friends === 'object' ? parsed.friends : {},
        sharedSnippets: Array.isArray(parsed.sharedSnippets) ? parsed.sharedSnippets : [],
      };
    } catch {
      this.cache = structuredClone(DEFAULT_DB);
    }
    return this.cache;
  }

  private async save(db: DbSchema): Promise<void> {
    this.cache = db;
    await mkdir(path.dirname(this.dbPath), { recursive: true });
    await writeFile(this.dbPath, JSON.stringify(db, null, 2), 'utf8');
  }

  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<{ token: string; user: PublicUser }> {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3 || cleanUsername.length > 24) {
      throw new Error('Username deve ter entre 3 e 24 caracteres.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('E-mail inválido.');
    }
    if (password.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }

    const db = await this.load();
    if (db.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      throw new Error('Este username já está em uso.');
    }
    if (db.users.some((u) => u.email === cleanEmail)) {
      throw new Error('Este e-mail já está cadastrado.');
    }

    const newUser: StoredUser = {
      id: randomUUID(),
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    db.friends[newUser.id] = [];
    await this.save(db);

    return {
      token: signToken(newUser.id),
      user: toPublicUser(newUser),
    };
  }

  async login(
    emailOrUsername: string,
    password: string,
  ): Promise<{ token: string; user: PublicUser }> {
    const identifier = emailOrUsername.trim().toLowerCase();
    const db = await this.load();
    const user = db.users.find(
      (u) => u.email === identifier || u.username.toLowerCase() === identifier,
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error('Credenciais inválidas.');
    }

    return {
      token: signToken(user.id),
      user: toPublicUser(user),
    };
  }

  async getUserById(userId: string): Promise<PublicUser | null> {
    const db = await this.load();
    const user = db.users.find((u) => u.id === userId);
    return user ? toPublicUser(user) : null;
  }

  async getWorkspace(userId: string): Promise<unknown | null> {
    const db = await this.load();
    return db.workspaces[userId] ?? null;
  }

  async saveWorkspace(userId: string, workspace: unknown): Promise<void> {
    const db = await this.load();
    db.workspaces[userId] = workspace;
    await this.save(db);
  }

  async listFriends(userId: string): Promise<PublicUser[]> {
    const db = await this.load();
    const friendIds = db.friends[userId] ?? [];
    return friendIds
      .map((id) => db.users.find((u) => u.id === id))
      .filter((u): u is StoredUser => Boolean(u))
      .map(toPublicUser);
  }

  async addFriend(userId: string, identifier: string): Promise<PublicUser> {
    const clean = identifier.trim().toLowerCase();
    const db = await this.load();
    const target = db.users.find(
      (u) => u.email === clean || u.username.toLowerCase() === clean,
    );
    if (!target) {
      throw new Error('Usuário não encontrado com esse username ou e-mail.');
    }
    if (target.id === userId) {
      throw new Error('Você não pode adicionar a si mesmo.');
    }

    const myFriends = db.friends[userId] ?? [];
    if (myFriends.includes(target.id)) {
      throw new Error(`${target.username} já está na sua lista de amigos.`);
    }

    db.friends[userId] = [...myFriends, target.id];
    const theirFriends = db.friends[target.id] ?? [];
    if (!theirFriends.includes(userId)) {
      db.friends[target.id] = [...theirFriends, userId];
    }

    await this.save(db);
    return toPublicUser(target);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const db = await this.load();
    db.friends[userId] = (db.friends[userId] ?? []).filter((id) => id !== friendId);
    db.friends[friendId] = (db.friends[friendId] ?? []).filter((id) => id !== userId);
    await this.save(db);
  }

  async shareCodeWithFriend(
    fromUserId: string,
    toUserId: string,
    title: string,
    code: string,
  ): Promise<SharedSnippetRecord> {
    const db = await this.load();
    const fromUser = db.users.find((u) => u.id === fromUserId);
    const toUser = db.users.find((u) => u.id === toUserId);
    if (!fromUser || !toUser) {
      throw new Error('Usuário de origem ou destino não encontrado.');
    }

    const record: SharedSnippetRecord = {
      id: randomUUID(),
      fromUserId,
      fromUsername: fromUser.username,
      toUserId,
      toUsername: toUser.username,
      title: title.trim() || 'Shared Track',
      code,
      createdAt: new Date().toISOString(),
    };

    db.sharedSnippets.unshift(record);
    if (db.sharedSnippets.length > 500) {
      db.sharedSnippets = db.sharedSnippets.slice(0, 500);
    }
    await this.save(db);
    return record;
  }

  async getSharedCodes(
    userId: string,
  ): Promise<{ inbox: SharedSnippetRecord[]; sent: SharedSnippetRecord[] }> {
    const db = await this.load();
    return {
      inbox: db.sharedSnippets.filter((s) => s.toUserId === userId),
      sent: db.sharedSnippets.filter((s) => s.fromUserId === userId),
    };
  }
}
