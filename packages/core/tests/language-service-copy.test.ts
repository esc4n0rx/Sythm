import { describe, expect, it } from 'vitest';
import {
  type CopyResolver,
  type LanguageContext,
  analyzeDocument,
  applyEdits,
  compileSythmCode,
  getCodeActions,
  getDeclaredNames,
  getDefinition,
  getHover,
  getReferences,
  mergeDiagnostics,
  prepareRename,
} from '../src/index.js';

const files: Record<string, string> = {
  'drums.sythm': `PROCEDURES DIVISION.
  GROOVE SECTION.
    PLAY DRUMS KICK SNARE FOR 0.5 BEATS.
  END-SECTION.
`,
  'controls.sythm': '  CONTROL VOL-DRUMS IS SLIDER 80 FROM 0 TO 100.\n  CONTROL REV IS SLIDER 20 FROM 0 TO 60.\n',
  'nested.sythm': 'COPY "drums".\n  FILL SECTION.\n    REST FOR 1 BEAT.\n  END-SECTION.\n',
};

const resolveCopy: CopyResolver = (raw) => {
  const key = /\.sythm$/i.test(raw) ? raw.toLowerCase() : `${raw.toLowerCase()}.sythm`;
  return key in files ? { name: key, code: files[key]! } : null;
};

const ctx: LanguageContext = { resolveCopy, copyCandidates: Object.keys(files) };

const MAIN = `CONFIG DIVISION.
  COPY "controls.sythm".

COPY "drums.sythm".

PLAY DIVISION.
  TRACK DRUMS.
    VOLUME IS VOL-DRUMS.
    PERFORM GROOVE 2 TIMES.
  END-TRACK.
`;

const at = (src: string, needle: string, nth = 0, delta = 0): number => {
  let idx = -1;
  for (let i = 0; i <= nth; i++) idx = src.indexOf(needle, idx + 1);
  if (idx < 0) throw new Error(`"${needle}" não encontrado`);
  return idx + delta;
};

describe('símbolos vindos de COPY', () => {
  const model = analyzeDocument(MAIN, ctx);

  it('não acusa falso erro para SECTION/CONTROL declarados no arquivo incluído', () => {
    expect(model.diagnostics).toEqual([]);
    expect(model.sections.get('GROOVE')!.definitions[0]).toMatchObject({ file: 'drums.sythm', line: 2 });
    expect(model.controls.get('VOL-DRUMS')!.references).toHaveLength(1);
    expect(model.controls.get('VOL-DRUMS')!.spec).toEqual({ defaultValue: 80, min: 0, max: 100 });
  });

  it('inclui símbolos de COPY aninhado', () => {
    const m = analyzeDocument('COPY "nested".\nPLAY DIVISION.\n  TRACK A.\n    PERFORM GROOVE 1 TIMES.\n    PERFORM FILL 1 TIMES.\n  END-TRACK.\n', ctx);
    expect(m.diagnostics).toEqual([]);
    expect(m.sections.get('GROOVE')!.definitions[0]!.file).toBe('drums.sythm');
    expect(m.sections.get('FILL')!.definitions[0]!.file).toBe('nested.sythm');
  });

  it('o identificador do COPY não conta como referência a um controle', () => {
    // "percs" é só o nome do arquivo no COPY, não uma referência ao CONTROL de mesmo nome.
    const m = analyzeDocument('CONFIG DIVISION.\n  CONTROL PERCS IS SLIDER 1 FROM 0 TO 2.\nCOPY percs.\n', ctx);
    expect(m.controls.get('PERCS')!.references).toEqual([]);
  });

  it('autocomplete conhece os nomes dos arquivos incluídos', () => {
    expect(getDeclaredNames(MAIN, ctx)).toEqual({
      sections: ['GROOVE'],
      controls: ['VOL-DRUMS', 'REV'],
    });
  });

  it('mantém consistência com o compilador', () => {
    const lang = analyzeDocument(MAIN, ctx).diagnostics.filter((d) => d.severity === 'error');
    const compiled = compileSythmCode(MAIN, { resolveCopy }).diagnostics.filter((d) => d.severity === 'error');
    expect(lang).toEqual([]);
    expect(compiled).toEqual([]);
  });
});

