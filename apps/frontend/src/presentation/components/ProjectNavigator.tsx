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
  GripVertical,
  Pencil,
  Play,
  Plus,
  Puzzle,
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
  readonly onPreviewComponent?: (snippet: string) => void;
  readonly onInsertComponent?: (snippet: string) => void;
}

interface ReadyComponentItem {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly snippet: string;
}

const SYTHM_READY_COMPONENTS: ReadyComponentItem[] = [
  {
    id: 'comp-acid-bass',
    name: 'Acid Bass 303',
    tag: 'BASS',
    snippet: `  TRACK ACID-BASS.
    WAVE IS ACID-BASS.
    VOLUME IS 65.
    FILTER IS LOWPASS 1400 HZ Q 3.
    PLAY NOTES C2 C2 Eb2 G2 C2 Bb1 C2 F2 FOR 0.5 BEATS.
  END-TRACK.\n`,
  },
  {
    id: 'comp-sub-808',
    name: 'Sub-808 Groove',
    tag: 'BASS',
    snippet: `  TRACK SUB-808.
    WAVE IS SUB-808.
    VOLUME IS 75.
    PLAY NOTES C1 C1 G1 Eb1 FOR 1 BEAT.
  END-TRACK.\n`,
  },
  {
    id: 'comp-kick-4x4',
    name: 'Kick 4x4',
    tag: 'DRUM',
    snippet: `  TRACK KICK-4X4.
    VOLUME IS 85.
    PATTERN KICK IS "x... x... x... x...".
  END-TRACK.\n`,
  },
  {
    id: 'comp-trap-hats',
    name: 'Trap Hi-Hats',
    tag: 'DRUM',
    snippet: `  TRACK TRAP-HATS.
    VOLUME IS 60.
    PATTERN HIHAT IS "x.xx o.X. x.xx oXXX".
  END-TRACK.\n`,
  },
  {
    id: 'comp-fm-chords',
    name: 'FM Keys Chords',
    tag: 'CHORD',
    snippet: `  TRACK FM-CHORDS.
    WAVE IS FM-KEYS.
    VOLUME IS 55.
    REVERB IS 30 PERCENT.
    PLAY CHORDS Cm7 Abmaj7 Fm7 G7 FOR 2 BEATS.
  END-TRACK.\n`,
  },
  {
    id: 'comp-warm-pad',
    name: 'Warm Pad',
    tag: 'PAD',
    snippet: `  TRACK WARM-PAD.
    WAVE IS PAD-WARM.
    VOLUME IS 45.
    REVERB IS 50 PERCENT.
    PLAY CHORD Cm9 FOR 4 BEATS.
  END-TRACK.\n`,
  },
  {
    id: 'comp-euclid-perc',
    name: 'Euclidean Perc',
    tag: 'PERC',
    snippet: `  TRACK EUCLID-PERC.
    VOLUME IS 70.
    PLAY EUCLIDEAN PERC 5 IN 16 FOR 0.25 BEATS.
  END-TRACK.\n`,
  },
  {
    id: 'comp-filter-ramp',
    name: 'Filter Ramp',
    tag: 'FX',
    snippet: `    RAMP FILTER FROM 250 TO 3600 OVER 8 BEATS.\n`,
  },
];

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
  onPreviewComponent,
  onInsertComponent,
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

        {/* Ready-to-use Drag & Play Components */}
        <div className="sythm-border border-t pt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Puzzle className="h-3.5 w-3.5 text-[#64d2ff]" aria-hidden="true" />
              <span className="text-[11px] font-semibold tracking-wider text-[#aeaeb2] uppercase">
                Componentes
              </span>
            </div>
            <span className="text-[10px] text-[#8e8e93]">Clique / Arraste</span>
          </div>

          <ul className="space-y-1.5">
            {SYTHM_READY_COMPONENTS.map((comp) => (
              <li
                key={comp.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-sythm-component', comp.snippet);
                  e.dataTransfer.setData('text/plain', comp.snippet);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                title="Clique no Play para ouvir ou arraste para o editor de código"
                className="group flex cursor-grab items-center justify-between gap-1.5 rounded-lg border border-[#3d3f45] bg-[var(--sythm-bg-window)]/80 px-2 py-1.5 transition hover:border-[var(--sythm-accent)]/60 hover:bg-[#2a2b30] active:cursor-grabbing"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <GripVertical className="h-3 w-3 shrink-0 text-[#636366]" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-medium text-[#f2f2f7]">
                      {comp.name}
                    </div>
                    <div className="font-mono-code text-[9px] text-[#8e8e93]">{comp.tag}</div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {onPreviewComponent && (
                    <button
                      type="button"
                      onClick={() => onPreviewComponent(comp.snippet)}
                      title={`Tocar preview de ${comp.name}`}
                      className="flex h-5 w-5 cursor-pointer items-center justify-center rounded bg-[#30d158]/20 text-[#6ee787] transition hover:bg-[#30d158]/35"
                    >
                      <Play className="h-2.5 w-2.5 fill-current" />
                    </button>
                  )}
                  {onInsertComponent && (
                    <button
                      type="button"
                      onClick={() => onInsertComponent(comp.snippet)}
                      title={`Inserir ${comp.name} no código`}
                      className="flex h-5 w-5 cursor-pointer items-center justify-center rounded bg-[#0a84ff]/20 text-[#70c4ff] transition hover:bg-[#0a84ff]/35"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
