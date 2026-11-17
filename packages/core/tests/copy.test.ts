import { describe, expect, it } from 'vitest';
import {
  type CopyResolver,
  compileSythmCode,
  expandCopies,
  hasCopyStatements,
  parseCopyLine,
  remapCompilationResult,
} from '../src/index.js';

const LIB_DRUMS = `PROCEDURES DIVISION.
  GROOVE SECTION.
    PLAY DRUMS KICK SNARE FOR 0.5 BEATS.
  END-SECTION.
`;

const LIB_CONTROLS = `  CONTROL VOL-DRUMS IS SLIDER 80 FROM 0 TO 100.
`;

const files: Record<string, string> = {
  'drums.sythm': LIB_DRUMS,
  'controls.sythm': LIB_CONTROLS,
  'fx.sythm': '    REVERB IS 30 PERCENT.\n    DELAY IS 20 PERCENT TIME 0.25 SEC FEEDBACK 30 PERCENT.\n',
  'a.sythm': 'COPY "b.sythm".\n',
  'b.sythm': 'COPY "a.sythm".\n',
  'broken.sythm': 'PROCEDURES DIVISION.\n  BAD SECTION.\n    PLAY NOTE ZZ9 FOR 1 BEATS.\n  END-SECTION.\n',
};

const resolve: CopyResolver = (raw) => {
  const key = /\.sythm$/i.test(raw) ? raw.toLowerCase() : `${raw.toLowerCase()}.sythm`;
  return key in files ? { name: key, code: files[key]! } : null;
};

const MAIN = `HEADER DIVISION.
  PROGRAM-ID. MAIN.

CONFIG DIVISION.
  TEMPO IS 120 BPM.
  COPY "controls.sythm".

COPY "drums.sythm".

PLAY DIVISION.
  TRACK DRUMS.
    VOLUME IS VOL-DRUMS.
    PERFORM GROOVE 2 TIMES.
  END-TRACK.
`;

const errors = (r: { diagnostics: Array<{ severity: string }> }) =>
  r.diagnostics.filter((d) => d.severity === 'error');

describe('parseCopyLine', () => {
  it('aceita aspas, nome simples, indentação e comentário', () => {
    expect(parseCopyLine('COPY "drums.sythm".')).toEqual({ name: 'drums.sythm', indent: '' });
    expect(parseCopyLine('  copy drums.')).toEqual({ name: 'drums', indent: '  ' });
    expect(parseCopyLine('COPY "meu arquivo.sythm". *> bateria')?.name).toBe('meu arquivo.sythm');
  });

  it('ignora o que não é um COPY completo', () => {
    for (const l of ['COPY "x"', 'COPY.', '*> COPY "x".', 'COPYRIGHT "x".', 'PLAY COPY "x".', 'COPY "x". REST FOR 1 BEAT.']) {
      expect(parseCopyLine(l), l).toBeNull();
    }
  });

  it('hasCopyStatements', () => {
    expect(hasCopyStatements(MAIN)).toBe(true);
    expect(hasCopyStatements('PLAY DIVISION.\n')).toBe(false);
  });
});

describe('expandCopies', () => {
  it('substitui o COPY pelo conteúdo e registra a origem de cada linha', () => {
    const exp = expandCopies(MAIN, resolve);
    expect(exp.diagnostics).toEqual([]);
    expect(exp.files).toEqual(['controls.sythm', 'drums.sythm']);
    expect(exp.text).toContain('CONTROL VOL-DRUMS');
    expect(exp.text).not.toContain('COPY');
    const idx = exp.text.split('\n').findIndex((l) => l.includes('GROOVE SECTION'));
    expect(exp.origins[idx]).toEqual({ file: 'drums.sythm', line: 2, anchorLine: 8 });
  });

  it('suporta COPY aninhado', () => {
    const r: CopyResolver = (n) =>
      n === 'outer' ? { name: 'outer', code: 'COPY inner.\n' } : n === 'inner' ? { name: 'inner', code: 'REST FOR 1 BEAT.\n' } : null;
    const exp = expandCopies('COPY outer.\n', r);
    expect(exp.text).toContain('REST FOR 1 BEAT.');
    expect(exp.origins[0]).toEqual({ file: 'inner', line: 1, anchorLine: 1 });
  });

  it('detecta ciclos e arquivos inexistentes, preservando a numeração', () => {
    const cyc = expandCopies('REST FOR 1 BEAT.\nCOPY "a.sythm".\nREST FOR 2 BEAT.\n', resolve);
    expect(cyc.diagnostics[0]!.message).toContain('circular');
    expect(cyc.diagnostics[0]!.line).toBe(2);

    const miss = expandCopies('REST FOR 1 BEAT.\nCOPY "nope".\n', resolve);
    expect(miss.diagnostics[0]).toMatchObject({ severity: 'error', line: 2 });
    expect(miss.text.split('\n')).toEqual(['REST FOR 1 BEAT.', '', '']);
  });

  it('limita a profundidade', () => {
    const r: CopyResolver = (n) => ({ name: n, code: `COPY "${n}x".\n` });
    const exp = expandCopies('COPY "f".\n', r);
    expect(exp.diagnostics.some((d) => d.message.includes('Profundidade máxima'))).toBe(true);
  });

  it('sem resolver, todo COPY é erro', () => {
    const exp = expandCopies('COPY "x".\n');
    expect(exp.diagnostics).toHaveLength(1);
  });
});

