import {
  AudioWaveform,
  Check,
  Code2,
  FileAudio,
  Layers,
  Play,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { type AudioSampleItem } from '../../infrastructure/audio/AudioSampleStore';
import {
  type AudioIntegrationMode,
  analyzeAudioBufferForSythm,
  generateSythmFromAudio,
} from '../../infrastructure/audio/AudioToSythmTranscriber';

export interface AudioImportModalProps {
  isOpen: boolean;
  samples: AudioSampleItem[];
  onImportFiles: (files: FileList | File[]) => Promise<AudioSampleItem | null>;
  onCreateDemoSample: () => Promise<AudioSampleItem | null>;
  onDeleteSample: (id: string) => void;
  onInsertSampleCommand: (sampleName: string, beats: number) => void;
  onLoadGeneratedProgram: (code: string, title: string, andPlay: boolean) => void;
  onClose: () => void;
}

const MODE_CARDS: {
  id: AudioIntegrationMode;
  title: string;
  subtitle: string;
  icon: typeof FileAudio;
}[] = [
  {
    id: 'sample',
    title: 'Áudio Base (PLAY SAMPLE)',
    subtitle: 'Toca o .mp3/.wav original dentro do Sythm com Filtros, Reverb e Sliders.',
    icon: FileAudio,
  },
  {
    id: 'transcribe',
    title: 'Converter em Código',
    subtitle: 'Analisa BPM, Bateria, Baixo e Melodia via DSP e cria tracks .sythm puras.',
    icon: Code2,
  },
  {
    id: 'hybrid',
    title: 'Híbrido (Áudio + Código)',
    subtitle: 'Mixa a TRACK AUDIO-ORIGINAL junto com as tracks extraídas sincronizadas.',
    icon: Layers,
  },
];

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return mins > 0 ? `${mins}:${rem.toFixed(1).padStart(4, '0')}` : `${sec.toFixed(1)}s`;
}

