import {
  Cloud,
  Code2,
  LogIn,
  LogOut,
  Play,
  Send,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  type AuthUser,
  type SharedSnippetItem,
  addFriendByIdentifier,
  clearStoredSession,
  fetchFriends,
  fetchSharedCodes,
  loginUser,
  registerUser,
  removeFriendById,
  shareCodeWithFriend,
} from '../../infrastructure/api/AuthClient';

interface AuthProfileModalProps {
  isOpen: boolean;
  user: AuthUser | null;
  currentTitle: string;
  currentCode: string;
  initialTab?: 'profile' | 'friends';
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
  onLogout: () => void;
  onOpenSharedCode: (title: string, code: string, fromUsername: string) => void;
  onPreviewCode: (code: string) => void;
}

export function AuthProfileModal({
  isOpen,
  user,
  currentTitle,
  currentCode,
  initialTab = 'profile',
  onClose,
  onAuthenticated,
  onLogout,
  onOpenSharedCode,
  onPreviewCode,
}: AuthProfileModalProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [profileTab, setProfileTab] = useState<'profile' | 'friends'>(initialTab);
  const [friends, setFriends] = useState<AuthUser[]>([]);
  const [inbox, setInbox] = useState<SharedSnippetItem[]>([]);
  const [friendInput, setFriendInput] = useState('');
  const [friendMessage, setFriendMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProfileTab(initialTab);
      setAuthError(null);
      setFriendMessage(null);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || !user) return;
    setIsLoadingFriends(true);
    void Promise.all([fetchFriends(), fetchSharedCodes()])
      .then(([loadedFriends, shared]) => {
        setFriends(loadedFriends);
        setInbox(shared.inbox);
      })
      .catch(() => {
        // Ignore network errors on background load
      })
      .finally(() => setIsLoadingFriends(false));
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);
    try {
      const res =
        authMode === 'register'
          ? await registerUser(username, email, password)
          : await loginUser(emailOrUsername, password);
      onAuthenticated(res.user);
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Erro de autenticação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendInput.trim()) return;
    setFriendMessage(null);
    try {
      const added = await addFriendByIdentifier(friendInput.trim());
      setFriends((prev) => [...prev, added]);
      setFriendInput('');
      setFriendMessage({ type: 'ok', text: `@${added.username} adicionado aos amigos!` });
    } catch (err) {
      setFriendMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao adicionar amigo.',
      });
    }
  };

  const handleRemoveFriend = async (friend: AuthUser) => {
    try {
      await removeFriendById(friend.id);
      setFriends((prev) => prev.filter((f) => f.id !== friend.id));
      setFriendMessage({ type: 'ok', text: `@${friend.username} removido.` });
    } catch (err) {
      setFriendMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao remover amigo.',
      });
    }
  };

  const handleShareWithFriend = async (friend: AuthUser) => {
    setFriendMessage(null);
    try {
      await shareCodeWithFriend(friend.id, currentTitle, currentCode);
      setFriendMessage({
        type: 'ok',
        text: `Código "${currentTitle}" enviado para @${friend.username}!`,
      });
    } catch (err) {
      setFriendMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao compartilhar código.',
      });
    }
  };

  const handleLogoutClick = () => {
    clearStoredSession();
    onLogout();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={user ? 'Perfil e Amigos' : 'Login e Registro'}
    >
      <div className="sythm-border sythm-bg-sidebar flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="sythm-border flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {user ? (
              <User className="h-4 w-4 text-[#64d2ff]" />
            ) : (
              <LogIn className="h-4 w-4 text-[#64d2ff]" />
            )}
            <h2 className="text-sm font-bold text-[var(--sythm-text-primary)]">
              {user ? `Conta Sythm · @${user.username}` : 'Entrar ou Criar Conta'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-[#aeaeb2] hover:bg-white/10 hover:text-white"
            aria-label="Fechar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!user ? (
          <div className="p-5">
            <div className="mb-4 flex rounded-lg bg-[#18191d] p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                }}
                className={`flex-1 cursor-pointer rounded-md py-1.5 text-xs font-semibold transition ${
                  authMode === 'login'
                    ? 'bg-[#0a84ff] text-white'
                    : 'text-[#aeaeb2] hover:text-white'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError(null);
                }}
                className={`flex-1 cursor-pointer rounded-md py-1.5 text-xs font-semibold transition ${
                  authMode === 'register'
                    ? 'bg-[#0a84ff] text-white'
                    : 'text-[#aeaeb2] hover:text-white'
                }`}
              >
                Registrar
              </button>
            </div>

            <form onSubmit={(e) => void handleAuthSubmit(e)} className="space-y-3">
              {authMode === 'register' ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-[#aeaeb2]">Username</label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={24}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ex: paulo_synth"
                      className="w-full rounded-md border border-[#4a4d55] bg-[#18191d] px-3 py-2 text-xs text-white outline-none focus:border-[#0a84ff]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[#aeaeb2]">E-mail</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      className="w-full rounded-md border border-[#4a4d55] bg-[#18191d] px-3 py-2 text-xs text-white outline-none focus:border-[#0a84ff]"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-xs text-[#aeaeb2]">Username ou E-mail</label>
                  <input
                    type="text"
                    required
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    placeholder="username ou e-mail"
                    className="w-full rounded-md border border-[#4a4d55] bg-[#18191d] px-3 py-2 text-xs text-white outline-none focus:border-[#0a84ff]"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs text-[#aeaeb2]">Senha</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mínimo 8 caracteres"
                  className="w-full rounded-md border border-[#4a4d55] bg-[#18191d] px-3 py-2 text-xs text-white outline-none focus:border-[#0a84ff]"
                />
              </div>

              {authError && (
                <div className="rounded-md border border-[#ff453a]/40 bg-[#ff453a]/15 px-3 py-2 text-xs text-[#ff8a80]">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0a84ff] py-2 text-xs font-semibold text-white transition hover:bg-[#0071e3] disabled:opacity-50"
              >
                {authMode === 'register' ? (
                  <>
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>{isSubmitting ? 'Criando conta...' : 'Criar Conta'}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-3.5 w-3.5" />
                    <span>{isSubmitting ? 'Entrando...' : 'Entrar'}</span>
                  </>
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] text-[#8e8e93]">
              Sem conta, seus projetos ficam salvos localmente no navegador. Ao logar, seus projetos sincronizam na sua conta e você pode compartilhar códigos com amigos.
            </p>
          </div>
        ) : (
          <>
            {/* Profile / Friends Tabs */}
            <div className="sythm-border flex border-b px-5 pt-2">
              <button
                type="button"
                onClick={() => setProfileTab('profile')}
                className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                  profileTab === 'profile'
                    ? 'border-[#0a84ff] text-[#64d2ff]'
                    : 'border-transparent text-[#aeaeb2] hover:text-white'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>Perfil</span>
              </button>
              <button
                type="button"
                onClick={() => setProfileTab('friends')}
                className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                  profileTab === 'friends'
                    ? 'border-[#0a84ff] text-[#64d2ff]'
                    : 'border-transparent text-[#aeaeb2] hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Amigos ({friends.length})</span>
                {inbox.length > 0 && (
                  <span className="rounded-full bg-[#30d158]/20 px-1.5 font-mono-code text-[10px] text-[#6ee787]">
                    {inbox.length}
                  </span>
                )}
              </button>
            </div>

            <div className="xcode-scroll flex-1 overflow-y-auto p-5">
              {profileTab === 'profile' ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#3d3f45] bg-[#1e1f23] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0a84ff]/20 font-mono-code text-base font-bold text-[#64d2ff]">
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">@{user.username}</div>
                        <div className="text-xs text-[#aeaeb2]">{user.email}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 rounded-md border border-[#2f6f44]/50 bg-[#1b2e22] px-3 py-2 text-xs text-[#7ae582]">
                      <Cloud className="h-4 w-4 shrink-0" />
                      <span>
                        Sincronização ativa: suas pastas e arquivos no Project Navigator estão salvos na sua conta.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-[#ff453a]/40 bg-[#ff453a]/15 px-4 py-2 text-xs font-semibold text-[#ff8a80] transition hover:bg-[#ff453a]/25"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sair da Conta</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Add Friend */}
                  <form onSubmit={(e) => void handleAddFriend(e)} className="flex gap-2">
                    <input
                      type="text"
                      value={friendInput}
                      onChange={(e) => setFriendInput(e.target.value)}
                      placeholder="Adicionar amigo por username ou e-mail..."
                      className="min-w-0 flex-1 rounded-md border border-[#4a4d55] bg-[#18191d] px-3 py-1.5 text-xs text-white outline-none focus:border-[#0a84ff]"
                    />
                    <button
                      type="submit"
                      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-[#0a84ff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0071e3]"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </form>

                  {friendMessage && (
                    <div
                      className={`rounded-md border px-3 py-2 text-xs ${
                        friendMessage.type === 'ok'
                          ? 'border-[#2f6f44] bg-[#1b2e22] text-[#7ae582]'
                          : 'border-[#ff453a]/40 bg-[#ff453a]/15 text-[#ff8a80]'
                      }`}
                    >
                      {friendMessage.text}
                    </div>
                  )}

                  {/* Friends List */}
                  <div>
                    <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-[#aeaeb2] uppercase">
                      Meus Amigos
                    </h3>
                    {isLoadingFriends ? (
                      <p className="text-xs text-[#8e8e93]">Carregando...</p>
                    ) : friends.length === 0 ? (
                      <p className="rounded-md border border-dashed border-[#3d3f45] p-3 text-xs text-[#8e8e93]">
                        Nenhum amigo adicionado ainda. Adicione pelo username ou e-mail acima.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {friends.map((friend) => (
                          <li
                            key={friend.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[#3d3f45] bg-[#1e1f23] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-white">
                                @{friend.username}
                              </div>
                              <div className="truncate text-[10px] text-[#8e8e93]">
                                {friend.email}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleShareWithFriend(friend)}
                                title={`Enviar "${currentTitle}" para @${friend.username}`}
                                className="flex cursor-pointer items-center gap-1 rounded bg-[#b281eb]/20 px-2 py-1 text-[11px] font-medium text-[#d0a8ff] hover:bg-[#b281eb]/30"
                              >
                                <Send className="h-3 w-3" />
                                <span>Enviar Código</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRemoveFriend(friend)}
                                title="Remover amigo"
                                className="cursor-pointer rounded p-1 text-[#8e8e93] hover:bg-[#ff453a]/20 hover:text-[#ff8a80]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Received Shared Codes */}
                  <div>
                    <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-[#aeaeb2] uppercase">
                      Códigos Recebidos ({inbox.length})
                    </h3>
                    {inbox.length === 0 ? (
                      <p className="text-xs text-[#8e8e93]">
                        Nenhum código compartilhado com você ainda.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {inbox.map((item) => (
                          <li
                            key={item.id}
                            className="rounded-lg border border-[#3d3f45] bg-[#1e1f23] p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-semibold text-white">
                                  {item.title}
                                </div>
                                <div className="text-[10px] text-[#aeaeb2]">
                                  Enviado por <span className="text-[#64d2ff]">@{item.fromUsername}</span>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onPreviewCode(item.code)}
                                  className="flex cursor-pointer items-center gap-1 rounded bg-[#30d158]/20 px-2 py-1 text-[11px] font-medium text-[#6ee787] hover:bg-[#30d158]/30"
                                >
                                  <Play className="h-3 w-3" />
                                  <span>Tocar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenSharedCode(item.title, item.code, item.fromUsername);
                                    onClose();
                                  }}
                                  className="flex cursor-pointer items-center gap-1 rounded bg-[#0a84ff] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#0071e3]"
                                >
                                  <Code2 className="h-3 w-3" />
                                  <span>Abrir</span>
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
