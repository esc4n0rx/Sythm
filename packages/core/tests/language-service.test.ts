import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESETS,
  analyzeDocument,
  applyEdits,
  compileSythmCode,
  getCodeActions,
  getDeclaredNames,
  getDefinition,
  getDocumentSymbols,
  getHover,
  getReferences,
  mergeDiagnostics,
  positionAt,
  renameSymbol,
  suggestSimilar,
} from '../src/index.js';

const SRC = `HEADER DIVISION.
  PROGRAM-ID. DEMO.

CONFIG DIVISION.
  TEMPO IS 120 BPM.
  CONTROL VOL-BASS IS SLIDER 75 FROM 0 TO 100.
  CONTROL CUTOFF IS SLIDER 520 FROM 80 TO 4000.

PROCEDURES DIVISION.
  SECTION GROOVE.
    PLAY DRUMS KICK SNARE FOR 0.5 BEATS.
  END-SECTION.

  BASS-LINE SECTION.
    PLAY NOTES A1 C2 FOR 0.5 BEATS.
  END-SECTION.

PLAY DIVISION.
  TRACK DRUMS.
    PERFORM GROOVE 2 TIMES.
  END-TRACK.

  TRACK BASS.
    VOLUME IS VOL-BASS.
    FILTER IS LOWPASS CUTOFF HZ Q 3.
    PERFORM BASS-LINE 2 TIMES.
    PERFORM groove 1 TIMES.
  END-TRACK.
`;

const at = (src: string, needle: string, nth = 0, delta = 0): number => {
  let idx = -1;
  for (let i = 0; i <= nth; i++) idx = src.indexOf(needle, idx + 1);
  if (idx < 0) throw new Error(`"${needle}" não encontrado`);
  return idx + delta;
};

describe('analyzeDocument', () => {
  const model = analyzeDocument(SRC);

  it('reconhece SECTIONs nas duas formas, PERFORMs, CONTROLs e TRACKs', () => {
    expect([...model.sections.keys()].sort()).toEqual(['BASS-LINE', 'GROOVE']);
    expect(model.sections.get('GROOVE')!.references).toHaveLength(2); // case-insensitive
    expect([...model.controls.keys()].sort()).toEqual(['CUTOFF', 'VOL-BASS']);
    expect(model.controls.get('VOL-BASS')!.references).toHaveLength(1);
    expect(model.controls.get('CUTOFF')!.spec).toEqual({ defaultValue: 520, min: 80, max: 4000 });
    expect([...model.tracks.keys()].sort()).toEqual(['BASS', 'DRUMS']);
  });

  it('não gera falso positivo em nenhum preset embutido', () => {
    for (const preset of DEFAULT_PRESETS) {
      const m = analyzeDocument(preset.code);
      expect(m.diagnostics, preset.name ?? preset.id).toEqual([]);
    }
  });

  it('converte offsets e posições (inclusive com CRLF)', () => {
    const crlf = 'CONFIG DIVISION.\r\n  CONTROL A IS SLIDER 1 FROM 0 TO 2.\r\n';
    const m = analyzeDocument(crlf);
    const occ = m.controls.get('A')!.definitions[0]!;
    expect(crlf.slice(occ.range.start, occ.range.end)).toBe('A');
    expect(positionAt(m, occ.range.start)).toEqual({ line: 2, column: 11 });
  });

  it('suporta nomes entre aspas e numéricos', () => {
    const m = analyzeDocument('PROCEDURES DIVISION.\n  SECTION "Refrão".\n  END-SECTION.\nPLAY DIVISION.\n  TRACK A.\n    PERFORM "refrão".\n  END-TRACK.\n');
    expect(m.sections.get('REFRÃO')?.references).toHaveLength(1);
    expect(m.diagnostics).toEqual([]);
  });
});

