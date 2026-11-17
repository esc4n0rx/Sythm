import { randomUUID } from 'node:crypto';
import {
  AppError,
  type AuthenticatedUser,
  type IAuthStore,
  type PublicUser,
  type SharedSnippetRecord,
} from '../src/application/ports/IAuthStore.js';
import { hashPassword, verifyPassword } from '../src/infrastructure/auth/passwords.js';

interface U extends PublicUser {
  passwordHash: string;
  tokenVersion: number;
}

/** Implementação em memória de IAuthStore, usada nos testes HTTP (sem banco). */
export class InMemoryAuthStore implements IAuthStore {
  users: U[] = [];
  workspaces = new Map<string, unknown>();
  friends = new Map<string, Set<string>>();
  snippets: SharedSnippetRecord[] = [];

  private view(u: U): AuthenticatedUser {
    const { passwordHash: _p, tokenVersion, ...user } = u;
    return { user, tokenVersion };
  }

  async register(username: string, email: string, password: string) {
    if (this.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      throw new AppError(409, 'Este username já está em uso.');
    }
    if (this.users.some((u) => u.email === email)) {
      throw new AppError(409, 'Este e-mail já está cadastrado.');
    }
    const u: U = {
      id: randomUUID(),
      username,
      email,
      createdAt: new Date().toISOString(),
      passwordHash: await hashPassword(password),
      tokenVersion: 0,
    };
    this.users.push(u);
    return this.view(u);
  }

  async login(emailOrUsername: string, password: string) {
    const id = emailOrUsername.toLowerCase();
    const u = this.users.find((x) => x.email === id || x.username.toLowerCase() === id);
    if (!u || !(await verifyPassword(password, u.passwordHash))) {
      throw new AppError(401, 'Credenciais inválidas.');
    }
    return this.view(u);
  }

  async getAuthenticatedUser(userId: string) {
    const u = this.users.find((x) => x.id === userId);
    return u ? this.view(u) : null;
  }

  async revokeTokens(userId: string) {
    const u = this.users.find((x) => x.id === userId);
    if (!u) throw new AppError(404, 'Usuário não encontrado.');
    return ++u.tokenVersion;
  }

  async getWorkspace(userId: string) {
    return this.workspaces.get(userId) ?? null;
  }
  async saveWorkspace(userId: string, workspace: unknown) {
    this.workspaces.set(userId, workspace);
  }

  async listFriends(userId: string) {
    return [...(this.friends.get(userId) ?? [])]
      .map((id) => this.users.find((u) => u.id === id))
      .filter((u): u is U => Boolean(u))
      .map((u) => this.view(u).user);
  }

  async addFriend(userId: string, identifier: string) {
    const id = identifier.toLowerCase();
    const t = this.users.find((x) => x.email === id || x.username.toLowerCase() === id);
    if (!t) throw new AppError(404, 'Usuário não encontrado com esse username ou e-mail.');
    if (t.id === userId) throw new AppError(400, 'Você não pode adicionar a si mesmo.');
    const mine = this.friends.get(userId) ?? new Set();
    if (mine.has(t.id)) throw new AppError(409, `${t.username} já está na sua lista de amigos.`);
    mine.add(t.id);
    this.friends.set(userId, mine);
    const theirs = this.friends.get(t.id) ?? new Set();
    theirs.add(userId);
    this.friends.set(t.id, theirs);
    return this.view(t).user;
  }

  async removeFriend(userId: string, friendId: string) {
    this.friends.get(userId)?.delete(friendId);
    this.friends.get(friendId)?.delete(userId);
  }

  async shareCodeWithFriend(from: string, to: string, title: string, code: string) {
    if (!this.friends.get(from)?.has(to)) {
      throw new AppError(403, 'Você só pode compartilhar código com amigos.');
    }
    const f = this.users.find((u) => u.id === from)!;
    const t = this.users.find((u) => u.id === to)!;
    const rec: SharedSnippetRecord = {
      id: randomUUID(),
      fromUserId: from,
      fromUsername: f.username,
      toUserId: to,
      toUsername: t.username,
      title: title.trim() || 'Shared Track',
      code,
      createdAt: new Date().toISOString(),
    };
    this.snippets.unshift(rec);
    return rec;
  }

  async getSharedCodes(userId: string) {
    return {
      inbox: this.snippets.filter((s) => s.toUserId === userId),
      sent: this.snippets.filter((s) => s.fromUserId === userId),
    };
  }

  async close() {}
}
