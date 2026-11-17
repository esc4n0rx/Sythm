import type { SythmWorkspaceState } from '../storage/ProjectStorage';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface SharedSnippetItem {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  title: string;
  code: string;
  createdAt: string;
}

const TOKEN_STORAGE_KEY = 'sythm.auth.token.v1';
const USER_STORAGE_KEY = 'sythm.auth.user.v1';

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: AuthUser): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage errors
  }
}

export function clearStoredSession(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new ApiError(data.error || `Erro HTTP ${res.status}`, res.status);
  }
  return data;
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const data = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  setStoredSession(data.token, data.user);
  return data;
}

export async function loginUser(
  emailOrUsername: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const data = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ emailOrUsername, password }),
  });
  setStoredSession(data.token, data.user);
  return data;
}

/**
 * Valida a sessão e renova o token (`/api/auth/refresh`). Só encerra a sessão local
 * quando o servidor responde 401; falhas de rede mantêm o usuário logado (modo offline).
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  if (!getStoredToken()) return null;
  try {
    const data = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/refresh', {
      method: 'POST',
    });
    setStoredSession(data.token, data.user);
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearStoredSession();
      return null;
    }
    return getStoredUser();
  }
}

/** Revoga todos os tokens do usuário (logout em todos os dispositivos) e limpa a sessão local. */
export async function logoutAllDevices(): Promise<void> {
  try {
    await apiRequest<{ ok: boolean }>('/api/auth/logout-all', { method: 'POST' });
  } finally {
    clearStoredSession();
  }
}

export async function fetchCloudWorkspace(): Promise<SythmWorkspaceState | null> {
  const data = await apiRequest<{ workspace: SythmWorkspaceState | null }>('/api/workspace');
  return data.workspace;
}

export async function saveCloudWorkspace(workspace: SythmWorkspaceState): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/workspace', {
    method: 'PUT',
    body: JSON.stringify({ workspace }),
  });
}

export async function fetchFriends(): Promise<AuthUser[]> {
  const data = await apiRequest<{ friends: AuthUser[] }>('/api/friends');
  return data.friends;
}

export async function addFriendByIdentifier(identifier: string): Promise<AuthUser> {
  const data = await apiRequest<{ friend: AuthUser }>('/api/friends', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
  return data.friend;
}

export async function removeFriendById(friendId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/friends/${encodeURIComponent(friendId)}`, {
    method: 'DELETE',
  });
}

export async function shareCodeWithFriend(
  friendId: string,
  title: string,
  code: string,
): Promise<SharedSnippetItem> {
  const data = await apiRequest<{ snippet: SharedSnippetItem }>('/api/friends/share', {
    method: 'POST',
    body: JSON.stringify({ friendId, title, code }),
  });
  return data.snippet;
}

export async function fetchSharedCodes(): Promise<{
  inbox: SharedSnippetItem[];
  sent: SharedSnippetItem[];
}> {
  return apiRequest<{ inbox: SharedSnippetItem[]; sent: SharedSnippetItem[] }>('/api/friends/shared');
}
