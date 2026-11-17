import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';
import { TokenService } from '../src/infrastructure/auth/TokenService.js';

describe('loadConfig', () => {
  it('exige segredo forte e DATABASE_URL em produção', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(ConfigError);
    expect(() =>
      loadConfig({ NODE_ENV: 'production', SYTHM_AUTH_SECRET: 'curto', DATABASE_URL: 'postgres://x' }),
    ).toThrow(/SYTHM_AUTH_SECRET/);
    expect(() =>
      loadConfig({ NODE_ENV: 'production', SYTHM_AUTH_SECRET: 'x'.repeat(40) }),
    ).toThrow(/DATABASE_URL/);
  });

  it('em produção bloqueia CORS cross-origin por padrão e aceita allowlist', () => {
    const base = { NODE_ENV: 'production', SYTHM_AUTH_SECRET: 'x'.repeat(40), DATABASE_URL: 'postgres://x' };
    expect(loadConfig(base).corsOrigin).toBe(false);
    expect(loadConfig({ ...base, CORS_ORIGINS: 'https://a.com, https://b.com' }).corsOrigin).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('em dev gera segredo efêmero diferente a cada carga', () => {
    const a = loadConfig({});
    const b = loadConfig({});
    expect(a.authSecret).toHaveLength(64);
    expect(a.authSecret).not.toBe(b.authSecret);
  });

  it('rejeita valores inválidos', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(ConfigError);
  });
});

describe('TokenService', () => {
  const svc = new TokenService('s'.repeat(40), 60_000);

  it('emite e verifica tokens', () => {
    const token = svc.issue('user-1', 3);
    expect(svc.verify(token)).toEqual({ userId: 'user-1', tokenVersion: 3 });
  });

  it('rejeita assinatura adulterada, segredo diferente e token expirado', () => {
    const token = svc.issue('user-1', 0);
    const [payload] = token.split('.');
    expect(svc.verify(`${payload}.abc`)).toBeNull();
    expect(new TokenService('o'.repeat(40), 60_000).verify(token)).toBeNull();
    expect(new TokenService('s'.repeat(40), -1).verify(new TokenService('s'.repeat(40), -1).issue('u', 0))).toBeNull();
    expect(svc.verify('lixo')).toBeNull();
  });
});
