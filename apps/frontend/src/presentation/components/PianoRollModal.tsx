import { Music, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ExecutionPlan, WaveformType } from '@sythm/core';
import type { WebAudioEngine } from '../../infrastructure/audio/WebAudioEngine';

interface PianoRollModalProps {
  isOpen: boolean;
  audioEngine: WebAudioEngine | null;
  plan: ExecutionPlan | null;
  isPlaying: boolean;
  onInsertSnippet: (snippet: string) => void;
  onClose: () => void;
}

interface PianoKeyDef {
  readonly note: string;
  readonly label: string;
  readonly freqHz: number;
  readonly isBlack: boolean;
  readonly shortcut?: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const BLACK_INDICES = new Set([1, 3, 6, 8, 10]);

const KEYBOARD_SHORTCUTS: Record<string, string> = {
  a: 'C4',
  w: 'C#4',
  s: 'D4',
  e: 'Eb4',
  d: 'E4',
  f: 'F4',
  t: 'F#4',
  g: 'G4',
  y: 'Ab4',
  h: 'A4',
  u: 'Bb4',
  j: 'B4',
  k: 'C5',
};

function buildPianoKeys(startMidi: number, endMidi: number): PianoKeyDef[] {
  const keys: PianoKeyDef[] = [];
  const shortcutByNote = new Map<string, string>();
  for (const [k, n] of Object.entries(KEYBOARD_SHORTCUTS)) {
    shortcutByNote.set(n, k.toUpperCase());
  }

  for (let midi = startMidi; midi <= endMidi; midi += 1) {
    const idx = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    const note = `${NOTE_NAMES[idx]}${octave}`;
    const freqHz = 440 * Math.pow(2, (midi - 69) / 12);
    keys.push({
      note,
      label: note,
      freqHz,
      isBlack: BLACK_INDICES.has(idx),
      shortcut: shortcutByNote.get(note),
    });
  }
  return keys;
}

export function PianoRollModal({
  isOpen,
  audioEngine,
  plan,
  onInsertSnippet,
  onClose,
}: PianoRollModalProps) {
  const [capturedNotes, setCapturedNotes] = useState<string[]>([]);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [stepBeats, setStepBeats] = useState<number>(0.5);
  const [previewWave, setPreviewWave] = useState<WaveformType>('triangle');
  const [recordClicks, setRecordClicks] = useState<boolean>(true);

  const keys = useMemo(() => buildPianoKeys(48, 72), []); // C3 to C5 (2 octaves)
  const whiteKeys = useMemo(() => keys.filter((k) => !k.isBlack), [keys]);

  const playKey = useCallback(
    (key: PianoKeyDef) => {
      setActiveNote(key.note);
      void audioEngine?.previewNote(key.freqHz, previewWave, 0.35);
      if (recordClicks) {
        setCapturedNotes((prev) => [...prev.slice(-31), key.note]);
      }
      window.setTimeout(() => {
        setActiveNote((curr) => (curr === key.note ? null : curr));
      }, 180);
    },
    [audioEngine, previewWave, recordClicks],
  );

  // Computer keyboard playback while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const mappedNote = KEYBOARD_SHORTCUTS[e.key.toLowerCase()];
      if (!mappedNote) return;
      const found = keys.find((k) => k.note === mappedNote);
      if (found) {
        e.preventDefault();
        playKey(found);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, keys, onClose, playKey]);

  if (!isOpen) return null;

  const handlePlayCapturedSequence = () => {
    if (capturedNotes.length === 0 || !audioEngine) return;
    capturedNotes.forEach((noteName, index) => {
      const found = keys.find((k) => k.note === noteName);
      if (!found) return;
      window.setTimeout(() => {
        setActiveNote(found.note);
        void audioEngine.previewNote(found.freqHz, previewWave, 0.28);
        window.setTimeout(() => {
          setActiveNote((curr) => (curr === found.note ? null : curr));
        }, 160);
      }, index * 220);
    });
  };

