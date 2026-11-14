import { Circle, Drum, SlidersHorizontal, Square, Waves } from 'lucide-react';
import type { ControlDescriptor, TrackSummary } from '@sythm/core';
import { ControlSlider } from './ControlSlider';

interface TrackMixerBarProps {
  tracks: TrackSummary[];
  controls: ControlDescriptor[];
  controlValues: Readonly<Record<string, number>>;
  activeTracks: ReadonlySet<string>;
  mutedTracks: ReadonlySet<string>;
  soloedTracks: ReadonlySet<string>;
  isRecordingAutomation?: boolean;
  recordedKeyframesCount?: number;
  onToggleRecordAutomation?: () => void;
  onToggleMute: (trackName: string) => void;
  onToggleSolo: (trackName: string) => void;
  onControlChange: (control: ControlDescriptor, newValue: number) => void;
}

export function TrackMixerBar({
  tracks,
  controls,
  controlValues,
  activeTracks,
  mutedTracks,
  soloedTracks,
  isRecordingAutomation = false,
  recordedKeyframesCount = 0,
  onToggleRecordAutomation,
  onToggleMute,
  onToggleSolo,
  onControlChange,
}: TrackMixerBarProps) {
  if (tracks.length === 0 && controls.length === 0) {
    return null;
  }

  const hasSolo = soloedTracks.size > 0;
  const trackNames = new Set(tracks.map((t) => t.name));

  const globalControls = controls.filter(
    (ctrl) =>
      ctrl.bindings.length === 0 ||
      ctrl.bindings.some((b) => !trackNames.has(b.trackName)),
  );

  return (
    <section
      aria-label="Track Mixer e Controls"
      className="xcode-panel-border sythm-border sythm-bg-sidebar xcode-scroll flex shrink-0 items-center gap-2 overflow-x-auto border-b px-3 py-2"
    >
      <span className="shrink-0 text-[11px] font-semibold tracking-wider text-[#aeaeb2] uppercase">
        Tracks ({tracks.length})
      </span>

      {controls.length > 0 && onToggleRecordAutomation && (
        <button
          type="button"
          onClick={onToggleRecordAutomation}
          title={
            isRecordingAutomation
              ? 'Parar gravação e injetar automação (RAMP) no código'
              : 'Gravar movimentos dos sliders em tempo real e gerar RAMP no código'
          }
          className={`flex shrink-0 cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold transition ${
            isRecordingAutomation
              ? 'border-[#ff453a] bg-[#ff453a]/25 text-[#ff8a80] animate-pulse'
              : 'border-[#4a4d55] bg-[#2a2b30] text-[#d1d1d6] hover:border-[#ff453a]/60 hover:text-white'
          }`}
        >
          {isRecordingAutomation ? (
            <>
              <Square className="h-2.5 w-2.5 fill-current" />
              <span>REC ({recordedKeyframesCount})</span>
            </>
          ) : (
            <>
              <Circle className="h-2.5 w-2.5 fill-[#ff453a] text-[#ff453a]" />
              <span>REC Automação</span>
            </>
          )}
        </button>
      )}

      <div className="flex items-center gap-2">
        {tracks.map((track) => {
          const isMuted = mutedTracks.has(track.name);
          const isSoloed = soloedTracks.has(track.name);
          const effectivelyMuted = isMuted || (hasSolo && !isSoloed);
          const isSounding = activeTracks.has(track.name) && !effectivelyMuted;
          const trackControls = controls.filter((ctrl) =>
            ctrl.bindings.some((b) => b.trackName === track.name),
          );

          return (
            <div
              key={track.name}
              className={`flex shrink-0 items-center gap-2.5 rounded-md border px-2.5 py-1 text-xs transition ${
                isSounding
                  ? 'border-[#0a84ff] bg-[#0a84ff]/15 text-[#ffffff]'
                  : effectivelyMuted
                    ? 'border-[#3d3f45] bg-[#1a1b1e] text-[#8e8e93]'
                    : 'border-[#3d3f45] bg-[#2a2b30] text-[#f2f2f7]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {track.hasDrums ? (
                  <Drum
                    className={`h-3.5 w-3.5 ${
                      isSounding ? 'text-[#ff9f0a]' : 'text-[#aeaeb2]'
                    }`}
                    aria-hidden="true"
                  />
                ) : (
                  <Waves
                    className={`h-3.5 w-3.5 ${
                      isSounding ? 'text-[#64d2ff]' : 'text-[#aeaeb2]'
                    }`}
                    aria-hidden="true"
                  />
                )}
                <span className="font-mono-code text-xs font-semibold">{track.name}</span>
                <span className="text-[10px] text-[#aeaeb2]">{track.totalBeats}b</span>
                {track.effects.filter.mode !== 'off' && (
                  <span className="rounded bg-[#b281eb]/20 px-1 font-mono-code text-[9px] text-[#d0a8ff]">
                    {track.effects.filter.mode === 'lowpass'
                      ? 'LP'
                      : track.effects.filter.mode === 'highpass'
                        ? 'HP'
                        : 'BP'}
                  </span>
                )}
                {track.effects.delay.mix > 0 && (
                  <span className="rounded bg-[#0a84ff]/20 px-1 font-mono-code text-[9px] text-[#70c4ff]">
                    DLY
                  </span>
                )}
                {track.effects.reverbMix > 0 && (
                  <span className="rounded bg-[#30d158]/20 px-1 font-mono-code text-[9px] text-[#6ee787]">
                    REV
                  </span>
                )}
                {track.effects.detuneCents > 0 && (
                  <span className="rounded bg-[#ffd60a]/20 px-1 font-mono-code text-[9px] text-[#ffd60a]">
                    DET
                  </span>
                )}
                {Math.abs(track.effects.pan ?? 0) > 0.01 && (
                  <span className="rounded bg-[#ff6482]/20 px-1 font-mono-code text-[9px] text-[#ff6482]">
                    {track.effects.pan < 0
                      ? `L${Math.round(Math.abs(track.effects.pan) * 100)}`
                      : `R${Math.round(track.effects.pan * 100)}`}
                  </span>
                )}
                {track.effects.lfo && (
                  <span className="rounded bg-[#64d2ff]/20 px-1 font-mono-code text-[9px] text-[#64d2ff]">
                    LFO
                  </span>
                )}
                {track.effects.sweep && (
                  <span className="rounded bg-[#ff9f0a]/20 px-1 font-mono-code text-[9px] text-[#ff9f0a]">
                    SWEEP
                  </span>
                )}
              </div>

              {trackControls.length > 0 && (
                <div className="flex items-center gap-1.5 border-l border-[#3d3f45] pl-2">
                  {trackControls.map((ctrl) => (
                    <ControlSlider
                      key={`${track.name}-${ctrl.name}`}
                      control={ctrl}
                      value={controlValues[ctrl.name] ?? ctrl.defaultValue}
                      compact
                      onChange={onControlChange}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggleMute(track.name)}
                  aria-pressed={isMuted}
                  aria-label={`Silenciar track ${track.name}`}
                  title={`Mute ${track.name}`}
                  className={`h-5 min-w-5 cursor-pointer rounded border px-1.5 font-mono-code text-[10px] font-bold transition focus-visible:outline-2 focus-visible:outline-[#0a84ff] ${
                    isMuted
                      ? 'border-[#ff6961] bg-[#ff453a]/25 text-[#ff8a80]'
                      : 'border-[#4a4d55] bg-[#32343a] text-[#d1d1d6] hover:bg-[#3e4048]'
                  }`}
                >
                  M
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSolo(track.name)}
                  aria-pressed={isSoloed}
                  aria-label={`Isolar track ${track.name}`}
                  title={`Solo ${track.name}`}
                  className={`h-5 min-w-5 cursor-pointer rounded border px-1.5 font-mono-code text-[10px] font-bold transition focus-visible:outline-2 focus-visible:outline-[#0a84ff] ${
                    isSoloed
                      ? 'border-[#ffd60a] bg-[#ffd60a]/25 text-[#ffd60a]'
                      : 'border-[#4a4d55] bg-[#32343a] text-[#d1d1d6] hover:bg-[#3e4048]'
                  }`}
                >
                  S
                </button>
              </div>
            </div>
          );
        })}

        {globalControls.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 rounded-md border border-[#3d3f45] bg-[#2a2b30] px-2.5 py-1 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#70c4ff]" aria-hidden="true" />
            <span className="font-mono-code text-[11px] font-semibold text-[#aeaeb2]">
              GLOBAL
            </span>
            <div className="flex items-center gap-1.5">
              {globalControls.map((ctrl) => (
                <ControlSlider
                  key={`global-${ctrl.name}`}
                  control={ctrl}
                  value={controlValues[ctrl.name] ?? ctrl.defaultValue}
                  compact
                  onChange={onControlChange}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
