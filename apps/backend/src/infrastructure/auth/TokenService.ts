import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TokenClaims {
  userId: string;
  tokenVersion: number;
}

interface TokenPayload {
  sub: string;
  ver: number;
  iat: number;
  exp: number;
}

/** Token assinado com HMAC-SHA256 (`payload.assinatura`), com expiração e versão para revogação. */
export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlMs: number,
  ) {}

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  issue(userId: string, tokenVersion: number): string {
    const now = Date.now();
    const body: TokenPayload = { sub: userId, ver: tokenVersion, iat: now, exp: now + this.ttlMs };
    const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  verify(token: string): TokenClaims | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts as [string, string];
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(this.sign(payload));
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
    try {
      const parsed = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as Partial<TokenPayload>;
      if (typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
        return null;
      }
      return { userId: parsed.sub, tokenVersion: typeof parsed.ver === 'number' ? parsed.ver : 0 };
    } catch {
      return null;
    }
  }
}
