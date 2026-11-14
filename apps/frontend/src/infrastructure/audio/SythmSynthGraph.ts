import type { DrumType, ScheduledAudioEvent } from '@sythm/core';

export interface LiveControlNodes {
  readonly event: ScheduledAudioEvent;
  readonly eventGain: GainNode;
  readonly trackVolumeScale: number;
  readonly filter?: BiquadFilterNode;
  readonly panner?: StereoPannerNode;
  readonly delayNode?: DelayNode;
  readonly delayWetGain?: GainNode;
  readonly delayFeedbackGain?: GainNode;
  readonly reverbWetGain?: GainNode;
  readonly oscillators: OscillatorNode[];
  readonly stopAt: number;
}

export interface SynthRoutingDestination {
  readonly inputGain: GainNode;
}

export interface EventChainSetup {
  readonly dryTarget: AudioNode;
  readonly liveNode: LiveControlNodes;
  readonly extraSources: AudioScheduledSourceNode[];
}

export function createImpulseBuffer(
  ctx: BaseAudioContext,
  seconds = 1.6,
  decay = 2.4,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const progress = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - progress, decay);
    }
  }

  return impulse;
}

function getOrCreateNoiseBuffer(
  ctx: BaseAudioContext,
  noiseBufferCache: WeakMap<BaseAudioContext, AudioBuffer>,
): AudioBuffer {
  const cached = noiseBufferCache.get(ctx);
  if (cached) return cached;

  const length = Math.floor(ctx.sampleRate * 1.4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBufferCache.set(ctx, buffer);
  return buffer;
}

export function createEventChain(
  ctx: BaseAudioContext,
  event: ScheduledAudioEvent,
  destination: AudioNode,
  impulseBuffer: AudioBuffer,
  startAt: number,
  stopAt: number,
  liveOverrides?: ReadonlyMap<string, number>,
): EventChainSetup {
  const effects = event.effects;
  const envelope = effects.envelope;
  const refs = event.controlRefs;

  const resolveControl = (
    param: keyof NonNullable<typeof refs>,
    fallback: number,
    isPercent = false,
  ): number => {
    if (!refs || !liveOverrides) return fallback;
    const ctrlName = refs[param];
    if (!ctrlName) return fallback;
    const val = liveOverrides.get(ctrlName);
    if (val === undefined) return fallback;
    return isPercent ? (val > 1 ? val / 100 : val) : val;
  };

  const resolvePanControl = (fallback: number): number => {
    if (!refs || !liveOverrides || !refs.pan) return fallback;
    const val = liveOverrides.get(refs.pan);
    if (val === undefined) return fallback;
    const scaled = Math.abs(val) > 1 ? val / 100 : val;
    return Math.max(-1, Math.min(1, scaled));
  };

  const trackVolumeScale = event.volume > 0 ? 1 : 0;
  let effectiveVol = event.volume;
  if (refs?.volume && liveOverrides?.has(refs.volume)) {
    const raw = liveOverrides.get(refs.volume)!;
    const norm = raw > 1 ? raw / 100 : raw;
    effectiveVol = Math.min(1, Math.max(0, norm * 0.4));
  }

  const eventGain = ctx.createGain();
  if (event.type === 'drum') {
    const peakGain = Math.max(0.05, effectiveVol * 1.8);
    eventGain.gain.setValueAtTime(peakGain, startAt);
  } else {
    const voiceScale =
      event.type === 'chord' ? 1 / Math.max(1, Math.sqrt(event.frequencies.length)) : 1;
    const peakGain = Math.max(0.015, effectiveVol * voiceScale);
    const sustainGain = Math.max(0.005, peakGain * envelope.sustainLevel);

    const safeAttack = Math.min(envelope.attackSec, event.durationSec * 0.45);
    const safeDecay = Math.min(envelope.decaySec, event.durationSec * 0.4);
    const attackEnd = startAt + safeAttack;
    const decayEnd = Math.min(startAt + event.durationSec, attackEnd + safeDecay);
    const releaseStart = Math.max(decayEnd, startAt + event.durationSec - 0.015);
    const releaseEnd = releaseStart + Math.max(0.02, envelope.releaseSec);

    eventGain.gain.setValueAtTime(0.0001, startAt);
    eventGain.gain.linearRampToValueAtTime(peakGain, attackEnd);
    eventGain.gain.linearRampToValueAtTime(sustainGain, decayEnd);
    eventGain.gain.setValueAtTime(sustainGain, releaseStart);
    eventGain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
  }

  const hasFilter =
    effects.filter.mode !== 'off' ||
    Boolean(effects.lfo) ||
    Boolean(effects.sweep) ||
    Boolean(refs?.filterFrequencyHz || refs?.filterQ);

  let filter: BiquadFilterNode | undefined;
  let signalOut: AudioNode = eventGain;

  const extraSources: AudioScheduledSourceNode[] = [];

  if (hasFilter) {
    filter = ctx.createBiquadFilter();
    filter.type = effects.filter.mode === 'off' ? 'lowpass' : effects.filter.mode;
    const initFreq = resolveControl('filterFrequencyHz', effects.filter.frequencyHz);
    const initQ = resolveControl('filterQ', effects.filter.q);
    filter.frequency.setValueAtTime(Math.max(20, Math.min(20000, initFreq)), startAt);
    filter.Q.setValueAtTime(Math.max(0.1, Math.min(25, initQ)), startAt);

    if (effects.sweep) {
      const startHz = Math.max(20, Math.min(20000, effects.sweep.startHz));
      const endHz = Math.max(20, Math.min(20000, effects.sweep.endHz));
      const secPerBeat = 60 / Math.max(20, event.bpm || 120);
      const sweepSec = Math.max(
        0.04,
        effects.sweep.durationBeats ? effects.sweep.durationBeats * secPerBeat : event.durationSec,
      );
      filter.frequency.setValueAtTime(startHz, startAt);
      filter.frequency.exponentialRampToValueAtTime(endHz, startAt + sweepSec);
    }

    if (effects.lfo && effects.lfo.depthHz > 0) {
      const lfoOsc = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfoOsc.type = 'sine';
      lfoOsc.frequency.setValueAtTime(Math.max(0.05, effects.lfo.rateHz), startAt);
      lfoGain.gain.setValueAtTime(effects.lfo.depthHz, startAt);
      lfoOsc.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfoOsc.start(startAt);
      lfoOsc.stop(stopAt + 0.08);
      extraSources.push(lfoOsc);
    }

    signalOut.connect(filter);
    signalOut = filter;
  }

  const panner = ctx.createStereoPanner();
  const initPan = Math.max(-1, Math.min(1, resolvePanControl(effects.pan ?? 0)));
  panner.pan.setValueAtTime(initPan, startAt);
  signalOut.connect(panner);
  signalOut = panner;

  signalOut.connect(destination);

  let delayNode: DelayNode | undefined;
  let delayWetGain: GainNode | undefined;
  let delayFeedbackGain: GainNode | undefined;

  const initDelayMix = resolveControl('delayMix', effects.delay.mix, true);
  if (initDelayMix > 0 || refs?.delayMix || refs?.delayTimeSec || refs?.delayFeedback) {
    const initDelayTime = resolveControl('delayTimeSec', effects.delay.timeSec);
    const initDelayFb = resolveControl('delayFeedback', effects.delay.feedback, true);

    delayNode = ctx.createDelay(2.0);
    delayNode.delayTime.setValueAtTime(Math.max(0.02, Math.min(1.5, initDelayTime)), startAt);

    delayFeedbackGain = ctx.createGain();
    delayFeedbackGain.gain.setValueAtTime(Math.max(0, Math.min(0.85, initDelayFb)), startAt);

    delayWetGain = ctx.createGain();
    delayWetGain.gain.setValueAtTime(Math.max(0, Math.min(1, initDelayMix)), startAt);

    signalOut.connect(delayNode);
    delayNode.connect(delayFeedbackGain);
    delayFeedbackGain.connect(delayNode);
    delayNode.connect(delayWetGain);
    delayWetGain.connect(destination);
  }

  let reverbWetGain: GainNode | undefined;
  const initReverbMix = resolveControl('reverbMix', effects.reverbMix, true);
  if (initReverbMix > 0 || refs?.reverbMix) {
    const convolver = ctx.createConvolver();
    convolver.buffer = impulseBuffer;
    reverbWetGain = ctx.createGain();
    reverbWetGain.gain.setValueAtTime(Math.max(0, Math.min(1, initReverbMix)), startAt);

    signalOut.connect(convolver);
    convolver.connect(reverbWetGain);
    reverbWetGain.connect(destination);
  }

  const liveNode: LiveControlNodes = {
    event,
    eventGain,
    trackVolumeScale,
    filter,
    panner,
    delayNode,
    delayWetGain,
    delayFeedbackGain,
    reverbWetGain,
    oscillators: [],
    stopAt,
  };

  return {
    dryTarget: eventGain,
    liveNode,
    extraSources,
  };
}

export function scheduleSynthesizedOscillators(
  ctx: BaseAudioContext,
  event: ScheduledAudioEvent,
  destination: AudioNode,
  startAt: number,
  stopAt: number,
  detuneCents: number,
  pitchOscillators: OscillatorNode[],
  onSource: (source: AudioScheduledSourceNode) => void,
  options?: {
    readonly forceDualDetune?: boolean;
    readonly onPitchOsc?: (osc: OscillatorNode, sign: number) => void;
  },
): void {
  const waveform = event.waveform;
  const noteDuration = Math.max(0.03, stopAt - startAt);

  if (waveform === 'fm-keys') {
    for (const freq of event.frequencies) {
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const voiceGain = ctx.createGain();

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(freq, startAt);
      if (detuneCents > 0) {
        carrier.detune.setValueAtTime(detuneCents * 0.4, startAt);
      }

      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(freq * 2, startAt);

      const peakIndex = Math.max(20, freq * 2.4);
      modGain.gain.setValueAtTime(peakIndex, startAt);
      modGain.gain.exponentialRampToValueAtTime(
        Math.max(5, freq * 0.2),
        startAt + Math.min(0.42, noteDuration * 0.8),
      );

      voiceGain.gain.setValueAtTime(0.88, startAt);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(voiceGain);
      voiceGain.connect(destination);

      carrier.start(startAt);
      modulator.start(startAt);
      carrier.stop(stopAt);
      modulator.stop(stopAt);
      pitchOscillators.push(carrier);
      onSource(carrier);
      onSource(modulator);
    }
    return;
  }

  if (waveform === 'acid-bass') {
    for (const freq of event.frequencies) {
      const osc = ctx.createOscillator();
      const acidFilter = ctx.createBiquadFilter();
      const acidGain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startAt);
      if (detuneCents > 0) {
        osc.detune.setValueAtTime(detuneCents, startAt);
      }

      acidFilter.type = 'lowpass';
      acidFilter.Q.setValueAtTime(10.5, startAt);
      const baseHz = Math.max(180, Math.min(2400, freq * 2.2));
      const peakHz = Math.min(7200, baseHz * 3.8);
      acidFilter.frequency.setValueAtTime(peakHz, startAt);
      acidFilter.frequency.exponentialRampToValueAtTime(
        baseHz,
        startAt + Math.min(0.24, noteDuration * 0.85),
      );

      acidGain.gain.setValueAtTime(0.95, startAt);

      osc.connect(acidFilter);
      acidFilter.connect(acidGain);
      acidGain.connect(destination);

      osc.start(startAt);
      osc.stop(stopAt);
      pitchOscillators.push(osc);
      onSource(osc);
    }
    return;
  }

  if (waveform === 'pluck') {
    for (const freq of event.frequencies) {
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const pluckFilter = ctx.createBiquadFilter();
      const pluckGain = ctx.createGain();

      oscA.type = 'triangle';
      oscB.type = 'sawtooth';
      oscA.frequency.setValueAtTime(freq, startAt);
      oscB.frequency.setValueAtTime(freq, startAt);
      oscB.detune.setValueAtTime(Math.max(4, detuneCents), startAt);

      pluckFilter.type = 'lowpass';
      pluckFilter.Q.setValueAtTime(2.2, startAt);
      pluckFilter.frequency.setValueAtTime(Math.min(9000, freq * 12), startAt);
      pluckFilter.frequency.exponentialRampToValueAtTime(
        Math.max(220, freq * 1.4),
        startAt + Math.min(0.22, noteDuration * 0.7),
      );

      pluckGain.gain.setValueAtTime(0.65, startAt);
      pluckGain.gain.exponentialRampToValueAtTime(
        0.16,
        startAt + Math.min(0.3, noteDuration * 0.9),
      );

      oscA.connect(pluckFilter);
      oscB.connect(pluckFilter);
      pluckFilter.connect(pluckGain);
      pluckGain.connect(destination);

      oscA.start(startAt);
      oscB.start(startAt);
      oscA.stop(stopAt);
      oscB.stop(stopAt);
      pitchOscillators.push(oscA, oscB);
      onSource(oscA);
      onSource(oscB);
    }
    return;
  }

  if (waveform === 'sub-808') {
    for (const freq of event.frequencies) {
      const subOsc = ctx.createOscillator();
      const harmonicOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      const harmonicGain = ctx.createGain();

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(freq * 1.18, startAt);
      subOsc.frequency.exponentialRampToValueAtTime(freq, startAt + 0.045);

      harmonicOsc.type = 'triangle';
      harmonicOsc.frequency.setValueAtTime(freq * 2, startAt);
      harmonicGain.gain.setValueAtTime(0.16, startAt);
      harmonicGain.gain.exponentialRampToValueAtTime(0.01, startAt + 0.16);

      subGain.gain.setValueAtTime(1.1, startAt);

      subOsc.connect(subGain);
      harmonicOsc.connect(harmonicGain);
      harmonicGain.connect(subGain);
      subGain.connect(destination);

      subOsc.start(startAt);
      harmonicOsc.start(startAt);
      subOsc.stop(stopAt);
      harmonicOsc.stop(stopAt);
      pitchOscillators.push(subOsc);
      onSource(subOsc);
      onSource(harmonicOsc);
    }
    return;
  }

  if (waveform === 'pad-warm') {
    const spreadCents = Math.max(8, detuneCents || 10);
    for (const freq of event.frequencies) {
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(1950, startAt);
      padFilter.Q.setValueAtTime(0.8, startAt);
      padFilter.connect(destination);

      const offsets = [-spreadCents, 0, spreadCents];
      const types: OscillatorType[] = ['sawtooth', 'triangle', 'sawtooth'];
      offsets.forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const voiceGain = ctx.createGain();
        osc.type = types[idx];
        osc.frequency.setValueAtTime(freq, startAt);
        osc.detune.setValueAtTime(offset, startAt);
        voiceGain.gain.setValueAtTime(0.36, startAt);
        osc.connect(voiceGain);
        voiceGain.connect(padFilter);
        osc.start(startAt);
        osc.stop(stopAt);
        pitchOscillators.push(osc);
        onSource(osc);
      });
    }
    return;
  }

  // Standard classic waveforms: sine, square, sawtooth, triangle
  const baseOscType = waveform as OscillatorType;
  for (const freq of event.frequencies) {
    if (detuneCents > 0 || options?.forceDualDetune) {
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const splitGain = ctx.createGain();
      oscA.type = baseOscType;
      oscB.type = baseOscType;
      oscA.frequency.setValueAtTime(freq, startAt);
      oscB.frequency.setValueAtTime(freq, startAt);
      oscA.detune.setValueAtTime(-detuneCents, startAt);
      oscB.detune.setValueAtTime(detuneCents, startAt);
      splitGain.gain.setValueAtTime(0.55, startAt);

      oscA.connect(splitGain);
      oscB.connect(splitGain);
      splitGain.connect(destination);

      oscA.start(startAt);
      oscB.start(startAt);
      oscA.stop(stopAt);
      oscB.stop(stopAt);
      pitchOscillators.push(oscA, oscB);
      options?.onPitchOsc?.(oscA, -1);
      options?.onPitchOsc?.(oscB, 1);
      onSource(oscA);
      onSource(oscB);
    } else {
      const osc = ctx.createOscillator();
      osc.type = baseOscType;
      osc.frequency.setValueAtTime(freq, startAt);
      osc.connect(destination);
      osc.start(startAt);
      osc.stop(stopAt);
      pitchOscillators.push(osc);
      onSource(osc);
    }
  }
}

