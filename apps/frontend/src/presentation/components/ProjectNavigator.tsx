import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode2,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  SythmProjectFile,
  SythmProjectFolder,
} from '../../infrastructure/storage/ProjectStorage';

export interface ProjectNavigatorProps {
  readonly folders: SythmProjectFolder[];
  readonly files: SythmProjectFile[];
  readonly selectedFileId: string;
  readonly onSelectFile: (file: SythmProjectFile) => void;
  readonly onToggleFolder: (folderId: string) => void;
  readonly onCreateFolder: (name: string) => void;
  readonly onRenameFolder: (folderId: string, newName: string) => void;
  readonly onDeleteFolder: (folderId: string) => void;
  readonly onCreateFile: (folderId: string, filename: string) => void;
  readonly onRenameFile: (fileId: string, newFilename: string) => void;
  readonly onDuplicateFile: (fileId: string) => void;
  readonly onDeleteFile: (fileId: string) => void;
  readonly onResetFactory: () => void;
  readonly onOpenTutorial: () => void;
}

type InlinePromptState =
  | { kind: 'new-folder'; value: string }
  | { kind: 'rename-folder'; folderId: string; value: string }
  | { kind: 'new-file'; folderId: string; value: string }
  | { kind: 'rename-file'; fileId: string; value: string }
  | null;

