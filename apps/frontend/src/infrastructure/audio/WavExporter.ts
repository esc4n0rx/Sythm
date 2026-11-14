import type { ExecutionPlan } from '@sythm/core';
import {
  createEventChain,
  createImpulseBuffer,
  scheduleSynthesizedDrum,
  scheduleSynthesizedOscillators,
} from './SythmSynthGraph';

const SAMPLE_RATE = 44100;
const TAIL_SECONDS = 1.3;

function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = buffer.sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const left = buffer.getChannelData(0);
  const right = numChannels > 1 ? buffer.getChannelData(1) : left;

  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      const sample = ch === 0 ? left[i] : right[i];
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

export async function exportExecutionPlanToWav(
  plan: ExecutionPlan,
  controlValues?: ReadonlyMap<string, number>,
  sampleBuffers?: ReadonlyMap<string, AudioBuffer>,
): Promise<Blob> {
  const durationSec = Math.max(0.5, plan.totalDurationSec + TAIL_SECONDS);
  const totalFrames = Math.ceil(durationSec * SAMPLE_RATE);
  const offline = new OfflineAudioContext(2, totalFrames, SAMPLE_RATE);

  const masterGain = offline.createGain();
  masterGain.gain.setValueAtTime(0.92, 0);

  const limiter = offline.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-6, 0);
  limiter.ratio.setValueAtTime(4, 0);

  masterGain.connect(limiter);
  limiter.connect(offline.destination);

  const impulseBuffer = createImpulseBuffer(offline);
  const noiseBufferCache = new WeakMap<BaseAudioContext, AudioBuffer>();
  const trackGains = new Map<string, GainNode>();

  const getTrackInput = (trackName: string): GainNode => {
    const existing = trackGains.get(trackName);
    if (existing) return existing;
    const node = offline.createGain();
    node.gain.setValueAtTime(1, 0);
    node.connect(masterGain);
    trackGains.set(trackName, node);
    return node;
  };

  for (const event of plan.events) {
    if (event.type === 'rest') continue;

    const startAt = Math.max(0.01, event.startTimeSec + 0.02);
    const stopAt = startAt + event.durationSec + event.effects.envelope.releaseSec + 0.04;
    const trackGain = getTrackInput(event.trackName);

    const { dryTarget, liveNode } = createEventChain(
      offline,
      event,
      trackGain,
      impulseBuffer,
      startAt,
      stopAt,
      controlValues,
    );

    const noopTrack = (): void => undefined;

    if (event.type === 'drum' && event.drum) {
      scheduleSynthesizedDrum(offline, event.drum, dryTarget, startAt, noiseBufferCache, noopTrack);
    } else if (event.type === 'sample' && event.sampleName && sampleBuffers) {
      const lower = event.sampleName.trim().toLowerCase();
      const buffer =
        sampleBuffers.get(event.sampleName) ??
        sampleBuffers.get(lower) ??
        sampleBuffers.get(lower.replace(/\.[^.]+$/, ''));
      if (buffer) {
        const rate = event.sampleRate ?? 1;
        const offset = Math.max(0, Math.min(Math.max(0, buffer.duration - 0.05), event.sampleOffsetSec ?? 0));
        const playDur = Math.min(
          event.durationSec,
          Math.max(0.05, (buffer.duration - offset) / Math.max(0.1, rate)),
        );
        const src = offline.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.setValueAtTime(rate, startAt);
        src.connect(dryTarget);
        src.start(startAt, offset, playDur);
      }
    } else {
      let detuneCents = event.effects.detuneCents;
      if (event.controlRefs?.detuneCents && controlValues?.has(event.controlRefs.detuneCents)) {
        detuneCents = controlValues.get(event.controlRefs.detuneCents)!;
      }
      scheduleSynthesizedOscillators(
        offline,
        event,
        dryTarget,
        startAt,
        stopAt,
        detuneCents,
        liveNode.oscillators,
        noopTrack,
      );
    }
  }

  const rendered = await offline.startRendering();
  return encodeAudioBufferToWav(rendered);
}

export function triggerWavDownload(blob: Blob, filename: string): void {
  const safeBase = filename.replace(/\.sythm$/i, '').replace(/[^a-z0-9._-]+/gi, '-');
  const downloadName = `${safeBase || 'sythm-export'}.wav`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = downloadName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
