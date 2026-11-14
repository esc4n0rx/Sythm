import type { DrumType } from '@sythm/core';

export type AudioIntegrationMode = 'sample' | 'transcribe' | 'hybrid';

export interface TranscribedSlice {
  beatIndex: number;
  drum: DrumType | null;
  bassNote: string | null;
  melodyNote: string | null;
}

export interface AudioAnalysisResult {
  detectedBpm: number;
  detectedScale: string;
  durationSec: number;
  analyzedBeats: number;
  estimatedTotalBeats: number;
  drumHitsCount: number;
  bassNotesCount: number;
  melodyNotesCount: number;
  slices: TranscribedSlice[];
}

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const SCALE_PROFILES: Array<{ mode: 'MAJOR' | 'MINOR' | 'PHRYGIAN'; intervals: readonly number[] }> = [
  { mode: 'MINOR', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { mode: 'MAJOR', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { mode: 'PHRYGIAN', intervals: [0, 1, 3, 5, 7, 8, 10] },
];

function mixAudioBufferToMono(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const channels = buffer.numberOfChannels;
  if (channels === 1) {
    return buffer.getChannelData(0);
  }
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channels; ch += 1) {
    const chData = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      mono[i] += chData[i];
    }
  }
  const inv = 1 / channels;
  for (let i = 0; i < length; i += 1) {
    mono[i] *= inv;
  }
  return mono;
}

function detectBpmFromMono(mono: Float32Array, sampleRate: number): number {
  const hopSamples = Math.max(1, Math.floor(sampleRate * 0.01)); // 10ms frames -> 100 Hz
  const numFrames = Math.floor(mono.length / hopSamples);
  if (numFrames < 80) {
    return 120;
  }

  const envelope = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f += 1) {
    const start = f * hopSamples;
    let sumSq = 0;
    for (let i = 0; i < hopSamples; i += 1) {
      const s = mono[start + i];
      sumSq += s * s;
    }
    envelope[f] = Math.sqrt(sumSq / hopSamples);
  }

  const onset = new Float32Array(numFrames);
  for (let f = 1; f < numFrames; f += 1) {
    onset[f] = Math.max(0, envelope[f] - envelope[f - 1]);
  }

  const maxFramesToScan = Math.min(numFrames, 2400); // scan up to first 24 seconds
  let bestBpm = 124;
  let bestScore = -1;

  for (let bpm = 82; bpm <= 174; bpm += 1) {
    const lag = Math.round((60 / bpm) * 100);
    if (lag <= 0 || lag * 2 >= maxFramesToScan) continue;

    let corr1 = 0;
    let corr2 = 0;
    const limit1 = maxFramesToScan - lag;
    for (let f = 0; f < limit1; f += 1) {
      corr1 += onset[f] * onset[f + lag];
    }
    const limit2 = maxFramesToScan - lag * 2;
    for (let f = 0; f < limit2; f += 1) {
      corr2 += onset[f] * onset[f + lag * 2];
    }

    const normalizedScore = corr1 / Math.max(1, limit1) + 0.45 * (corr2 / Math.max(1, limit2));
    // Slight perceptual prior centered near 120-132 BPM to prevent octave halving/doubling bias
    const prior = 1 - Math.abs(bpm - 126) * 0.0012;
    const finalScore = normalizedScore * prior;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestBpm = bpm;
    }
  }

  return bestBpm;
}

function estimateFundamentalHz(
  samples: Float32Array,
  sampleRate: number,
  minHz: number,
  maxHz: number,
): { hz: number; clarity: number } | null {
  const n = samples.length;
  if (n < 64) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(Math.floor(n / 2), Math.ceil(sampleRate / minHz));
  if (maxLag <= minLag) return null;

  let energy0 = 0;
  for (let i = 0; i < n; i += 1) {
    energy0 += samples[i] * samples[i];
  }
  const rms = Math.sqrt(energy0 / n);
  if (rms < 0.012) return null;

  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let cross = 0;
    let normA = 0;
    let normB = 0;
    const len = n - lag;
    for (let i = 0; i < len; i += 2) {
      const a = samples[i];
      const b = samples[i + lag];
      cross += a * b;
      normA += a * a;
      normB += b * b;
    }
    const denom = Math.sqrt(normA * normB);
    const corr = denom > 1e-8 ? cross / denom : 0;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestCorr < 0.44) {
    return null;
  }

  return { hz: sampleRate / bestLag, clarity: bestCorr };
}