export function AudioImportModal({
  isOpen,
  samples,
  onImportFiles,
  onCreateDemoSample,
  onDeleteSample,
  onInsertSampleCommand,
  onLoadGeneratedProgram,
  onClose,
}: AudioImportModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const previewSrcRef = useRef<AudioBufferSourceNode | null>(null);

  const titleId = useId();
  const [selectedSampleId, setSelectedSampleId] = useState<string>('');
  const [mode, setMode] = useState<AudioIntegrationMode>('hybrid');
  const [analysisBeats, setAnalysisBeats] = useState<16 | 32>(16);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      previewSrcRef.current?.stop();
      previewSrcRef.current = null;
      setPreviewPlayingId(null);
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (samples.length === 0) {
      setSelectedSampleId('');
      return;
    }
    if (!samples.some((s) => s.id === selectedSampleId)) {
      setSelectedSampleId(samples[0].id);
    }
  }, [samples, selectedSampleId]);

  useEffect(() => {
    return () => {
      previewSrcRef.current?.stop();
      void previewCtxRef.current?.close();
    };
  }, []);

  const selectedSample = useMemo(
    () => samples.find((s) => s.id === selectedSampleId) ?? samples[0] ?? null,
    [samples, selectedSampleId],
  );

  const analysis = useMemo(() => {
    if (!selectedSample) return null;
    return analyzeAudioBufferForSythm(selectedSample.buffer, analysisBeats);
  }, [selectedSample, analysisBeats]);

  const generatedCode = useMemo(() => {
    if (!selectedSample || !analysis) return '';
    return generateSythmFromAudio(selectedSample.name, analysis, mode);
  }, [selectedSample, analysis, mode]);

  const handleBackdropFallbackClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if ('closedBy' in HTMLDialogElement.prototype) return;
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const clickedInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!clickedInside) {
      dialog.close();
    }
  };

  const handleFilesSelected = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setIsBusy(true);
    setErrorMsg(null);
    try {
      const imported = await onImportFiles(files);
      if (imported) {
        setSelectedSampleId(imported.id);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Falha ao decodificar áudio: ${err.message}`
          : 'Não foi possível decodificar este arquivo de áudio.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateDemo = async () => {
    setIsBusy(true);
    setErrorMsg(null);
    try {
      const demo = await onCreateDemoSample();
      if (demo) {
        setSelectedSampleId(demo.id);
      }
    } catch {
      setErrorMsg('Não foi possível sintetizar o sample de demonstração.');
    } finally {
      setIsBusy(false);
    }
  };

  const toggleSamplePreview = (item: AudioSampleItem) => {
    if (previewPlayingId === item.id) {
      try {
        previewSrcRef.current?.stop();
      } catch {
        // Ignore
      }
      previewSrcRef.current = null;
      setPreviewPlayingId(null);
      return;
    }

    try {
      previewSrcRef.current?.stop();
    } catch {
      // Ignore
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!previewCtxRef.current || previewCtxRef.current.state === 'closed') {
      previewCtxRef.current = new AudioCtx();
    }
    const ctx = previewCtxRef.current;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const src = ctx.createBufferSource();
    src.buffer = item.buffer;
    src.connect(ctx.destination);
    src.onended = () => {
      if (previewSrcRef.current === src) {
        previewSrcRef.current = null;
        setPreviewPlayingId(null);
      }
    };
    previewSrcRef.current = src;
    setPreviewPlayingId(item.id);
    src.start(0);
  };

  const handleApplyAndClose = (andPlay: boolean) => {
    if (!selectedSample || !generatedCode) return;
    previewSrcRef.current?.stop();
    setPreviewPlayingId(null);
    onLoadGeneratedProgram(generatedCode, selectedSample.name, andPlay);
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={handleBackdropFallbackClick}
      className="sythm-border sythm-bg-sidebar m-auto w-[min(1060px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border p-0 text-[var(--sythm-text-primary)] shadow-2xl"
    >
      <div className="flex h-[min(760px,88vh)] flex-col">
        {/* Header */}
        <header className="sythm-border sythm-bg-toolbar flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="sythm-border sythm-bg-lcd flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[var(--sythm-accent)]">
              <FileAudio className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-sm font-bold text-[var(--sythm-text-primary)]">
                Importar Áudio Externo (.MP3 / .WAV) &amp; Transcritor DSP
              </h2>
              <p className="truncate text-xs text-[var(--sythm-text-secondary)]">
                Mixe arquivos reais via PLAY SAMPLE ou extraia BPM, Bateria, Baixo e Melodia para código .sythm
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar importador de áudio"
            className="sythm-border sythm-bg-lcd inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-[var(--sythm-text-primary)] transition hover:opacity-85"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Fechar</span>
          </button>
        </header>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Left Column: Upload & Loaded Samples */}
          <aside className="xcode-scroll sythm-border sythm-bg-window flex shrink-0 flex-col gap-4 border-b p-4 lg:w-84 lg:overflow-y-auto lg:border-r lg:border-b-0">
            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void handleFilesSelected(e.dataTransfer.files);
              }}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition ${
                isDragging
                  ? 'border-[var(--sythm-accent)] bg-[var(--sythm-accent)]/15'
                  : 'sythm-border bg-[var(--sythm-bg-sidebar)]/60'
              }`}
            >
              <Upload className="h-6 w-6 text-[var(--sythm-accent)]" aria-hidden="true" />
              <div className="text-xs font-semibold text-[var(--sythm-text-primary)]">
                Arraste um .MP3, .WAV ou .OGG aqui
              </div>
              <p className="text-[11px] text-[var(--sythm-text-secondary)]">
                Salvo localmente no navegador (IndexedDB)
              </p>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--sythm-accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isBusy ? 'Decodificando...' : 'Escolher Arquivo'}</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleCreateDemo()}
                  className="sythm-border sythm-bg-toolbar inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-[var(--sythm-text-primary)] transition hover:opacity-90 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#ffd60a]" aria-hidden="true" />
                  <span>Gerar Demo Loop</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".mp3,.wav,.ogg,.m4a,.webm,audio/*"
                onChange={(e) => {
                  void handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-[#ff453a]/50 bg-[#ff453a]/15 px-3 py-2 text-xs text-[#ff9f96]">
                {errorMsg}
              </div>
            )}

            {/* Loaded Samples Library */}
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-[var(--sythm-text-secondary)] uppercase">
                <span>Biblioteca de Áudios ({samples.length})</span>
              </div>

              {samples.length === 0 ? (
                <div className="sythm-border rounded-xl border bg-[var(--sythm-bg-sidebar)]/40 p-4 text-center text-xs text-[var(--sythm-text-secondary)]">
                  Nenhum áudio carregado ainda. Escolha um `.mp3`/`.wav` ou clique em{' '}
                  <strong>Gerar Demo Loop</strong> acima para testar na hora!
                </div>
              ) : (
                <ul className="space-y-2">
                  {samples.map((item) => {
                    const isSelected = selectedSample?.id === item.id;
                    const isPreviewing = previewPlayingId === item.id;
                    return (
                      <li
                        key={item.id}
                        className={`rounded-xl border p-2.5 transition ${
                          isSelected
                            ? 'border-[var(--sythm-accent)] bg-[var(--sythm-accent)]/12'
                            : 'sythm-border bg-[var(--sythm-bg-sidebar)]/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedSampleId(item.id)}
                            className="min-w-0 flex-1 cursor-pointer text-left"
                          >
                            <div className="truncate text-xs font-semibold text-[var(--sythm-text-primary)]">
                              {item.name}
                            </div>
                            <div className="mt-0.5 font-mono-code text-[10px] text-[var(--sythm-text-secondary)]">
                              {formatDuration(item.durationSec)} ·{' '}
                              {Math.round(item.sampleRate / 100) / 10}kHz · {item.channels}ch
                            </div>
                          </button>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleSamplePreview(item)}
                              title={isPreviewing ? 'Parar prévia' : 'Ouvir áudio original'}
                              className="sythm-border sythm-bg-lcd cursor-pointer rounded-md border p-1.5 text-[var(--sythm-text-primary)] hover:text-[var(--sythm-accent)]"
                            >
                              {isPreviewing ? (
                                <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                              ) : (
                                <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSample(item.id)}
                              title="Remover áudio da biblioteca"
                              className="sythm-border sythm-bg-lcd cursor-pointer rounded-md border p-1.5 text-[var(--sythm-text-secondary)] hover:text-[#ff6961]"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Right Column: Analysis Results + Integration Mode + Code Preview */}
          <div className="xcode-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            {!selectedSample || !analysis ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <AudioWaveform className="h-12 w-12 text-[var(--sythm-accent)] opacity-70" aria-hidden="true" />
                <h3 className="text-base font-bold text-[var(--sythm-text-primary)]">
                  Selecione ou importe um arquivo de áudio
                </h3>
                <p className="max-w-md text-xs leading-relaxed text-[var(--sythm-text-secondary)]">
                  Você pode usar seu `.mp3` / `.wav` diretamente como base sincronizada via{' '}
                  <code>PLAY SAMPLE</code> ou pedir ao analisador DSP para extrair BPM, Bateria,
                  Baixo e Melodia em código Sythm editável.
                </p>
              </div>
            ) : (
              <>
                {/* DSP Telemetry Summary */}
                <div className="sythm-border rounded-xl border bg-[var(--sythm-bg-window)]/80 p-3.5">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-[var(--sythm-accent)]" aria-hidden="true" />
                      <span className="text-xs font-bold text-[var(--sythm-text-primary)]">
                        Análise DSP Automática — {selectedSample.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-[var(--sythm-text-secondary)]">Janela:</span>
                      {([16, 32] as const).map((beats) => (
                        <button
                          key={beats}
                          type="button"
                          onClick={() => setAnalysisBeats(beats)}
                          className={`cursor-pointer rounded border px-2 py-0.5 font-mono-code font-semibold transition ${
                            analysisBeats === beats
                              ? 'border-[var(--sythm-accent)] bg-[var(--sythm-accent)] text-white'
                              : 'sythm-border sythm-bg-lcd text-[var(--sythm-text-secondary)]'
                          }`}
                        >
                          {beats} Beats
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div className="sythm-border sythm-bg-lcd rounded-lg border px-2.5 py-2">
                      <div className="text-[10px] text-[var(--sythm-text-secondary)]">BPM Detectado</div>
                      <div className="font-mono-code text-sm font-bold text-[var(--sythm-accent)]">
                        {analysis.detectedBpm} BPM
                      </div>
                    </div>
                    <div className="sythm-border sythm-bg-lcd rounded-lg border px-2.5 py-2">
                      <div className="text-[10px] text-[var(--sythm-text-secondary)]">Escala</div>
                      <div className="truncate font-mono-code text-sm font-bold text-[#ffd60a]">
                        {analysis.detectedScale}
                      </div>
                    </div>
                    <div className="sythm-border sythm-bg-lcd rounded-lg border px-2.5 py-2">
                      <div className="text-[10px] text-[var(--sythm-text-secondary)]">Bateria</div>
                      <div className="font-mono-code text-sm font-bold text-[#ff9f0a]">
                        {analysis.drumHitsCount} hits
                      </div>
                    </div>
                    <div className="sythm-border sythm-bg-lcd rounded-lg border px-2.5 py-2">
                      <div className="text-[10px] text-[var(--sythm-text-secondary)]">Baixo</div>
                      <div className="font-mono-code text-sm font-bold text-[#6bdfff]">
                        {analysis.bassNotesCount} notas
                      </div>
                    </div>
                    <div className="sythm-border sythm-bg-lcd rounded-lg border px-2.5 py-2">
                      <div className="text-[10px] text-[var(--sythm-text-secondary)]">Melodia</div>
                      <div className="font-mono-code text-sm font-bold text-[#30d158]">
                        {analysis.melodyNotesCount} notas
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {MODE_CARDS.map((card) => {
                    const Icon = card.icon;
                    const active = mode === card.id;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setMode(card.id)}
                        aria-pressed={active}
                        className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 text-left transition ${
                          active
                            ? 'border-[var(--sythm-accent)] bg-[var(--sythm-accent)]/15'
                            : 'sythm-border bg-[var(--sythm-bg-window)]/70 hover:border-[var(--sythm-text-secondary)]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Icon
                            className={`h-4 w-4 ${active ? 'text-[var(--sythm-accent)]' : 'text-[var(--sythm-text-secondary)]'}`}
                            aria-hidden="true"
                          />
                          {active && <Check className="h-4 w-4 text-[var(--sythm-accent)]" aria-hidden="true" />}
                        </div>
                        <div className="text-xs font-bold text-[var(--sythm-text-primary)]">
                          {card.title}
                        </div>
                        <p className="text-[11px] leading-snug text-[var(--sythm-text-secondary)]">
                          {card.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Generated Code Preview */}
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--sythm-text-secondary)]">
                    <span>Código `.sythm` Gerado (Preview):</span>
                    <span className="font-mono-code text-[11px]">
                      {generatedCode.split('\n').length} linhas
                    </span>
                  </div>
                  <pre className="xcode-scroll sythm-border sythm-bg-editor sythm-color-swatch min-h-48 flex-1 overflow-auto rounded-xl border p-3.5 font-mono-code text-xs leading-5 text-[var(--sythm-text-primary)]">
                    <code>{generatedCode}</code>
                  </pre>
                </div>

                {/* Actions Footer */}
                <div className="sythm-border flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      onInsertSampleCommand(
                        selectedSample.name,
                        Math.max(4, Math.round(analysis.estimatedTotalBeats)),
                      );
                      dialogRef.current?.close();
                    }}
                    className="sythm-border sythm-bg-toolbar inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-[var(--sythm-text-primary)] transition hover:opacity-90"
                  >
                    <Plus className="h-3.5 w-3.5 text-[var(--sythm-accent)]" aria-hidden="true" />
                    <span>Inserir Apenas Linha PLAY SAMPLE</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyAndClose(false)}
                      className="sythm-border sythm-bg-lcd inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-[var(--sythm-text-primary)] transition hover:opacity-90"
                    >
                      <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Carregar no Editor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyAndClose(true)}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--sythm-accent)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      <span>Carregar e Tocar Agora</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