describe('diagnósticos semânticos', () => {
  it('PERFORM de seção inexistente sugere nomes parecidos', () => {
    const src = SRC.replace('PERFORM BASS-LINE', 'PERFORM BASS-LINNE');
    const d = analyzeDocument(src).diagnostics.find((x) => x.code === 'undefined-section')!;
    expect(d.symbolName).toBe('BASS-LINNE');
    expect(d.suggestions).toEqual(['BASS-LINE']);
    expect(src.slice(d.range.start, d.range.end)).toBe('BASS-LINNE');
  });

  it('controle não declarado em VOLUME/FILTER', () => {
    const src = SRC.replace('VOLUME IS VOL-BASS', 'VOLUME IS VOL-BAS').replace('LOWPASS CUTOFF', 'LOWPASS CUTOF');
    const d = analyzeDocument(src).diagnostics.filter((x) => x.code === 'undefined-control');
    expect(d.map((x) => x.symbolName)).toEqual(['VOL-BAS', 'CUTOF']);
    expect(d[0]!.suggestions).toEqual(['VOL-BASS']);
  });

  it('avisa de SECTION e CONTROL duplicados', () => {
    const src = SRC.replace('BASS-LINE SECTION.', 'GROOVE SECTION.').replace('CONTROL CUTOFF', 'CONTROL VOL-BASS');
    const codes = analyzeDocument(src).diagnostics.map((d) => d.code);
    expect(codes).toContain('duplicate-section');
    expect(codes).toContain('duplicate-control');
  });

  it('continua funcionando com erro de sintaxe em outro ponto', () => {
    const src = SRC.replace('PLAY NOTES A1 C2 FOR 0.5 BEATS.', 'PLAY NOTES A1 C2 FOR 0.5 BEATS').replace('PERFORM GROOVE 2', 'PERFORM GROVE 2');
    const d = analyzeDocument(src).diagnostics.find((x) => x.code === 'undefined-section');
    expect(d?.suggestions).toContain('GROOVE');
  });

  it('mergeDiagnostics remove duplicatas do compilador na mesma linha', () => {
    const src = SRC.replace('PERFORM BASS-LINE', 'PERFORM BASS-LINNE');
    const compiled = compileSythmCode(src);
    const merged = mergeDiagnostics(src, compiled.diagnostics);
    const perfLine = merged.filter((d) => /PERFORM/.test(d.message));
    expect(perfLine).toHaveLength(1);
    expect('code' in perfLine[0]!).toBe(true);
  });
});

describe('navegação', () => {
  it('go-to-definition de PERFORM e de CONTROL', () => {
    const toSection = getDefinition(analyzeDocument(SRC), at(SRC, 'PERFORM BASS-LINE', 0, 12));
    expect(toSection?.name).toBe('BASS-LINE');
    expect(toSection?.line).toBe(14);
    const toControl = getDefinition(analyzeDocument(SRC), at(SRC, 'VOL-BASS', 1, 3));
    expect(toControl?.kind).toBe('control');
    expect(toControl?.line).toBe(6);
    expect(getDefinition(analyzeDocument(SRC), at(SRC, 'TEMPO'))).toBeNull();
  });

  it('referências, com e sem declaração', () => {
    const model = analyzeDocument(SRC);
    const off = at(SRC, 'GROOVE', 0, 2);
    expect(getReferences(model, off)).toHaveLength(3);
    expect(getReferences(model, off, false)).toHaveLength(2);
  });

  it('outline do documento', () => {
    const symbols = getDocumentSymbols(analyzeDocument(SRC));
    expect(symbols.map((s) => `${s.kind}:${s.name}`)).toEqual([
      'control:VOL-BASS',
      'control:CUTOFF',
      'section:GROOVE',
      'section:BASS-LINE',
      'track:DRUMS',
      'track:BASS',
    ]);
    expect(symbols.find((s) => s.name === 'GROOVE')!.detail).toBe('2 usos');
  });

  it('nomes declarados para autocomplete', () => {
    expect(getDeclaredNames(SRC)).toEqual({
      sections: ['GROOVE', 'BASS-LINE'],
      controls: ['VOL-BASS', 'CUTOFF'],
    });
  });
});