export function scheduleSynthesizedDrum(
  ctx: BaseAudioContext,
  drum: DrumType,
  destination: AudioNode,
  startAt: number,
  noiseBufferCache: WeakMap<BaseAudioContext, AudioBuffer>,
  onSource: (source: AudioScheduledSourceNode) => void,
): void {
  const noiseBuffer = getOrCreateNoiseBuffer(ctx, noiseBufferCache);

  switch (drum) {
    case 'kick': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, startAt);
      osc.frequency.exponentialRampToValueAtTime(42, startAt + 0.14);

      gain.gain.setValueAtTime(1.1, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.26);

      osc.connect(gain);
      gain.connect(destination);
      osc.start(startAt);
      osc.stop(startAt + 0.28);
      onSource(osc);
      return;
    }

    case 'snare': {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(1100, startAt);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.65, startAt);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.18);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(destination);
      noise.start(startAt);
      noise.stop(startAt + 0.2);
      onSource(noise);

      const tone = ctx.createOscillator();
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(195, startAt);
      tone.frequency.exponentialRampToValueAtTime(110, startAt + 0.09);
      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0.55, startAt);
      toneGain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.11);

      tone.connect(toneGain);
      toneGain.connect(destination);
      tone.start(startAt);
      tone.stop(startAt + 0.13);
      onSource(tone);
      return;
    }

    case 'hihat':
    case 'open-hihat': {
      const decaySec = drum === 'open-hihat' ? 0.34 : 0.065;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(6500, startAt);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(drum === 'open-hihat' ? 0.48 : 0.42, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + decaySec);

      noise.connect(hp);
      hp.connect(gain);
      gain.connect(destination);
      noise.start(startAt);
      noise.stop(startAt + decaySec + 0.02);
      onSource(noise);
      return;
    }

    case 'clap': {
      const bursts = [0, 0.012, 0.024];
      for (const offset of bursts) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1400, startAt + offset);
        bp.Q.setValueAtTime(1.8, startAt + offset);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.55, startAt + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + offset + 0.12);

        noise.connect(bp);
        bp.connect(gain);
        gain.connect(destination);
        noise.start(startAt + offset);
        noise.stop(startAt + offset + 0.14);
        onSource(noise);
      }
      return;
    }

    case 'tom': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, startAt);
      osc.frequency.exponentialRampToValueAtTime(75, startAt + 0.2);

      gain.gain.setValueAtTime(0.85, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.24);

      osc.connect(gain);
      gain.connect(destination);
      osc.start(startAt);
      osc.stop(startAt + 0.26);
      onSource(osc);
      return;
    }

    case 'rim': {
      const osc = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, startAt);
      osc.frequency.exponentialRampToValueAtTime(430, startAt + 0.032);
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1680, startAt);
      bp.Q.setValueAtTime(3.2, startAt);
      gain.gain.setValueAtTime(0.75, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.045);

      osc.connect(bp);
      bp.connect(gain);
      gain.connect(destination);
      osc.start(startAt);
      osc.stop(startAt + 0.06);
      onSource(osc);
      return;
    }

    case 'cowbell': {
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      oscA.type = 'square';
      oscB.type = 'square';
      oscA.frequency.setValueAtTime(540, startAt);
      oscB.frequency.setValueAtTime(800, startAt);

      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(750, startAt);
      bp.Q.setValueAtTime(2.6, startAt);

      gain.gain.setValueAtTime(0.5, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.22);

      oscA.connect(bp);
      oscB.connect(bp);
      bp.connect(gain);
      gain.connect(destination);

      oscA.start(startAt);
      oscB.start(startAt);
      oscA.stop(startAt + 0.24);
      oscB.stop(startAt + 0.24);
      onSource(oscA);
      onSource(oscB);
      return;
    }

    case 'crash': {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(3200, startAt);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.55, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 1.1);

      noise.connect(hp);
      hp.connect(gain);
      gain.connect(destination);
      noise.start(startAt);
      noise.stop(startAt + 1.15);
      onSource(noise);

      // Metallic shimmer partials
      for (const ratioFreq of [310, 495, 680]) {
        const ring = ctx.createOscillator();
        const ringGain = ctx.createGain();
        ring.type = 'square';
        ring.frequency.setValueAtTime(ratioFreq, startAt);
        ringGain.gain.setValueAtTime(0.06, startAt);
        ringGain.gain.exponentialRampToValueAtTime(0.0005, startAt + 0.45);
        ring.connect(hp);
        ring.connect(ringGain);
        ringGain.connect(gain);
        ring.start(startAt);
        ring.stop(startAt + 0.48);
        onSource(ring);
      }
      return;
    }

    case 'perc': {
      const osc = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(390, startAt);
      osc.frequency.exponentialRampToValueAtTime(240, startAt + 0.075);

      mod.type = 'sine';
      mod.frequency.setValueAtTime(585, startAt);
      modGain.gain.setValueAtTime(140, startAt);
      modGain.gain.exponentialRampToValueAtTime(5, startAt + 0.05);

      gain.gain.setValueAtTime(0.68, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.11);

      mod.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(destination);

      osc.start(startAt);
      mod.start(startAt);
      osc.stop(startAt + 0.13);
      mod.stop(startAt + 0.13);
      onSource(osc);
      onSource(mod);
      return;
    }
  }
}
