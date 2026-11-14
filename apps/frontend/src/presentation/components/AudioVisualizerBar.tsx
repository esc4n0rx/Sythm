import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExecutionPlan, ScheduledAudioEvent, VisualizerMode } from '@sythm/core';
import { Activity, Pause, Play } from 'lucide-react';
import type { WebAudioEngine } from '../../infrastructure/audio/WebAudioEngine';

export interface AudioVisualizerBarProps {
  readonly audioEngine: WebAudioEngine | null;
  readonly plan: ExecutionPlan | null;
  readonly isPlaying: boolean;
  readonly modeOverride: VisualizerMode | null;
  readonly onModeChange: (mode: VisualizerMode) => void;
}

const MODE_OPTIONS: { id: VisualizerMode; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'scope', label: 'SCOPE' },
  { id: 'spectrum', label: 'SPECTRUM' },
  { id: 'pianoroll', label: 'ROLL' },
  { id: 'off', label: 'OFF' },
];

const TRACK_COLORS = ['#0a84ff', '#30d158', '#ff9f0a', '#b281eb', '#64d2ff', '#ff6482'];

function freqToNormalizedY(freqHz: number): number {
  const safeFreq = Math.max(40, Math.min(2000, freqHz));
  const minLog = Math.log2(45);
  const maxLog = Math.log2(1600);
  const norm = (Math.log2(safeFreq) - minLog) / (maxLog - minLog);
  return 1 - Math.max(0.06, Math.min(0.94, norm));
}

function getTrackColor(trackIndex: number): string {
  return TRACK_COLORS[trackIndex % TRACK_COLORS.length];
}

