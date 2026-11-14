import {
  AlertCircle,
  AudioWaveform,
  Check,
  CheckCircle2,
  Download,
  FileAudio,
  Hammer,
  Play,
  Radio,
  Repeat,
  Settings,
  Share2,
  Square,
  Waves,
} from 'lucide-react';
import type { ScheduledAudioEvent, WaveformType } from '@sythm/core';

export type IdeStatus = 'ready' | 'playing' | 'looping' | 'error';

interface XcodeToolbarProps {
  status: IdeStatus;
  loopEnabled: boolean;
  isPlaying: boolean;
  activeTitle: string;
  activeFolderName?: string;
  scaleLabel?: string;
  bpm: number;
  waveform: WaveformType;
  activeEvent: ScheduledAudioEvent | null;
  backendConnected: boolean | null;
  errorCount: number;
  isExportingWav?: boolean;
  shareCopied?: boolean;
  onPlay: () => void;
  onStop: () => void;
  onBuildOnly: () => void;
  onToggleLoop: () => void;
  onExportWav?: () => void;
  onShareUrl?: () => void;
  onOpenSettings?: () => void;
  onOpenAudioImport?: () => void;
  samplesCount?: number;
}

export function XcodeToolbar({
  status,
  loopEnabled,
  isPlaying,
  activeTitle,
  activeFolderName,
  scaleLabel,
  bpm,
  waveform,
  activeEvent,
  backendConnected,
  errorCount,
  isExportingWav = false,
  shareCopied = false,
  onPlay,
  onStop,
  onBuildOnly,
  onToggleLoop,
  onExportWav,
  onShareUrl,
  onOpenSettings,
  onOpenAudioImport,
  samplesCount = 0,
}: XcodeToolbarProps) {
  const statusLabel =
    status === 'error'
      ? `Build Failed (${errorCount} ${errorCount === 1 ? 'erro' : 'erros'})`
      : status === 'looping'
        ? 'Looping'
        : status === 'playing'
          ? 'Playing'
          : 'Ready';

  return (
    <header className="xcode-panel-border sythm-border sythm-bg-toolbar flex h-13 shrink-0 items-center justify-between gap-3 border-b px-4 select-none">
      {/* Left: Web App Brand + Transport */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="sythm-border sythm-bg-lcd flex h-7 w-7 items-center justify-center rounded-md border text-[var(--sythm-accent)]">
            <AudioWaveform className="h-4 w-4" aria-hidden="true" />
          </div>
          <h1 className="text-sm font-semibold tracking-tight text-[var(--sythm-text-primary)]">Sythm</h1>
        </div>

        <div className="sythm-border flex items-center gap-1.5 border-l pl-4">
          <button
            type="button"
            onClick={onPlay}
            title="Compilar e Tocar (Ctrl+Enter)"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#0a84ff] bg-[#0a84ff] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1e8eff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#64d2ff]"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            <span>{isPlaying ? 'Reload' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isPlaying) return;
              onStop();
            }}
            aria-disabled={!isPlaying}
            title="Parar Execução"
            className={`inline-flex items-center gap-1.5 rounded-md border border-[#4a4d55] bg-[#35373d] px-2.5 py-1.5 text-xs font-medium text-[#f2f2f7] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a84ff] ${
              isPlaying ? 'cursor-pointer hover:bg-[#41434a]' : 'cursor-not-allowed opacity-45'
            }`}
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            <span>Stop</span>
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            aria-pressed={loopEnabled}
            title="Alternar Loop Contínuo (Live Coding)"
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a84ff] ${
              loopEnabled
                ? 'border-[#30d158] bg-[#1e3a28] text-[#6ee787]'
                : 'border-[#4a4d55] bg-[#35373d] text-[#d1d1d6] hover:bg-[#41434a]'
            }`}
          >
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Loop: {loopEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={onBuildOnly}
            title="Apenas Compilar (Lexer + Parser + Plano)"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#4a4d55] bg-[#35373d] px-2.5 py-1.5 text-xs font-medium text-[#d1d1d6] transition hover:bg-[#41434a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a84ff]"
          >
            <Hammer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Compile</span>
          </button>
        </div>
      </div>

      {/* Center: Xcode LCD Status Display */}
      <div className="xcode-panel-border sythm-border sythm-bg-lcd flex min-w-0 flex-1 max-w-2xl items-center justify-between gap-4 rounded-md border px-3.5 py-1.5 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          {status === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-[#ff6961]" aria-hidden="true" />
          ) : isPlaying ? (
            <Radio className="h-4 w-4 shrink-0 text-[#30d158]" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#64d2ff]" aria-hidden="true" />
          )}
          <span className="truncate font-semibold text-[#f2f2f7]">
            {activeFolderName ? (
              <>
                <span className="font-normal text-[#8e8e93]">{activeFolderName} / </span>
                {activeTitle}
              </>
            ) : (
              activeTitle
            )}
          </span>
          <span className="text-[#8e8e93]" aria-hidden="true">
            •
          </span>
          <span
            className={`shrink-0 font-medium ${
              status === 'error'
                ? 'text-[#ff8a80]'
                : isPlaying
                  ? 'text-[#6ee787]'
                  : 'text-[#aeaeb2]'
            }`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3 font-mono-code text-[11px] text-[#d1d1d6]">
          {activeEvent && activeEvent.type === 'drum' ? (
            <span className="rounded bg-[#ff9f0a]/20 px-2 py-0.5 text-[#ffb340]">
              [{activeEvent.trackName}] {activeEvent.notes.join(' ')} • L{activeEvent.line}
            </span>
          ) : activeEvent && activeEvent.type !== 'rest' ? (
            <span className="rounded bg-[#0a84ff]/20 px-2 py-0.5 text-[#70c4ff]">
              [{activeEvent.trackName}] {activeEvent.notes.join(' ')} ({activeEvent.frequencies[0]} Hz) • L{activeEvent.line}
            </span>
          ) : activeEvent?.type === 'rest' ? (
            <span className="rounded bg-[#3a3a3c] px-2 py-0.5 text-[#d1d1d6]">
              [{activeEvent.trackName}] REST • L{activeEvent.line}
            </span>
          ) : null}

          <span className="inline-flex items-center gap-1 text-[#aeaeb2]">
            <Waves className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {bpm} BPM · {waveform.toUpperCase()}
              {scaleLabel ? ` · ${scaleLabel}` : ''}
            </span>
          </span>
        </div>
      </div>

      {/* Right: Import Audio, Export .WAV, Share Link, Status & Settings */}
      <div className="flex shrink-0 items-center gap-1.5 text-xs">
        {onOpenAudioImport && (
          <button
            type="button"
            onClick={onOpenAudioImport}
            title="Importar .MP3/.WAV (Sampler PLAY SAMPLE ou Transcritor DSP para Código)"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#4a4d55] bg-[#35373d] px-2.5 py-1 text-xs font-medium text-[#d1d1d6] transition hover:bg-[#41434a] focus-visible:outline-2 focus-visible:outline-[var(--sythm-accent)]"
          >
            <FileAudio className="h-3.5 w-3.5 text-[#30d158]" aria-hidden="true" />
            <span className="hidden md:inline">Importar Áudio</span>
            {samplesCount > 0 && (
              <span className="rounded-full bg-[var(--sythm-accent)]/25 px-1.5 font-mono-code text-[10px] font-bold text-[#70c4ff]">
                {samplesCount}
              </span>
            )}
          </button>
        )}

        {onExportWav && (
          <button
            type="button"
            onClick={onExportWav}
            disabled={isExportingWav}
            title="Renderizar faixa offline em áudio estéreo .WAV"
            className="hidden sm:inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#4a4d55] bg-[#35373d] px-2.5 py-1 text-xs font-medium text-[#d1d1d6] transition hover:bg-[#41434a] disabled:cursor-wait disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-[#64d2ff]" aria-hidden="true" />
            <span>{isExportingWav ? 'Exporting...' : '.WAV'}</span>
          </button>
        )}

        {onShareUrl && (
          <button
            type="button"
            onClick={onShareUrl}
            title="Copiar link compartilhável com o código"
            className={`hidden sm:inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              shareCopied
                ? 'border-[#2f6f44] bg-[#1b2e22] text-[#7ae582]'
                : 'border-[#4a4d55] bg-[#35373d] text-[#d1d1d6] hover:bg-[#41434a]'
            }`}
          >
            {shareCopied ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Share2 className="h-3.5 w-3.5 text-[#b281eb]" aria-hidden="true" />
            )}
            <span>{shareCopied ? 'Copied!' : 'Share'}</span>
          </button>
        )}
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium ${
            backendConnected
              ? 'border-[#2f6f44] bg-[#1b2e22] text-[#7ae582]'
              : 'border-[#5a4a2a] bg-[#2a2418] text-[#ffd60a]'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              backendConnected ? 'bg-[#30d158]' : 'bg-[#ffd60a]'
            }`}
            aria-hidden="true"
          />
          <span>{backendConnected ? 'API Connected' : 'Local Engine'}</span>
        </span>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title="Configurações & Temas Personalizados (VS Code Style)"
            aria-label="Abrir configurações e temas"
            className="sythm-border sythm-bg-lcd inline-flex cursor-pointer items-center justify-center rounded-md border p-1.5 text-[var(--sythm-text-primary)] transition hover:border-[var(--sythm-accent)] hover:text-[var(--sythm-accent)] focus-visible:outline-2 focus-visible:outline-[var(--sythm-accent)]"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}
