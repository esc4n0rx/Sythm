export interface PublicUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
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

/** Erro de regra de negócio com status HTTP associado. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export interface AuthenticatedUser {
  user: PublicUser;
  /** Incrementado para revogar todos os tokens emitidos anteriormente. */
  tokenVersion: number;
}

export interface IAuthStore {
  register(username: string, email: string, password: string): Promise<AuthenticatedUser>;
  login(emailOrUsername: string, password: string): Promise<AuthenticatedUser>;
  getAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null>;
  /** Revoga todos os tokens do usuário e devolve a nova versão. */
  revokeTokens(userId: string): Promise<number>;

  getWorkspace(userId: string): Promise<unknown | null>;
  saveWorkspace(userId: string, workspace: unknown): Promise<void>;

  listFriends(userId: string): Promise<PublicUser[]>;
  addFriend(userId: string, identifier: string): Promise<PublicUser>;
  removeFriend(userId: string, friendId: string): Promise<void>;

  shareCodeWithFriend(
    fromUserId: string,
    toUserId: string,
    title: string,
    code: string,
  ): Promise<SharedSnippetRecord>;
  getSharedCodes(
    userId: string,
  ): Promise<{ inbox: SharedSnippetRecord[]; sent: SharedSnippetRecord[] }>;

  close(): Promise<void>;
}