function hzToSythmNote(hz: number): { note: string; pitchClass: number; midi: number } {
  const midiFloat = 69 + 12 * Math.log2(Math.max(20, hz) / 440);
  const midi = Math.max(24, Math.min(96, Math.round(midiFloat)));
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return {
    note: `${NOTE_NAMES_SHARP[pitchClass]}${octave}`,
    pitchClass,
    midi,
  };
}

function detectScaleFromHistogram(histogram: readonly number[]): string {
  let total = 0;
  for (const v of histogram) total += v;
  if (total === 0) return 'C MINOR';

  let bestLabel = 'A MINOR';
  let bestScore = -1;

  for (let root = 0; root < 12; root += 1) {
    for (const profile of SCALE_PROFILES) {
      const inScale = new Set(profile.intervals.map((i) => (root + i) % 12));
      let score = 0;
      for (let pc = 0; pc < 12; pc += 1) {
        score += inScale.has(pc) ? histogram[pc] : -histogram[pc] * 0.65;
      }
      // Bonus for root pitch prevalence
      score += histogram[root] * 0.4;
      if (score > bestScore) {
        bestScore = score;
        bestLabel = `${NOTE_NAMES_SHARP[root]} ${profile.mode}`;
      }
    }
  }

  return bestLabel;
}

export function analyzeAudioBufferForSythm(
  buffer: AudioBuffer,
  maxBeats = 16,
): AudioAnalysisResult {
  const mono = mixAudioBufferToMono(buffer);
  const sampleRate = buffer.sampleRate;
  const detectedBpm = detectBpmFromMono(mono, sampleRate);
  const beatDurationSec = 60 / detectedBpm;
  const stepBeats = 0.5;
  const stepSamples = Math.max(128, Math.floor(beatDurationSec * stepBeats * sampleRate));

  const rawTotalBeats = buffer.duration / beatDurationSec;
  const estimatedTotalBeats = Math.max(4, Math.round(rawTotalBeats * 2) / 2);
  const numSteps = Math.max(2, Math.min(Math.round(maxBeats / stepBeats), Math.floor(mono.length / stepSamples)));

  // 1-pole filters state for band decomposition
  const lpAlpha = 1 - Math.exp((-2 * Math.PI * 145) / sampleRate);
  const hpAlpha = Math.exp((-2 * Math.PI * 4200) / sampleRate);
  const bandBassAlpha = 1 - Math.exp((-2 * Math.PI * 170) / sampleRate);

  interface RawSliceFeatures {
    beatIndex: number;
    subPeak: number;
    midPeak: number;
    highRms: number;
    bassNote: string | null;
    melodyNote: string | null;
    bassPc: number | null;
    melodyPc: number | null;
  }

  const rawSlices: RawSliceFeatures[] = [];
  const pcHistogram = new Array<number>(12).fill(0);

  let lpState = 0;
  let hpState = 0;
  let prevSample = 0;
  let bandBassState = 0;

  for (let s = 0; s < numSteps; s += 1) {
    const start = s * stepSamples;
    const end = Math.min(mono.length, start + stepSamples);
    const len = end - start;
    if (len < 128) break;

    const bassBuf = new Float32Array(Math.min(len, 4096));
    const midHighBuf = new Float32Array(Math.min(len, 4096));

    let subPeak = 0;
    let midPeak = 0;
    let highSqSum = 0;
    const attackEnd = Math.min(end, start + Math.floor(sampleRate * 0.045));

    for (let i = start; i < end; i += 1) {
      const x = mono[i];
      lpState += lpAlpha * (x - lpState);
      hpState = hpAlpha * (hpState + x - prevSample);
      prevSample = x;
      bandBassState += bandBassAlpha * (x - bandBassState);

      const midSignal = x - lpState - hpState;
      const localIdx = i - start;
      if (localIdx < bassBuf.length) {
        bassBuf[localIdx] = bandBassState;
        midHighBuf[localIdx] = midSignal;
      }

      if (i < attackEnd) {
        const subAbs = Math.abs(lpState);
        const midAbs = Math.abs(midSignal);
        if (subAbs > subPeak) subPeak = subAbs;
        if (midAbs > midPeak) midPeak = midAbs;
      }
      highSqSum += hpState * hpState;
    }

    const highRms = Math.sqrt(highSqSum / len);

    const bassWindowStart = Math.min(bassBuf.length - 1, Math.floor(bassBuf.length * 0.15));
    const bassPitch = estimateFundamentalHz(
      bassBuf.subarray(bassWindowStart),
      sampleRate,
      42,
      165,
    );
    const melodyPitch = estimateFundamentalHz(
      midHighBuf.subarray(bassWindowStart),
      sampleRate,
      175,
      1100,
    );

    const bassParsed = bassPitch ? hzToSythmNote(bassPitch.hz) : null;
    const melodyParsed = melodyPitch ? hzToSythmNote(melodyPitch.hz) : null;

    if (bassParsed) pcHistogram[bassParsed.pitchClass] += 1.2;
    if (melodyParsed) pcHistogram[melodyParsed.pitchClass] += 1;

    rawSlices.push({
      beatIndex: s * stepBeats,
      subPeak,
      midPeak,
      highRms,
      bassNote: bassParsed?.note ?? null,
      melodyNote: melodyParsed?.note ?? null,
      bassPc: bassParsed?.pitchClass ?? null,
      melodyPc: melodyParsed?.pitchClass ?? null,
    });
  }

  const avgSub = rawSlices.reduce((acc, r) => acc + r.subPeak, 0) / Math.max(1, rawSlices.length);
  const avgMid = rawSlices.reduce((acc, r) => acc + r.midPeak, 0) / Math.max(1, rawSlices.length);
  const avgHigh = rawSlices.reduce((acc, r) => acc + r.highRms, 0) / Math.max(1, rawSlices.length);

  let drumHitsCount = 0;
  let bassNotesCount = 0;
  let melodyNotesCount = 0;

  const slices: TranscribedSlice[] = rawSlices.map((r, idx) => {
    let drum: DrumType | null = null;
    if (r.subPeak > Math.max(0.08, avgSub * 1.18)) {
      drum = 'kick';
    } else if (r.midPeak > Math.max(0.07, avgMid * 1.32)) {
      drum = idx % 2 === 1 ? 'snare' : 'clap';
    } else if (r.highRms > Math.max(0.015, avgHigh * 1.1)) {
      drum = idx % 4 === 3 ? 'open-hihat' : 'hihat';
    }

    if (drum) drumHitsCount += 1;
    if (r.bassNote) bassNotesCount += 1;
    if (r.melodyNote) melodyNotesCount += 1;

    return {
      beatIndex: r.beatIndex,
      drum,
      bassNote: r.bassNote,
      melodyNote: r.melodyNote,
    };
  });

  return {
    detectedBpm,
    detectedScale: detectScaleFromHistogram(pcHistogram),
    durationSec: buffer.duration,
    analyzedBeats: slices.length * stepBeats,
    estimatedTotalBeats,
    drumHitsCount,
    bassNotesCount,
    melodyNotesCount,
    slices,
  };
}