  const handleInsertIntoCode = () => {
    if (capturedNotes.length === 0) return;
    const snippet =
      capturedNotes.length === 1
        ? `PLAY NOTE ${capturedNotes[0]} FOR ${stepBeats} BEATS.\n`
        : `PLAY NOTES ${capturedNotes.join(' ')} FOR ${stepBeats} BEATS.\n`;
    onInsertSnippet(snippet);
    setCapturedNotes([]);
    onClose();
  };

  // Group black keys positioned relative to white keys
  const whiteKeyIndexMap = new Map<string, number>();
  whiteKeys.forEach((wk, idx) => whiteKeyIndexMap.set(wk.note, idx));

  const getBlackKeyLeftPercent = (midiIndex: number): number => {
    // Find preceding white key
    const prevKey = keys[midiIndex - 1];
    const whiteIdx = prevKey ? (whiteKeyIndexMap.get(prevKey.note) ?? 0) : 0;
    const whiteWidth = 100 / whiteKeys.length;
    return (whiteIdx + 0.68) * whiteWidth;
  };

  const recentPlanNotes = (plan?.events ?? [])
    .filter((e) => e.type === 'note' || e.type === 'chord')
    .slice(0, 16);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Piano Roll Interativo"
    >
      <div className="sythm-border sythm-bg-sidebar flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="sythm-border flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Music className="h-4 w-4 text-[#64d2ff]" />
            <div>
              <h2 className="text-sm font-bold text-[var(--sythm-text-primary)]">
                Piano Roll Interativo
              </h2>
              <p className="text-[11px] text-[#8e8e93]">
                Clique nas teclas ou use o teclado do PC (A–K, W/E/T/Y/U) para tocar e montar melodias
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-[#aeaeb2] hover:bg-white/10 hover:text-white"
            aria-label="Fechar Piano Roll"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="sythm-border flex flex-wrap items-center justify-between gap-3 border-b bg-[#1c1d21] px-5 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-[#aeaeb2]">
              <span>Timbre:</span>
              <select
                value={previewWave}
                onChange={(e) => setPreviewWave(e.target.value as WaveformType)}
                className="rounded border border-[#4a4d55] bg-[#2a2b30] px-2 py-1 text-xs text-white outline-none"
              >
                <option value="triangle">TRIANGLE</option>
                <option value="sine">SINE</option>
                <option value="sawtooth">SAW</option>
                <option value="square">SQUARE</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-[#aeaeb2]">
              <span>Duração:</span>
              <select
                value={stepBeats}
                onChange={(e) => setStepBeats(Number(e.target.value))}
                className="rounded border border-[#4a4d55] bg-[#2a2b30] px-2 py-1 text-xs text-white outline-none"
              >
                <option value={0.25}>0.25 beat</option>
                <option value={0.5}>0.5 beats</option>
                <option value={1}>1 beat</option>
                <option value={2}>2 beats</option>
              </select>
            </label>

            <label className="flex cursor-pointer items-center gap-1.5 text-[#d1d1d6]">
              <input
                type="checkbox"
                checked={recordClicks}
                onChange={(e) => setRecordClicks(e.target.checked)}
                className="accent-[#0a84ff]"
              />
              <span>Capturar notas clicadas</span>
            </label>
          </div>

          {activeNote && (
            <span className="rounded bg-[#0a84ff]/20 px-2.5 py-0.5 font-mono-code text-xs font-bold text-[#64d2ff]">
              Tocando: {activeNote}
            </span>
          )}
        </div>

        {/* Playable 2-Octave Piano Keyboard */}
        <div className="bg-[#121316] p-5">
          <div className="relative h-48 w-full select-none overflow-hidden rounded-lg border border-[#3d3f45] bg-[#18191d] shadow-inner">
            {/* White Keys */}
            <div className="flex h-full w-full">
              {whiteKeys.map((wk) => {
                const isPressed = activeNote === wk.note;
                return (
                  <button
                    key={wk.note}
                    type="button"
                    onMouseDown={() => playKey(wk)}
                    className={`relative flex flex-1 cursor-pointer flex-col items-center justify-end border-r border-[#2c2d33] pb-2.5 transition-colors last:border-r-0 ${
                      isPressed
                        ? 'bg-[#64d2ff] text-[#0b1220]'
                        : 'bg-[#f4f4f6] text-[#3a3a3c] hover:bg-[#e3f2fd]'
                    }`}
                  >
                    {wk.shortcut && (
                      <span className="mb-1 rounded bg-black/10 px-1 font-mono-code text-[9px] font-bold">
                        {wk.shortcut}
                      </span>
                    )}
                    <span className="font-mono-code text-[10px] font-bold">{wk.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Black Keys */}
            {keys.map((k, idx) => {
              if (!k.isBlack) return null;
              const isPressed = activeNote === k.note;
              const leftPct = getBlackKeyLeftPercent(idx);
              const widthPct = (100 / whiteKeys.length) * 0.64;

              return (
                <button
                  key={k.note}
                  type="button"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    playKey(k);
                  }}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className={`absolute top-0 z-10 flex h-[60%] cursor-pointer flex-col items-center justify-end rounded-b-md border border-[#101012] pb-2 shadow-lg transition-colors ${
                    isPressed
                      ? 'bg-[#0a84ff] text-white'
                      : 'bg-[#232429] text-[#d1d1d6] hover:bg-[#34363e]'
                  }`}
                >
                  {k.shortcut && (
                    <span className="mb-0.5 font-mono-code text-[9px] text-[#64d2ff]">
                      {k.shortcut}
                    </span>
                  )}
                  <span className="font-mono-code text-[9px] font-semibold">{k.label}</span>
                </button>
              );
            })}
          </div>

          {/* Current Track Notes Quick Preview */}
          {recentPlanNotes.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-[#8e8e93] uppercase">
                Notas da Track Atual (clique para ouvir)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentPlanNotes.map((evt) => (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => {
                      if (evt.frequencies[0]) {
                        void audioEngine?.previewNote(evt.frequencies[0], evt.waveform, 0.3);
                      }
                      if (recordClicks && evt.notes[0]) {
                        setCapturedNotes((prev) => [...prev.slice(-31), evt.notes[0]]);
                      }
                    }}
                    className="cursor-pointer rounded border border-[#3d3f45] bg-[#1e1f23] px-2 py-0.5 font-mono-code text-[11px] text-[#d1d1d6] hover:border-[#64d2ff] hover:text-[#64d2ff]"
                  >
                    {evt.notes.join('+')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Captured Sequence & Insert Footer */}
        <div className="sythm-border flex flex-wrap items-center justify-between gap-3 border-t bg-[#1c1d21] px-5 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-xs font-semibold text-[#aeaeb2]">Sequência:</span>
            {capturedNotes.length === 0 ? (
              <span className="text-xs italic text-[#636366]">
                Toque as notas no teclado acima para montar sua frase...
              </span>
            ) : (
              <div className="flex min-w-0 flex-wrap gap-1">
                {capturedNotes.map((n, i) => (
                  <span
                    key={`${n}-${i}`}
                    className="rounded bg-[#0a84ff]/20 px-1.5 py-0.5 font-mono-code text-[11px] font-semibold text-[#70c4ff]"
                  >
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={capturedNotes.length === 0}
              onClick={handlePlayCapturedSequence}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-[#4a4d55] bg-[#2a2b30] px-2.5 py-1.5 text-xs font-medium text-[#6ee787] hover:bg-[#35373d] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Ouvir</span>
            </button>
            <button
              type="button"
              disabled={capturedNotes.length === 0}
              onClick={() => setCapturedNotes((prev) => prev.slice(0, -1))}
              title="Desfazer última nota"
              className="flex cursor-pointer items-center gap-1 rounded-md border border-[#4a4d55] bg-[#2a2b30] px-2 py-1.5 text-xs text-[#d1d1d6] hover:bg-[#35373d] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={capturedNotes.length === 0}
              onClick={() => setCapturedNotes([])}
              title="Limpar sequência"
              className="flex cursor-pointer items-center gap-1 rounded-md border border-[#4a4d55] bg-[#2a2b30] px-2 py-1.5 text-xs text-[#ff8a80] hover:bg-[#35373d] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={capturedNotes.length === 0}
              onClick={handleInsertIntoCode}
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[#0a84ff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0071e3] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Inserir no Código</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
