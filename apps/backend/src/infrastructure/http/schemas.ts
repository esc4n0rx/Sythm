import { z } from 'zod';

/** Limites de entrada. Mantidos aqui para serem reutilizados por testes e documentação. */
export const LIMITS = {
  /** Tamanho máximo (caracteres) de código .sythm aceito em compile/share. */
  codeChars: 200_000,
  /** bodyLimit global (bytes). */
  bodyBytes: 1_048_576,
  /** bodyLimit da rota de workspace (bytes), que carrega todos os projetos do usuário. */
  workspaceBytes: 5 * 1_048_576,
  passwordMin: 8,
  passwordMax: 128,
} as const;

const username = z
  .string()
  .trim()
  .min(3, 'Username deve ter entre 3 e 24 caracteres.')
  .max(24, 'Username deve ter entre 3 e 24 caracteres.')
  .regex(/^[\p{L}\p{N}_.-]+$/u, 'Username só pode conter letras, números, "_", "." e "-".');

const email = z
  .string()
  .trim()
  .max(254, 'E-mail inválido.')
  .email('E-mail inválido.')
  .transform((v) => v.toLowerCase());

const password = z
  .string()
  .min(LIMITS.passwordMin, `A senha deve ter pelo menos ${LIMITS.passwordMin} caracteres.`)
  .max(LIMITS.passwordMax, `A senha deve ter no máximo ${LIMITS.passwordMax} caracteres.`);

export const registerSchema = z.object({ username, email, password });

export const loginSchema = z.object({
  emailOrUsername: z.string().trim().min(1, 'Informe e-mail ou username.').max(254),
  // Sem regras de complexidade no login: apenas limita o tamanho para evitar abuso de scrypt.
  password: z.string().min(1, 'Informe a senha.').max(LIMITS.passwordMax),
});

export const compileSchema = z.object({
  code: z.string().max(LIMITS.codeChars, `O código excede ${LIMITS.codeChars} caracteres.`),
});

export const workspaceSchema = z.object({
  workspace: z.record(z.string(), z.unknown()),
});

export const addFriendSchema = z.object({
  identifier: z.string().trim().min(1, 'Informe o username ou e-mail do amigo.').max(254),
});

export const friendParamsSchema = z.object({ friendId: z.string().uuid('friendId inválido.') });

export const shareSchema = z.object({
  friendId: z.string().uuid('friendId inválido.'),
  title: z.string().trim().max(120).optional(),
  code: z.string().max(LIMITS.codeChars, `O código excede ${LIMITS.codeChars} caracteres.`),
});