function formatDrumAndRestLines(slices: readonly TranscribedSlice[]): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < slices.length) {
    if (slices[i].drum) {
      const group: string[] = [];
      while (i < slices.length && slices[i].drum && group.length < 8) {
        group.push(slices[i].drum!.toUpperCase());
        i += 1;
      }
      lines.push(`    PLAY DRUMS ${group.join(' ')} FOR 0.5 BEATS.`);
    } else {
      let restBeats = 0;
      while (i < slices.length && !slices[i].drum) {
        restBeats += 0.5;
        i += 1;
      }
      lines.push(`    REST FOR ${restBeats} BEATS.`);
    }
  }
  return lines;
}

function formatNoteAndRestLines(notes: ReadonlyArray<string | null>): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < notes.length) {
    if (notes[i]) {
      const group: string[] = [];
      while (i < notes.length && notes[i] && group.length < 8) {
        group.push(notes[i]!);
        i += 1;
      }
      lines.push(`    PLAY NOTES ${group.join(' ')} FOR 0.5 BEATS.`);
    } else {
      let restBeats = 0;
      while (i < notes.length && !notes[i]) {
        restBeats += 0.5;
        i += 1;
      }
      lines.push(`    REST FOR ${restBeats} BEATS.`);
    }
  }
  return lines;
}

function buildSafeProgramId(filename: string): string {
  const cleaned = filename
    .replace(/\.[^.]+$/, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 28) || 'AUDIO-IMPORTADO';
}