describe('compileSythmCode com COPY', () => {
  it('compila programa que usa SECTION e CONTROL vindos de arquivos incluídos', () => {
    const result = compileSythmCode(MAIN, { resolveCopy: resolve });
    expect(errors(result)).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.plan!.events.length).toBeGreaterThan(0);
    expect(result.plan!.controls.map((c) => c.name)).toContain('VOL-DRUMS');
  });

  it('eventos e controles de arquivos incluídos apontam para a linha do COPY', () => {
    const result = compileSythmCode(MAIN, { resolveCopy: resolve });
    const lines = result.plan!.events.map((e) => e.line);
    // Os eventos nascem no corpo de GROOVE (drums.sythm): aparecem na linha do COPY "drums.sythm".
    expect(new Set(lines)).toEqual(new Set([8]));
    const ctrl = result.plan!.controls.find((c) => c.name === 'VOL-DRUMS')!;
    expect(ctrl.declarationLine).toBe(6); // COPY "controls.sythm".
    expect(ctrl.usageLines).toEqual([12]);
  });

  it('inclui no meio de uma TRACK', () => {
    const src = `PLAY DIVISION.
  TRACK A.
    WAVE IS SAW.
    COPY "fx".
    PLAY NOTE C4 FOR 1 BEAT.
  END-TRACK.
`;
    const result = compileSythmCode(src, { resolveCopy: resolve });
    expect(errors(result)).toEqual([]);
    expect(result.plan!.events[0]!.line).toBe(5);
  });

  it('erro dentro do arquivo incluído aponta para o COPY, com o nome do arquivo na mensagem', () => {
    const src = 'PLAY DIVISION.\n  TRACK A.\n    PLAY NOTE C4 FOR 1 BEAT.\n  END-TRACK.\nCOPY "broken".\n';
    const result = compileSythmCode(src, { resolveCopy: resolve });
    expect(result.success).toBe(false);
    const d = errors(result)[0] as { line: number; message: string };
    expect(d.line).toBe(5);
    expect(d.message).toContain('[broken.sythm:3]');
  });

  it('erro no arquivo principal depois de um COPY mantém a linha original', () => {
    const src = 'COPY "drums".\nPLAY DIVISION.\n  TRACK A.\n    PLAY NOTE C4 FOR 1 BEATS\n  END-TRACK.\n';
    const d = errors(compileSythmCode(src, { resolveCopy: resolve }))[0] as { line: number; message: string };
    expect(d.line).toBe(5); // END-TRACK., onde o parser detecta a falta do ponto
    expect(d.message).not.toContain('[');
  });

  it('COPY não resolvido torna a compilação inválida e sem plano', () => {
    const result = compileSythmCode('COPY "nope".\nPLAY DIVISION.\n  TRACK A.\n    REST FOR 1 BEAT.\n  END-TRACK.\n', {
      resolveCopy: resolve,
    });
    expect(result.success).toBe(false);
    expect(result.plan).toBeNull();
    expect(errors(result)[0]).toMatchObject({ line: 1 });
  });

  it('o conteúdo da biblioteca também vale quando há divisões repetidas', () => {
    const src = `PROCEDURES DIVISION.
  LOCAL SECTION.
    REST FOR 1 BEAT.
  END-SECTION.
COPY "drums".
PLAY DIVISION.
  TRACK A.
    PERFORM LOCAL 1 TIMES.
    PERFORM GROOVE 1 TIMES.
  END-TRACK.
`;
    expect(errors(compileSythmCode(src, { resolveCopy: resolve }))).toEqual([]);
  });

  it('código sem COPY tem resultado idêntico ao caminho antigo', () => {
    const code = 'PLAY DIVISION.\n  TRACK A.\n    PLAY NOTE C4 FOR 1 BEAT.\n  END-TRACK.\n';
    expect(compileSythmCode(code, { resolveCopy: resolve })).toEqual(compileSythmCode(code));
  });

  it('remapCompilationResult é no-op quando não há COPY', () => {
    const r = compileSythmCode('REST FOR 1 BEAT.\n');
    expect(remapCompilationResult(r, expandCopies('REST FOR 1 BEAT.\n'))).toBe(r);
  });
});

describe('origem dos controles', () => {
  it('marca sourceFile apenas para controles declarados em arquivos incluídos', () => {
    const src = `CONFIG DIVISION.
  CONTROL LOCAL IS SLIDER 1 FROM 0 TO 2.
  COPY "controls.sythm".
PLAY DIVISION.
  TRACK A.
    VOLUME IS VOL-DRUMS.
    REVERB IS LOCAL.
    REST FOR 1 BEAT.
  END-TRACK.
`;
    const plan = compileSythmCode(src, { resolveCopy: resolve }).plan!;
    expect(plan.controls.find((c) => c.name === 'VOL-DRUMS')!.sourceFile).toBe('controls.sythm');
    expect(plan.controls.find((c) => c.name === 'LOCAL')!.sourceFile).toBeUndefined();
  });
});

describe('COPY de si mesmo', () => {
  it('rootName evita que o arquivo inclua a si próprio', () => {
    const self: CopyResolver = (n) => (n === 'self' ? { name: 'self.sythm', code: 'COPY "self".\n' } : null);
    const exp = expandCopies('COPY "self".\n', self, 'self.sythm');
    expect(exp.diagnostics[0]!.message).toContain('circular');
  });
});
