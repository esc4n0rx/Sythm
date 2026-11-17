import type { CompileOptions, CopyResolver, LanguageContext } from '@sythm/core';
import {
  type SythmProjectFile,
  type SythmProjectFolder,
  normalizeSythmFilename,
} from './ProjectStorage';

export interface ProjectCopyContext extends LanguageContext, CompileOptions {
  readonly resolveCopy: CopyResolver;
  readonly rootName: string;
  readonly copyCandidates: readonly string[];
}

/**
 * Resolve `COPY "nome".` entre os arquivos do projeto (workspace).
 *
 * - O nome pode vir com ou sem `.sythm` e sem diferenciar maiúsculas.
 * - `COPY "Pasta/arquivo".` restringe a busca à pasta indicada.
 * - Havendo arquivos homônimos em pastas diferentes, vale o da pasta do arquivo ativo.
 * - O próprio arquivo ativo nunca é candidato.
 */
export function createProjectCopyContext(
  files: readonly SythmProjectFile[],
  folders: readonly SythmProjectFolder[],
  activeFile: SythmProjectFile,
): ProjectCopyContext {
  const folderName = new Map(folders.map((f) => [f.id, f.name.toLowerCase()]));
  const others = files.filter((f) => f.id !== activeFile.id);

  const resolveCopy: CopyResolver = (raw) => {
    const slash = raw.lastIndexOf('/');
    const wantedFolder = slash >= 0 ? raw.slice(0, slash).trim().toLowerCase() : null;
    const wantedName = normalizeSythmFilename(slash >= 0 ? raw.slice(slash + 1) : raw).toLowerCase();

    const matches = others.filter(
      (f) =>
        f.name.toLowerCase() === wantedName &&
        (wantedFolder === null || folderName.get(f.folderId) === wantedFolder),
    );
    const chosen = matches.find((f) => f.folderId === activeFile.folderId) ?? matches[0];
    return chosen ? { name: chosen.name, code: chosen.code } : null;
  };

  return {
    resolveCopy,
    rootName: activeFile.name,
    copyCandidates: others.map((f) => f.name),
  };
}