export function ProjectNavigator({
  folders,
  files,
  selectedFileId,
  onSelectFile,
  onToggleFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateFile,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onResetFactory,
  onOpenTutorial,
}: ProjectNavigatorProps) {
  const [promptState, setPromptState] = useState<InlinePromptState>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (promptState) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [promptState?.kind]);

  const submitPrompt = (): void => {
    if (!promptState) return;
    const trimmed = promptState.value.trim();
    if (!trimmed) {
      setPromptState(null);
      return;
    }

    switch (promptState.kind) {
      case 'new-folder':
        onCreateFolder(trimmed);
        break;
      case 'rename-folder':
        onRenameFolder(promptState.folderId, trimmed);
        break;
      case 'new-file':
        onCreateFile(promptState.folderId, trimmed);
        break;
      case 'rename-file':
        onRenameFile(promptState.fileId, trimmed);
        break;
    }
    setPromptState(null);
  };

  const renderInlineInput = (placeholder: string) => (
    <div className="my-1 flex items-center gap-1 rounded border border-[#0a84ff] bg-[#16171a] px-1.5 py-1">
      <input
        ref={inputRef}
        type="text"
        value={promptState?.value ?? ''}
        placeholder={placeholder}
        onChange={(e) =>
          setPromptState((prev) => (prev ? { ...prev, value: e.target.value } : null))
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitPrompt();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setPromptState(null);
          }
        }}
        className="min-w-0 flex-1 bg-transparent font-mono-code text-[11px] text-[#f2f2f7] outline-none placeholder:text-[#636366]"
      />
      <button
        type="button"
        onClick={submitPrompt}
        title="Confirmar"
        className="cursor-pointer rounded p-0.5 text-[#30d158] hover:bg-[#32343a]"
      >
        <Check className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => setPromptState(null)}
        title="Cancelar"
        className="cursor-pointer rounded p-0.5 text-[#8e8e93] hover:bg-[#32343a] hover:text-[#ff6961]"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );

  return (
    <aside className="xcode-panel-border sythm-border sythm-bg-sidebar flex w-68 shrink-0 flex-col border-r">
      {/* Navigator Header + Folder Actions */}
      <div className="sythm-border flex items-center justify-between border-b px-3 py-2">
        <span className="text-[11px] font-semibold tracking-wider text-[#aeaeb2] uppercase">
          Project Navigator
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPromptState({ kind: 'new-folder', value: 'Nova Pasta' })}
            title="Nova Pasta de Projetos"
            className="cursor-pointer rounded p-1 text-[#aeaeb2] transition hover:bg-[#32343a] hover:text-[#64d2ff]"
          >
            <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {confirmReset ? (
            <div className="flex items-center gap-0.5 rounded bg-[#32343a] px-1 py-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  onResetFactory();
                  setConfirmReset(false);
                }}
                className="cursor-pointer px-1 font-semibold text-[#30d158] hover:underline"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="cursor-pointer px-1 text-[#aeaeb2] hover:text-white"
              >
                Não
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              title="Restaurar presets originais de fábrica"
              className="cursor-pointer rounded p-1 text-[#aeaeb2] transition hover:bg-[#32343a] hover:text-[#ffd60a]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="xcode-scroll flex-1 overflow-y-auto p-2">
        {promptState?.kind === 'new-folder' && renderInlineInput('Nome da pasta...')}

        {/* Project Folders Tree */}
        <div className="mb-4 space-y-1.5">
          {folders.map((folder) => {
            const folderFiles = files.filter((file) => file.folderId === folder.id);
            const isRenamingThisFolder =
              promptState?.kind === 'rename-folder' && promptState.folderId === folder.id;

            return (
              <div key={folder.id} className="rounded-md bg-[#202125]/60 p-1">
                {/* Folder Row */}
                {isRenamingThisFolder ? (
                  renderInlineInput('Nome da pasta...')
                ) : (
                  <div className="group flex items-center gap-1 rounded px-1.5 py-1 text-xs font-semibold text-[#d1d1d6] hover:bg-[#2f3036]">
                    <button
                      type="button"
                      onClick={() => onToggleFolder(folder.id)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
                    >
                      {folder.isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#8e8e93]" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#8e8e93]" />
                      )}
                      {folder.isExpanded ? (
                        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#64d2ff]" />
                      ) : (
                        <Folder className="h-3.5 w-3.5 shrink-0 text-[#64d2ff]" />
                      )}
                      <span className="truncate">{folder.name}</span>
                      <span className="ml-auto rounded bg-[#2c2d33] px-1.5 py-0.2 font-mono-code text-[10px] font-normal text-[#8e8e93]">
                        {folderFiles.length}
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5 opacity-80 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() =>
                          setPromptState({
                            kind: 'new-file',
                            folderId: folder.id,
                            value: 'nova-track.sythm',
                          })
                        }
                        title={`Novo arquivo .sythm em "${folder.name}"`}
                        className="cursor-pointer rounded p-0.5 text-[#aeaeb2] hover:bg-[#3c3e46] hover:text-[#30d158]"
                      >
                        <FilePlus2 className="h-3 w-3" />
                      </button>

                      {!folder.isSystem && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPromptState({
                                kind: 'rename-folder',
                                folderId: folder.id,
                                value: folder.name,
                              })
                            }
                            title="Renomear pasta"
                            className="cursor-pointer rounded p-0.5 text-[#aeaeb2] hover:bg-[#3c3e46] hover:text-[#ffd60a]"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteFolder(folder.id)}
                            title="Excluir pasta"
                            className="cursor-pointer rounded p-0.5 text-[#aeaeb2] hover:bg-[#3c3e46] hover:text-[#ff6961]"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* New File Input inside Folder */}
                {promptState?.kind === 'new-file' &&
                  promptState.folderId === folder.id &&
                  renderInlineInput('ex: acid-groove.sythm')}

                {/* Files inside Folder */}
                {folder.isExpanded && (
                  <ul className="mt-0.5 space-y-0.5 pl-3">
                    {folderFiles.length === 0 ? (
                      <li className="px-2 py-1 text-[10px] italic text-[#636366]">
                        Pasta vazia — clique no + acima
                      </li>
                    ) : (
                      folderFiles.map((file) => {
                        const isSelected = file.id === selectedFileId;
                        const isRenamingFile =
                          promptState?.kind === 'rename-file' && promptState.fileId === file.id;

                        if (isRenamingFile) {
                          return <li key={file.id}>{renderInlineInput('Nome .sythm...')}</li>;
                        }

                        return (
                          <li key={file.id} className="group relative flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onSelectFile(file)}
                              className={`flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-[#0a84ff] ${
                                isSelected
                                  ? 'bg-[#0a84ff]/25 text-[#ffffff] ring-1 ring-[#0a84ff]/60'
                                  : 'text-[#d1d1d6] hover:bg-[#32343a]'
                              }`}
                            >
                              <FileCode2
                                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                  isSelected ? 'text-[#64d2ff]' : 'text-[#8e8e93]'
                                }`}
                                aria-hidden="true"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[11px] font-medium">{file.name}</div>
                                <div className="truncate text-[10px] text-[#aeaeb2]">
                                  {file.title}
                                </div>
                              </div>
                            </button>

                            <div className="hidden shrink-0 items-center gap-0.5 pr-1 group-hover:flex">
                              <button
                                type="button"
                                onClick={() =>
                                  setPromptState({
                                    kind: 'rename-file',
                                    fileId: file.id,
                                    value: file.name,
                                  })
                                }
                                title="Renomear arquivo"
                                className="cursor-pointer rounded p-0.5 text-[#8e8e93] hover:bg-[#3c3e46] hover:text-[#ffd60a]"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDuplicateFile(file.id)}
                                title="Duplicar arquivo"
                                className="cursor-pointer rounded p-0.5 text-[#8e8e93] hover:bg-[#3c3e46] hover:text-[#64d2ff]"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                              {files.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteFile(file.id)}
                                  title="Excluir arquivo"
                                  className="cursor-pointer rounded p-0.5 text-[#8e8e93] hover:bg-[#3c3e46] hover:text-[#ff6961]"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {/* Sythm Tutorial — Paginated Interactive Book Trigger */}
        <div className="sythm-border border-t pt-3">
          <button
            type="button"
            onClick={onOpenTutorial}
            aria-label="Abrir Sythm Tutorial em formato de livro paginado"
            className="sythm-border group flex w-full cursor-pointer flex-col gap-2 rounded-xl border bg-[var(--sythm-bg-window)]/85 p-3 text-left transition hover:border-[var(--sythm-accent)] hover:bg-[var(--sythm-accent)]/10 focus-visible:outline-2 focus-visible:outline-[var(--sythm-accent)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="sythm-border sythm-bg-lcd flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[var(--sythm-accent)] transition group-hover:scale-105">
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <span className="text-xs font-bold text-[var(--sythm-text-primary)]">
                  Sythm Tutorial
                </span>
              </div>
              <span className="rounded-full border border-[var(--sythm-accent)]/40 bg-[var(--sythm-accent)]/15 px-2 py-0.5 font-mono-code text-[10px] font-semibold text-[var(--sythm-accent)]">
                12 Cap.
              </span>
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--sythm-text-secondary)]">
              Livro interativo paginado ensinando cada comando e sintaxe do Sythm passo a passo.
            </p>

            <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--sythm-accent)]">
              <span>Abrir manual ilustrado</span>
              <ChevronRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
}
