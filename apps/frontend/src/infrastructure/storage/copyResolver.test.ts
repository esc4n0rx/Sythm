import { describe, expect, it } from 'vitest';
import { compileSythmCode } from '@sythm/core';
import { getAutocompleteSuggestions } from '../../presentation/components/sythmEditorLanguage';
import { updateControlValueInCode } from '../../presentation/components/controlCodeSync';
import { createProjectCopyContext } from './copyResolver';
import type { SythmProjectFile, SythmProjectFolder } from './ProjectStorage';

const folders: SythmProjectFolder[] = [
  { id: 'f1', name: 'Meus Projetos', isExpanded: true },
  { id: 'f2', name: 'Biblioteca', isExpanded: true },
];

const file = (id: string, folderId: string, name: string, code: string): SythmProjectFile => ({
  id,
  folderId,
  name,
  title: name,
  code,
  isFactoryPreset: false,
  updatedAt: 0,
});

const DRUMS = `PROCEDURES DIVISION.
  GROOVE SECTION.
    PLAY DRUMS KICK SNARE FOR 0.5 BEATS.
  END-SECTION.
`;

const main = file(
  'main',
  'f1',
  'musica.sythm',
  `COPY "bateria".
PLAY DIVISION.
  TRACK A.
    PERFORM GROOVE 2 TIMES.
  END-TRACK.
`,
);

const files = [
  main,
  file('d1', 'f2', 'bateria.sythm', DRUMS),
  file('d2', 'f1', 'bateria.sythm', 'REST FOR 1 BEAT.\n'),
  file('x', 'f2', 'outra.sythm', 'REST FOR 2 BEAT.\n'),
];

describe('createProjectCopyContext', () => {
  const ctx = createProjectCopyContext(files, folders, main);

  it('resolve com ou sem extensão e sem diferenciar maiúsculas', () => {
    expect(ctx.resolveCopy('outra')?.name).toBe('outra.sythm');
    expect(ctx.resolveCopy('OUTRA.SYTHM')?.name).toBe('outra.sythm');
    expect(ctx.resolveCopy('nada')).toBeNull();
  });

  it('prefere o arquivo da mesma pasta quando há homônimos', () => {
    expect(ctx.resolveCopy('bateria')?.code).toBe('REST FOR 1 BEAT.\n');
  });

  it('aceita Pasta/arquivo para escolher a pasta', () => {
    expect(ctx.resolveCopy('Biblioteca/bateria')?.code).toBe(DRUMS);
    expect(ctx.resolveCopy('Inexistente/bateria')).toBeNull();
  });

  it('nunca resolve o próprio arquivo ativo e lista os demais como candidatos', () => {
    expect(ctx.resolveCopy('musica')).toBeNull();
    expect(ctx.copyCandidates).toEqual(['bateria.sythm', 'bateria.sythm', 'outra.sythm']);
    expect(ctx.rootName).toBe('musica.sythm');
  });

  it('compila um arquivo que usa COPY do projeto', () => {
    const inFolder = createProjectCopyContext(files, folders, { ...main, folderId: 'f2' });
    const code = 'COPY "bateria".\nPLAY DIVISION.\n  TRACK A.\n    PERFORM GROOVE 2 TIMES.\n  END-TRACK.\n';
    const result = compileSythmCode(code, inFolder);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.plan!.events.length).toBeGreaterThan(0);
  });
});

describe('autocomplete com COPY', () => {
  const ctx = createProjectCopyContext(files, folders, main);

  it('sugere arquivos do projeto depois de COPY', () => {
    const code = 'COPY ';
    const r = getAutocompleteSuggestions(code, code.length, true, { languageContext: ctx });
    expect(r!.items.map((i) => i.insertText)).toContain('"outra.sythm".');
  });

  it('não repete a aspa de abertura já digitada', () => {
    const code = 'COPY "ou';
    const r = getAutocompleteSuggestions(code, code.length, false, { languageContext: ctx });
    expect(r!.items[0]!.insertText).toBe('outra.sythm".');
  });

  it('PERFORM sugere SECTION declarada no arquivo incluído', () => {
    const code = 'COPY "bateria".\nPLAY DIVISION.\n  TRACK A.\n    PERFORM ';
    const withLib = createProjectCopyContext(files, folders, { ...main, folderId: 'f2' });
    const r = getAutocompleteSuggestions(code, code.length, true, { languageContext: withLib });
    expect(r!.items.map((i) => i.label)).toContain('GROOVE');
  });
});

describe('sliders de arquivos incluídos', () => {
  it('não reescreve o código quando o controle vem de um COPY', () => {
    const code = 'COPY "controles".\n';
    const control = {
      name: 'VOL',
      label: 'VOL',
      kind: 'declared' as const,
      defaultValue: 1,
      min: 0,
      max: 2,
      step: 1,
      unit: '',
      declarationLine: 1,
      sourceFile: 'controles.sythm',
      usageLines: [],
      bindings: [],
    };
    expect(updateControlValueInCode(code, control, 2)).toBe(code);
  });
});