describe('rename', () => {
  it('renomeia declaração e todas as referências, e o resultado compila', () => {
    const model = analyzeDocument(SRC);
    const r = renameSymbol(model, at(SRC, 'GROOVE', 0, 1), 'Batida');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = applyEdits(SRC, r.edits);
    expect(out).not.toMatch(/GROOVE/i);
    expect(out.match(/Batida/g)).toHaveLength(3);
    expect(compileSythmCode(out).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('preserva aspas ao renomear', () => {
    const src = 'PROCEDURES DIVISION.\n  SECTION "Refrão".\n  END-SECTION.\nPLAY DIVISION.\n  TRACK A.\n    PERFORM "Refrão".\n  END-TRACK.\n';
    const r = renameSymbol(analyzeDocument(src), at(src, 'Refrão', 1, 1), 'Coro');
    expect(r.ok && applyEdits(src, r.edits)).toContain('PERFORM "Coro".');
  });

  it('rejeita nomes reservados, notas, acordes, inválidos e conflitantes', () => {
    const model = analyzeDocument(SRC);
    const off = at(SRC, 'GROOVE', 0, 1);
    for (const bad of ['TEMPO', 'C4', 'Cmaj7', '9abc', 'a b', '']) {
      expect(renameSymbol(model, off, bad).ok, bad).toBe(false);
    }
    const conflict = renameSymbol(model, off, 'bass-line');
    expect(conflict.ok).toBe(false);
    // renomear para o mesmo nome (mudando só a caixa) é permitido
    expect(renameSymbol(model, off, 'groove').ok).toBe(true);
  });

  it('não renomeia fora de símbolos', () => {
    const r = renameSymbol(analyzeDocument(SRC), at(SRC, 'TEMPO'), 'X');
    expect(r.ok).toBe(false);
  });
});

describe('hover', () => {
  const model = analyzeDocument(SRC);

  it('símbolos mostram declaração e usos', () => {
    const h = getHover(model, at(SRC, 'CUTOFF', 1, 2))!;
    expect(h.title).toBe('CONTROL CUTOFF');
    expect(h.description).toContain('de 80 a 4000');
    expect(h.description).toContain('1 uso');
    expect(getHover(model, at(SRC, 'GROOVE', 0, 1))!.title).toBe('SECTION GROOVE');
  });

  it('palavras-chave, notas e acordes', () => {
    expect(getHover(model, at(SRC, 'FILTER', 0, 2))!.title).toBe('FILTER');
    const note = getHover(analyzeDocument('PLAY NOTE A4 FOR 1 BEATS.'), 11)!;
    expect(note.title).toBe('Nota A4');
    expect(note.description).toContain('440.00 Hz');
    const chord = getHover(analyzeDocument('PLAY CHORD Cmaj7 FOR 1 BEATS.'), 13)!;
    expect(chord.description).toContain('Notas: C4');
  });

  it('retorna null onde não há o que mostrar', () => {
    expect(getHover(model, 0 + 15)).toBeNull(); // ponto final
    expect(getHover(analyzeDocument(''), 0)).toBeNull();
  });
});

describe('code actions', () => {
  it('sugere trocar pelo nome parecido e o resultado compila', () => {
    const src = SRC.replace('PERFORM BASS-LINE', 'PERFORM BASS-LINNE');
    const model = analyzeDocument(src);
    const diag = model.diagnostics.find((d) => d.code === 'undefined-section')!;
    const [swap] = getCodeActions(model, diag);
    expect(swap!.title).toBe('Trocar por "BASS-LINE"');
    const out = applyEdits(src, swap!.edits);
    expect(compileSythmCode(out).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('cria SECTION ausente antes da PLAY DIVISION', () => {
    const src = SRC.replace('PERFORM BASS-LINE', 'PERFORM NOVA');
    const model = analyzeDocument(src);
    const diag = model.diagnostics.find((d) => d.code === 'undefined-section')!;
    const create = getCodeActions(model, diag).find((a) => a.title.startsWith('Criar SECTION'))!;
    const out = applyEdits(src, create.edits);
    expect(out.indexOf('NOVA SECTION.')).toBeLessThan(out.indexOf('PLAY DIVISION.'));
    expect(analyzeDocument(out).diagnostics).toEqual([]);
    expect(compileSythmCode(out).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('cria SECTION mesmo sem PROCEDURES/PLAY DIVISION', () => {
    const src = 'CONFIG DIVISION.\n  TEMPO IS 100 BPM.\n';
    const model = analyzeDocument(src + 'PLAY DIVISION.\n  TRACK A.\n    PERFORM X.\n  END-TRACK.\n');
    const diag = model.diagnostics[0]!;
    const out = applyEdits(model.source, getCodeActions(model, diag).find((a) => a.title.startsWith('Criar'))!.edits);
    expect(out).toContain('PROCEDURES DIVISION.');
    expect(analyzeDocument(out).diagnostics).toEqual([]);
  });

  it('declara CONTROL ausente dentro da CONFIG DIVISION', () => {
    const src = SRC.replace('VOLUME IS VOL-BASS', 'VOLUME IS VOL-NOVO');
    const model = analyzeDocument(src);
    const diag = model.diagnostics.find((d) => d.code === 'undefined-control')!;
    const create = getCodeActions(model, diag).find((a) => a.title.startsWith('Declarar CONTROL'))!;
    const out = applyEdits(src, create.edits);
    expect(analyzeDocument(out).diagnostics).toEqual([]);
    expect(out.indexOf('CONTROL VOL-NOVO')).toBeLessThan(out.indexOf('PROCEDURES DIVISION.'));
    expect(compileSythmCode(out).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('correções de sintaxe: ponto final e END-*', () => {
    const src = 'PLAY DIVISION.\n  TRACK A.\n    PLAY NOTE C4 FOR 1 BEATS\n  END-TRACK.\n';
    const compiled = compileSythmCode(src);
    const diag = compiled.diagnostics.find((d) => d.severity === 'error')!;
    const model = analyzeDocument(src);
    const fixes = getCodeActions(model, diag);
    expect(fixes.length).toBeGreaterThan(0);

    const fixed = applyEdits(src, fixes[0]!.edits);
    expect(fixed).toContain('FOR 1 BEATS.\n  END-TRACK.');
    expect(compileSythmCode(fixed).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('correção de END-REPEAT ausente (ignora o diagnóstico do bloco aberto)', () => {
    const src = 'PLAY DIVISION.\n  TRACK A.\n    REPEAT 2 TIMES.\n    REST FOR 1 BEAT.\n  END-TRACK.\n';
    const model = analyzeDocument(src);
    const errors = compileSythmCode(src).diagnostics.filter((d) => d.severity === 'error');
    const actions = errors.flatMap((d) => getCodeActions(model, d));
    expect(actions).toHaveLength(1);
    const fixed = applyEdits(src, actions[0]!.edits);
    expect(fixed).toContain('REST FOR 1 BEAT.\n  END-REPEAT.\n  END-TRACK.');
    expect(compileSythmCode(fixed).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });
});

describe('quick-fix com diagnóstico desatualizado', () => {
  it('não gera correção se o token do diagnóstico mudou', () => {
    const src = 'PLAY DIVISION.\n  TRACK A.\n    PLAY NOTE C4 FOR 1 BEATS\n  END-TRACK.\n';
    const diag = compileSythmCode(src).diagnostics.find((d) => d.severity === 'error')!;
    // O usuário editou o texto depois da compilação: o token do diagnóstico não é mais o mesmo.
    const edited = src.replace('END-TRACK.', 'REST FOR 1 BEAT.\n  END-TRACK.');
    expect(getCodeActions(analyzeDocument(edited), diag)).toEqual([]);
    expect(getCodeActions(analyzeDocument(src), diag)).toHaveLength(1);
  });
});

describe('suggestSimilar', () => {
  it('ordena por distância e limita a 3', () => {
    expect(suggestSimilar('GROVE', ['GROOVE', 'GRAVE', 'BASS', 'GROVEL', 'GROVES'])).toHaveLength(3);
    expect(suggestSimilar('xyz', ['GROOVE'])).toEqual([]);
    expect(suggestSimilar('groov', ['GROOVE'])[0]).toBe('GROOVE');
  });
});