describe('navegação com COPY', () => {
  const model = analyzeDocument(MAIN, ctx);

  it('F12 em PERFORM leva ao arquivo e à linha da SECTION', () => {
    const def = getDefinition(model, at(MAIN, 'PERFORM GROOVE', 0, 10))!;
    expect(def).toMatchObject({ kind: 'section', file: 'drums.sythm', line: 2 });
  });

  it('F12 no nome do COPY abre o arquivo', () => {
    const def = getDefinition(model, at(MAIN, '"drums.sythm"', 0, 3))!;
    expect(def).toMatchObject({ kind: 'file', file: 'drums.sythm' });
    expect(getDefinition(analyzeDocument('COPY "nope".\n', ctx), 8)).toBeNull();
  });

  it('referências incluem a declaração externa por último', () => {
    const refs = getReferences(model, at(MAIN, 'PERFORM GROOVE', 0, 10));
    expect(refs.map((r) => r.file)).toEqual([undefined, 'drums.sythm']);
  });

  it('não permite renomear símbolos de outro arquivo', () => {
    expect(prepareRename(model, at(MAIN, 'PERFORM GROOVE', 0, 10))).toBeNull();
  });
});

describe('hover com COPY', () => {
  const model = analyzeDocument(MAIN, ctx);

  it('COPY mostra o que o arquivo declara', () => {
    const h = getHover(model, at(MAIN, '"drums.sythm"', 0, 3))!;
    expect(h.title).toBe('COPY drums.sythm');
    expect(h.description).toContain('SECTION: GROOVE');
    const c = getHover(model, at(MAIN, '"controls.sythm"', 0, 3))!;
    expect(c.description).toContain('CONTROL: VOL-DRUMS, REV');
  });

  it('palavra COPY tem documentação', () => {
    expect(getHover(model, at(MAIN, 'COPY', 1, 1))!.title).toBe('COPY');
  });

  it('símbolo externo indica o arquivo de origem', () => {
    const h = getHover(model, at(MAIN, 'PERFORM GROOVE', 0, 10))!;
    expect(h.description).toContain('drums.sythm');
    const ctrl = getHover(model, at(MAIN, 'VOL-DRUMS', 0, 2))!;
    expect(ctrl.description).toContain('de 0 a 100');
  });
});

describe('COPY não resolvido', () => {
  const SRC = 'COPY "drms.sythm".\nPLAY DIVISION.\n  TRACK A.\n    PERFORM GROOVE 1 TIMES.\n  END-TRACK.\n';

  it('reporta o arquivo e sugere o mais parecido; não acusa PERFORM (incerto)', () => {
    const d = analyzeDocument(SRC, ctx).diagnostics;
    expect(d.map((x) => x.code)).toEqual(['unresolved-copy']);
    expect(d[0]!.suggestions).toEqual(['drums.sythm']);
  });

  it('quick-fix troca o nome e o resultado fica sem diagnósticos', () => {
    const model = analyzeDocument(SRC, ctx);
    const [fix] = getCodeActions(model, model.diagnostics[0]!);
    expect(fix!.title).toBe('Trocar por "drums.sythm"');
    const out = applyEdits(SRC, fix!.edits);
    expect(out.startsWith('COPY "drums.sythm".')).toBe(true);
    expect(analyzeDocument(out, ctx).diagnostics).toEqual([]);
  });

  it('sem contexto de projeto não afirma nada sobre COPY ou nomes indefinidos', () => {
    expect(analyzeDocument(SRC).diagnostics).toEqual([]);
  });

  it('mergeDiagnostics não duplica o erro do compilador na linha do COPY', () => {
    const compiled = compileSythmCode(SRC, { resolveCopy });
    const merged = mergeDiagnostics(SRC, compiled.diagnostics, ctx);
    expect(merged.filter((d) => d.line === 1)).toHaveLength(1);
    expect('code' in merged.find((d) => d.line === 1)!).toBe(true);
  });
});

describe('duplicados entre arquivos', () => {
  it('avisa quando o arquivo principal redeclara um símbolo do COPY', () => {
    const src = 'COPY "drums".\nPROCEDURES DIVISION.\n  GROOVE SECTION.\n    REST FOR 1 BEAT.\n  END-SECTION.\n';
    const d = analyzeDocument(src, ctx).diagnostics;
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ code: 'duplicate-section', severity: 'warning' });
    expect(d[0]!.message).toContain('drums.sythm');
  });
});