export function AudioVisualizerBar({
  audioEngine,
  plan,
  isPlaying,
  modeOverride,
  onModeChange,
}: AudioVisualizerBarProps) {
  const activeMode: VisualizerMode = modeOverride ?? plan?.visualizerMode ?? 'all';
  const [userPaused, setUserPaused] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [liveBeat, setLiveBeat] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const scopeCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const rollCanvasRef = useRef<HTMLCanvasElement>(null);

  const trackIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    plan?.tracks.forEach((t, idx) => map.set(t.name, idx));
    return map;
  }, [plan]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (event: MediaQueryListEvent): void => setReducedMotion(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Pause rendering when browser skips off-screen subtrees (`content-visibility: auto`) or leaves viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleContentVisibility = (event: Event): void => {
      const skipped = (event as Event & { skipped?: boolean }).skipped;
      if (typeof skipped === 'boolean') {
        setIsContentVisible(!skipped);
      }
    };

    el.addEventListener('contentvisibilityautostatechange', handleContentVisibility);

    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) {
            setIsContentVisible(entry.isIntersecting);
          }
        },
        { threshold: 0.01 },
      );
      observer.observe(el);
    }

    return () => {
      el.removeEventListener('contentvisibilityautostatechange', handleContentVisibility);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (activeMode === 'off') return;

    const showScope = activeMode === 'all' || activeMode === 'scope';
    const showSpectrum = activeMode === 'all' || activeMode === 'spectrum';
    const showRoll = activeMode === 'all' || activeMode === 'pianoroll';

    const timeData = new Uint8Array(new ArrayBuffer(2048));
    const freqData = new Uint8Array(new ArrayBuffer(1024));

    const resizeCanvas = (canvas: HTMLCanvasElement | null): void => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.max(10, Math.floor(rect.width * dpr));
      const targetH = Math.max(10, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    const drawScope = (hasAudio: boolean): void => {
      const canvas = scopeCanvasRef.current;
      if (!canvas || !showScope) return;
      resizeCanvas(canvas);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Subtle center baseline
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      ctx.strokeStyle = hasAudio ? '#30d158' : 'rgba(100, 210, 255, 0.32)';
      ctx.lineWidth = 1.75;
      ctx.beginPath();

      if (hasAudio && !reducedMotion) {
        const len = timeData.length;
        const step = Math.max(1, Math.floor(len / Math.min(len, w)));
        let x = 0;
        const sliceW = w / (len / step);
        for (let i = 0; i < len; i += step) {
          const v = (timeData[i] - 128) / 128;
          const y = h / 2 + v * (h * 0.42);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceW;
        }
      } else {
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
      }
      ctx.stroke();
    };

    const drawSpectrum = (hasAudio: boolean): void => {
      const canvas = spectrumCanvasRef.current;
      if (!canvas || !showSpectrum) return;
      resizeCanvas(canvas);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barCount = 36;
      const gap = 2;
      const barWidth = Math.max(2, (w - gap * (barCount - 1)) / barCount);
      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, '#0a84ff');
      grad.addColorStop(0.6, '#64d2ff');
      grad.addColorStop(1, '#30d158');
      ctx.fillStyle = hasAudio ? grad : 'rgba(255,255,255,0.08)';

      for (let i = 0; i < barCount; i += 1) {
        const binIndex = Math.min(freqData.length - 1, Math.floor(Math.pow(i / barCount, 1.45) * 280));
        const amplitude = hasAudio ? freqData[binIndex] / 255 : 0.08;
        const barH = Math.max(2, amplitude * (h - 6));
        const x = i * (barWidth + gap);
        ctx.fillRect(x, h - barH - 2, barWidth, barH);
      }
    };

    const drawPianoRoll = (currentBeat: number, totalBeats: number): void => {
      const canvas = rollCanvasRef.current;
      if (!canvas || !showRoll) return;
      resizeCanvas(canvas);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const safeTotalBeats = Math.max(1, totalBeats || 4);

      // Vertical beat grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      const beatLines = Math.min(32, Math.ceil(safeTotalBeats));
      for (let b = 1; b < beatLines; b += 1) {
        const gx = (b / safeTotalBeats) * w;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }

      const events: ScheduledAudioEvent[] = plan?.events ?? [];
      for (const evt of events) {
        if (evt.type === 'rest') continue;
        const x = (evt.startBeat / safeTotalBeats) * w;
        const ew = Math.max(3, (evt.durationBeats / safeTotalBeats) * w - 1);
        const trackIdx = trackIndexMap.get(evt.trackName) ?? 0;
        const color = getTrackColor(trackIdx);
        const isCurrent = currentBeat >= evt.startBeat && currentBeat < evt.startBeat + evt.durationBeats;

        ctx.fillStyle = isCurrent ? '#ffffff' : color;
        ctx.globalAlpha = isCurrent ? 0.95 : 0.72;

        if (evt.type === 'drum') {
          const drumY = h - 9;
          ctx.fillRect(x, drumY, ew, 5);
        } else {
          for (const freq of evt.frequencies) {
            const y = freqToNormalizedY(freq) * (h - 14) + 3;
            ctx.fillRect(x, y, ew, 4);
          }
        }
      }
      ctx.globalAlpha = 1;

      if (isPlaying && safeTotalBeats > 0) {
        const playheadX = Math.max(0, Math.min(w - 1, (currentBeat / safeTotalBeats) * w));
        ctx.strokeStyle = '#64d2ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, h);
        ctx.stroke();
      }
    };

    const renderFrame = (): void => {
      const progress = audioEngine?.getProgress() ?? {
        currentBeat: 0,
        totalBeats: plan?.totalBeats ?? 0,
        elapsedSec: 0,
        totalDurationSec: plan?.totalDurationSec ?? 0,
        isPlaying: false,
      };
      const hasTime = Boolean(isPlaying && audioEngine?.getTimeDomainData(timeData));
      const hasFreq = Boolean(isPlaying && audioEngine?.getFrequencyData(freqData));
      drawScope(hasTime);
      drawSpectrum(hasFreq);
      drawPianoRoll(progress.currentBeat, plan?.totalBeats ?? progress.totalBeats);
      setLiveBeat(progress.currentBeat);
    };

    // Draw initial static snapshot immediately (also handles paused/stopped state cleanly)
    renderFrame();

    const shouldAnimate = isPlaying && !userPaused && isContentVisible;
    if (!shouldAnimate) {
      const ro =
        typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => renderFrame()) : undefined;
      if (ro) {
        if (scopeCanvasRef.current) ro.observe(scopeCanvasRef.current);
        if (spectrumCanvasRef.current) ro.observe(spectrumCanvasRef.current);
        if (rollCanvasRef.current) ro.observe(rollCanvasRef.current);
      }
      return () => ro?.disconnect();
    }

    let rafId = 0;
    let lastDrawMs = 0;
    const minIntervalMs = reducedMotion ? 180 : 0;

    const tick = (now: number): void => {
      if (now - lastDrawMs >= minIntervalMs) {
        lastDrawMs = now;
        renderFrame();
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [activeMode, audioEngine, isContentVisible, isPlaying, plan, reducedMotion, trackIndexMap, userPaused]);

  const showScope = activeMode === 'all' || activeMode === 'scope';
  const showSpectrum = activeMode === 'all' || activeMode === 'spectrum';
  const showRoll = activeMode === 'all' || activeMode === 'pianoroll';

  return (
    <div
      ref={containerRef}
      className="sythm-visualizer-panel border-b border-[var(--sythm-border)] bg-[#141416] shrink-0"
    >
      {/* Compact Header Strip */}
      <div className="h-7 px-3 flex items-center justify-between gap-2 border-b border-[var(--sythm-border-subtle)] bg-[#19191c]">
        <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--sythm-text-secondary)]">
          <Activity size={12} className={isPlaying ? 'text-[#30d158]' : 'text-[var(--sythm-text-muted)]'} />
          <span>Audio Visualizer</span>
          {plan?.scale && (
            <span className="px-1.5 py-0.5 rounded bg-[#2c2c30] text-[10px] font-mono text-[#64d2ff]">
              SCALE: {plan.scale}
            </span>
          )}
          {plan && (
            <span className="hidden sm:inline text-[10px] font-mono text-[var(--sythm-text-muted)] tabular-nums">
              BEAT {isPlaying ? liveBeat.toFixed(1) : '0.0'} / {plan.totalBeats.toFixed(1)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {activeMode !== 'off' && (
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              title={userPaused ? 'Retomar animação do visualizador' : 'Pausar animação do visualizador'}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition ${
                userPaused
                  ? 'bg-[#3d2e17] text-[#ff9f0a] border-[#ff9f0a]/40'
                  : 'bg-[#252529] text-[var(--sythm-text-secondary)] border-white/10 hover:text-white'
              }`}
            >
              {userPaused ? <Play size={10} /> : <Pause size={10} />}
              <span>{userPaused ? 'Paused' : 'Live'}</span>
            </button>
          )}

          <div className="flex items-center rounded bg-[#232327] p-0.5 border border-white/10">
            {MODE_OPTIONS.map((opt) => {
              const selected = activeMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onModeChange(opt.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                    selected
                      ? 'bg-[#0a84ff] text-white font-semibold'
                      : 'text-[var(--sythm-text-muted)] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Canvases */}
      {activeMode !== 'off' && (
        <div
          className={`h-[72px] px-2.5 py-1.5 grid gap-2 ${
            activeMode === 'all' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'
          }`}
        >
          {showScope && (
            <div className="relative rounded bg-[#101012] border border-white/[0.06] overflow-hidden">
              <span className="absolute top-1 left-1.5 text-[9px] font-mono uppercase tracking-wider text-[var(--sythm-text-muted)] pointer-events-none">
                Oscilloscope
              </span>
              <canvas ref={scopeCanvasRef} className="w-full h-full block" />
            </div>
          )}

          {showSpectrum && (
            <div className="relative rounded bg-[#101012] border border-white/[0.06] overflow-hidden">
              <span className="absolute top-1 left-1.5 text-[9px] font-mono uppercase tracking-wider text-[var(--sythm-text-muted)] pointer-events-none">
                FFT Spectrum
              </span>
              <canvas ref={spectrumCanvasRef} className="w-full h-full block" />
            </div>
          )}

          {showRoll && (
            <div className="relative rounded bg-[#101012] border border-white/[0.06] overflow-hidden">
              <span className="absolute top-1 left-1.5 text-[9px] font-mono uppercase tracking-wider text-[var(--sythm-text-muted)] pointer-events-none">
                Piano Roll &amp; Beat Grid
              </span>
              <canvas ref={rollCanvasRef} className="w-full h-full block" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