export function generateSythmFromAudio(
  rawSampleName: string,
  analysis: AudioAnalysisResult,
  mode: AudioIntegrationMode,
): string {
  const sampleName = rawSampleName.replace(/"/g, '');
  const safeId = buildSafeProgramId(sampleName);
  const sampleBeats = Math.max(4, Math.round(analysis.estimatedTotalBeats));

  if (mode === 'sample') {
    return `*> Mixagem com Audio Base Externo (${sampleName})
HEADER DIVISION.
  PROGRAM-ID. ${safeId}-MIX.
  TITLE IS "Mix: ${sampleName}".
  AUTHOR IS "Sythm Sampler".

CONFIG DIVISION.
  TEMPO IS ${analysis.detectedBpm} BPM.
  SCALE IS ${analysis.detectedScale}.
  VISUALIZER IS ALL.
  CONTROL VOL-AUDIO IS SLIDER 85 FROM 0 TO 100.
  CONTROL FILTRO-AUDIO IS SLIDER 4200 FROM 150 TO 8000.
  CONTROL REV-AUDIO IS SLIDER 15 FROM 0 TO 100.
  CONTROL VOL-BEAT IS SLIDER 70 FROM 0 TO 100.

PLAY DIVISION.
  TRACK AUDIO-BASE.
    VOLUME IS VOL-AUDIO.
    FILTER IS LOWPASS FILTRO-AUDIO HZ Q 1.8.
    REVERB IS REV-AUDIO PERCENT.
    PRINT "Tocando sample externo: ${sampleName} (${analysis.detectedBpm} BPM)".
    PLAY SAMPLE "${sampleName}" RATE 1.0 OFFSET 0 SEC FOR ${sampleBeats} BEATS.
  END-TRACK.

  TRACK BATERIA-SYNTH.
    VOLUME IS VOL-BEAT.
    REPEAT 4 TIMES
      PLAY EUCLIDEAN KICK 4 IN 16 FOR 0.25 BEATS.
    END-REPEAT.
  END-TRACK.
`;
  }

  const drumLines =
    analysis.drumHitsCount > 0
      ? formatDrumAndRestLines(analysis.slices)
      : ['    PLAY DRUMS KICK HIHAT SNARE HIHAT FOR 0.5 BEATS.'];

  const bassLines =
    analysis.bassNotesCount > 0
      ? formatNoteAndRestLines(analysis.slices.map((s) => s.bassNote))
      : ['    PLAY NOTES A1 A1 C2 G1 FOR 0.5 BEATS.'];

  const melodyLines =
    analysis.melodyNotesCount > 0
      ? formatNoteAndRestLines(analysis.slices.map((s) => s.melodyNote))
      : ['    PLAY NOTES A4 C5 E5 G4 FOR 0.5 BEATS.'];

  const transcribedTracks = [
    `  TRACK BATERIA-EXTRAIDA.`,
    `    VOLUME IS 80.`,
    ...drumLines,
    `  END-TRACK.`,
    ``,
    `  TRACK BAIXO-EXTRAIDO.`,
    `    WAVE IS SUB-808.`,
    `    VOLUME IS 76.`,
    `    FILTER IS LOWPASS 680 HZ Q 2.2.`,
    ...bassLines,
    `  END-TRACK.`,
    ``,
    `  TRACK MELODIA-EXTRAIDA.`,
    `    WAVE IS FM-KEYS.`,
    `    VOLUME IS 68.`,
    `    REVERB IS 28 PERCENT.`,
    ...melodyLines,
    `  END-TRACK.`,
  ].join('\n');

  if (mode === 'transcribe') {
    return `*> Transcricao DSP de Audio para Codigo Sythm (${sampleName})
*> BPM detectado: ${analysis.detectedBpm} | Escala estimada: ${analysis.detectedScale}
HEADER DIVISION.
  PROGRAM-ID. ${safeId}-SYTHM.
  TITLE IS "Transcrito: ${sampleName}".
  AUTHOR IS "Sythm Audio Transcriber".

CONFIG DIVISION.
  TEMPO IS ${analysis.detectedBpm} BPM.
  SCALE IS ${analysis.detectedScale}.
  VISUALIZER IS ALL.

PLAY DIVISION.
${transcribedTracks}
`;
  }

  return `*> Modo Hibrido (Audio Original + Tracks Transcritas em Codigo)
*> BPM detectado: ${analysis.detectedBpm} | Escala estimada: ${analysis.detectedScale}
HEADER DIVISION.
  PROGRAM-ID. ${safeId}-HIBRIDO.
  TITLE IS "Remix Hibrido: ${sampleName}".
  AUTHOR IS "Sythm Hybrid Studio".

CONFIG DIVISION.
  TEMPO IS ${analysis.detectedBpm} BPM.
  SCALE IS ${analysis.detectedScale}.
  VISUALIZER IS ALL.
  CONTROL VOL-ORIGINAL IS SLIDER 78 FROM 0 TO 100.
  CONTROL CORTE-ORIGINAL IS SLIDER 3600 FROM 180 TO 8000.

PLAY DIVISION.
  TRACK AUDIO-ORIGINAL.
    VOLUME IS VOL-ORIGINAL.
    FILTER IS LOWPASS CORTE-ORIGINAL HZ Q 1.5.
    PLAY SAMPLE "${sampleName}" RATE 1.0 FOR ${Math.min(sampleBeats, Math.max(4, analysis.analyzedBeats))} BEATS.
  END-TRACK.

${transcribedTracks}
`;
}
