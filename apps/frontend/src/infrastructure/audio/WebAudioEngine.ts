import type {
  ConsoleLogEntry,
  ControlDescriptor,
  ControlTargetParam,
  DrumType,
  ExecutionPlan,
  ScheduledAudioEvent,
  WaveformType,
} from '@sythm/core';
import {
  createImpulseBuffer,
  scheduleSynthesizedDrum,
  scheduleSynthesizedOscillators,
} from './SythmSynthGraph';

export interface PlaybackCallbacks {
  loop: boolean;
  mutedTracks?: ReadonlySet<string>;
  soloedTracks?: ReadonlySet<string>;
  onEventStart?: (event: ScheduledAudioEvent, cycle: number) => void;
  onEventEnd?: (event: ScheduledAudioEvent, cycle: number) => void;
  onLogTrigger?: (log: ConsoleLogEntry, cycle: number) => void;
  onCycleStart?: (cycle: number) => void;
  onHotSwap?: () => void;
  onComplete?: () => void;
}

interface TrackBus {
  dryGain: GainNode;
  delayGate: GainNode;
  reverbGate: GainNode;
}

interface LiveControlNodes {
  volumeGains: Set<GainNode>;
  filters: Set<BiquadFilterNode>;
  panners: Set<StereoPannerNode>;
  delaySends: Set<GainNode>;
  reverbSends: Set<GainNode>;
  oscillators: Set<{ osc: OscillatorNode; sign: number }>;
}

interface EventChainResult {
  inputNode: AudioNode;
  cleanup: () => void;
}

export class WebAudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private delayInput: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private reverbInput: GainNode | null = null;
  private convolverNode: ConvolverNode | null = null;
  private noiseBufferCache: WeakMap<BaseAudioContext, AudioBuffer> = new WeakMap();
  private trackBuses: Map<string, TrackBus> = new Map();
  private activeNodes: Set<AudioScheduledSourceNode> = new Set();
  private timers: Set<number> = new Set();
  private scheduledEntries: Array<{ startAt: number; timerIds: number[]; cleanup: () => void }> = [];
  private cycleEndTimerId: number | null = null;
  private pendingSwapTimerId: number | null = null;
  private scheduledCycleDurationSec = 0;
  private running = false;
  private loopEnabled = false;
  private mutedTracks: ReadonlySet<string> = new Set();
  private soloedTracks: ReadonlySet<string> = new Set();
  private masterVolume = 0.85;
  private sampleBuffers: Map<string, AudioBuffer> = new Map();
  private currentPlan: ExecutionPlan | null = null;
  private callbacks: PlaybackCallbacks = { loop: false };
  private cycle = 0;
  private cycleStartAudioTime = 0;

  private controlOverrides: Map<string, number> = new Map();
  private controlDescriptors: Map<string, ControlDescriptor> = new Map();
  private liveControlNodes: Map<string, LiveControlNodes> = new Map();

  isPlaying(): boolean {
    return this.running;
  }

  getTimeDomainData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser || !this.running) return false;
    this.analyser.getByteTimeDomainData(target);
    return true;
  }

  getFrequencyData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser || !this.running) return false;
    this.analyser.getByteFrequencyData(target);
    return true;
  }

  getProgress(): {
    currentBeat: number;
    totalBeats: number;
    elapsedSec: number;
    totalDurationSec: number;
    isPlaying: boolean;
  } {
    const plan = this.currentPlan;
    if (!this.context || !this.running || !plan || plan.totalDurationSec <= 0) {
      return {
        currentBeat: 0,
        totalBeats: plan?.totalBeats ?? 0,
        elapsedSec: 0,
        totalDurationSec: plan?.totalDurationSec ?? 0,
        isPlaying: false,
      };
    }

    const rawElapsed = Math.max(0, this.context.currentTime - this.cycleStartAudioTime);
    const elapsedSec = this.loopEnabled
      ? rawElapsed % plan.totalDurationSec
      : Math.min(plan.totalDurationSec, rawElapsed);
    const ratio = elapsedSec / plan.totalDurationSec;

    return {
      currentBeat: ratio * plan.totalBeats,
      totalBeats: plan.totalBeats,
      elapsedSec,
      totalDurationSec: plan.totalDurationSec,
      isPlaying: this.running,
    };
  }

  setLoop(loop: boolean): void {
    this.loopEnabled = loop;
    this.callbacks = { ...this.callbacks, loop };
  }

  async previewNote(
    frequencyHz: number,
    waveform: WaveformType = 'triangle',
    durationSec = 0.28,
  ): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (!this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type =
      waveform === 'sine' || waveform === 'square' || waveform === 'sawtooth' || waveform === 'triangle'
        ? waveform
        : 'triangle';
    osc.frequency.setValueAtTime(Math.max(20, Math.min(12000, frequencyHz)), now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  setMasterVolume(volumePercent: number): void {
    const normalized = Math.min(1, Math.max(0, volumePercent / 100));
    this.masterVolume = normalized;
    if (this.masterGain && this.context) {
      this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
      this.masterGain.gain.setTargetAtTime(normalized, this.context.currentTime, 0.02);
    }
  }

  setSampleBuffers(samples: ReadonlyMap<string, AudioBuffer>): void {
    this.sampleBuffers = new Map(samples);
  }

  private resolveSampleBuffer(name: string): AudioBuffer | undefined {
    const exact = this.sampleBuffers.get(name);
    if (exact) return exact;
    const lower = name.trim().toLowerCase();
    return this.sampleBuffers.get(lower) ?? this.sampleBuffers.get(lower.replace(/\.[^.]+$/, ''));
  }

  setTrackMix(mutedTracks: ReadonlySet<string>, soloedTracks: ReadonlySet<string>): void {
    this.mutedTracks = mutedTracks;
    this.soloedTracks = soloedTracks;

    const hasSolo = soloedTracks.size > 0;
    const now = this.context?.currentTime ?? 0;
    for (const [trackName, bus] of this.trackBuses.entries()) {
      const isMuted = mutedTracks.has(trackName) || (hasSolo && !soloedTracks.has(trackName));
      const gainVal = isMuted ? 0 : 1;
      bus.dryGain.gain.setValueAtTime(gainVal, now);
      bus.delayGate.gain.setValueAtTime(gainVal, now);
      bus.reverbGate.gain.setValueAtTime(gainVal, now);
    }
  }

  updatePlan(plan: ExecutionPlan): void {
    this.currentPlan = plan;
    this.syncControlDescriptors(plan);

    if (!this.running || !this.loopEnabled || !this.context || plan.totalDurationSec <= 0) {
      return;
    }

    const ctx = this.context;
    const elapsedSec = Math.max(0, ctx.currentTime - this.cycleStartAudioTime);
    const barDurationSec = (60 / Math.max(20, plan.initialBpm || 120)) * 4;
    const nextBarIndex = Math.floor(elapsedSec / barDurationSec) + 1;
    const nextBarOffsetSec = nextBarIndex * barDurationSec;

    // If the next bar is basically at or past the end of the current cycle,
    // the existing cycle-end timer will naturally pick up `this.currentPlan`.
    if (nextBarOffsetSec >= this.scheduledCycleDurationSec - 0.05) {
      return;
    }

    if (this.pendingSwapTimerId !== null) {
      window.clearTimeout(this.pendingSwapTimerId);
      this.timers.delete(this.pendingSwapTimerId);
      this.pendingSwapTimerId = null;
    }

    const swapAudioTime = this.cycleStartAudioTime + nextBarOffsetSec;
    const msUntilSwap = Math.max(0, (swapAudioTime - ctx.currentTime - 0.035) * 1000);

    const timerId = window.setTimeout(() => {
      this.timers.delete(timerId);
      this.pendingSwapTimerId = null;
      if (!this.running || !this.loopEnabled || !this.currentPlan || !this.context) {
        return;
      }

      // Cancel future scheduled entries from the old plan at or after `swapAudioTime`
      const remaining: typeof this.scheduledEntries = [];
      for (const entry of this.scheduledEntries) {
        if (entry.startAt >= swapAudioTime - 0.005) {
          for (const tId of entry.timerIds) {
            window.clearTimeout(tId);
            this.timers.delete(tId);
          }
          entry.cleanup();
        } else {
          remaining.push(entry);
        }
      }
      this.scheduledEntries = remaining;

      if (this.cycleEndTimerId !== null) {
        window.clearTimeout(this.cycleEndTimerId);
        this.timers.delete(this.cycleEndTimerId);
        this.cycleEndTimerId = null;
      }

      const activePlan = this.currentPlan;
      const offsetInNewPlan = nextBarOffsetSec % Math.max(0.05, activePlan.totalDurationSec);
      this.callbacks.onHotSwap?.();
      this.scheduleCycleFromOffset(swapAudioTime, offsetInNewPlan);
    }, msUntilSwap);

    this.pendingSwapTimerId = timerId;
    this.timers.add(timerId);
  }

  setControlValue(control: ControlDescriptor, rawValue: number): void {
    this.controlOverrides.set(control.name, rawValue);
    this.controlDescriptors.set(control.name, control);

    if (!this.context) return;

    const now = this.context.currentTime;
    const normalizedPercent = this.normalizeControlPercent(control, rawValue);
    const bucket = this.liveControlNodes.get(control.name);

    for (const binding of control.bindings) {
      switch (binding.param) {
        case 'volume': {
          const vol = Math.max(0, Math.min(1, normalizedPercent));
          if (bucket) {
            for (const gainNode of bucket.volumeGains) {
              gainNode.gain.cancelScheduledValues(now);
              gainNode.gain.setTargetAtTime(vol, now, 0.015);
            }
          }
          break;
        }

        case 'filterFrequencyHz': {
          const hz = Math.max(20, Math.min(20000, rawValue));
          if (bucket) {
            for (const filter of bucket.filters) {
              filter.frequency.cancelScheduledValues(now);
              filter.frequency.setTargetAtTime(hz, now, 0.015);
            }
          }
          break;
        }

        case 'filterQ': {
          const qVal = Math.max(0.1, Math.min(20, rawValue));
          if (bucket) {
            for (const filter of bucket.filters) {
              filter.Q.cancelScheduledValues(now);
              filter.Q.setTargetAtTime(qVal, now, 0.015);
            }
          }
          break;
        }

        case 'delayMix': {
          const mix = Math.max(0, Math.min(1, normalizedPercent));
          if (bucket) {
            for (const send of bucket.delaySends) {
              send.gain.cancelScheduledValues(now);
              send.gain.setTargetAtTime(mix, now, 0.015);
            }
          }
          break;
        }

        case 'delayTimeSec': {
          if (this.delayNode) {
            const timeSec = Math.max(0.02, Math.min(2.0, rawValue));
            this.delayNode.delayTime.cancelScheduledValues(now);
            this.delayNode.delayTime.setTargetAtTime(timeSec, now, 0.02);
          }
          break;
        }

        case 'delayFeedback': {
          if (this.delayFeedback) {
            const fb = Math.max(0, Math.min(0.88, normalizedPercent));
            this.delayFeedback.gain.cancelScheduledValues(now);
            this.delayFeedback.gain.setTargetAtTime(fb, now, 0.02);
          }
          break;
        }

        case 'reverbMix': {
          const mix = Math.max(0, Math.min(1, normalizedPercent));
          if (bucket) {
            for (const send of bucket.reverbSends) {
              send.gain.cancelScheduledValues(now);
              send.gain.setTargetAtTime(mix, now, 0.015);
            }
          }
          break;
        }

        case 'detuneCents': {
          const cents = Math.max(0, Math.min(100, rawValue));
          if (bucket) {
            for (const item of bucket.oscillators) {
              item.osc.detune.cancelScheduledValues(now);
              item.osc.detune.setTargetAtTime(item.sign * cents, now, 0.015);
            }
          }
          break;
        }

        case 'pan': {
          const pan = Math.max(-1, Math.min(1, normalizedPercent));
          if (bucket) {
            for (const panner of bucket.panners) {
              panner.pan.cancelScheduledValues(now);
              panner.pan.setTargetAtTime(pan, now, 0.015);
            }
          }
          break;
        }

        case 'tempo':
          // Applied via compiled plan update on next cycle
          break;
      }
    }
  }

  async start(plan: ExecutionPlan, callbacks: PlaybackCallbacks): Promise<void> {
    this.stop();

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    this.currentPlan = plan;
    this.controlOverrides.clear();
    this.syncControlDescriptors(plan);
    this.callbacks = callbacks;
    this.loopEnabled = callbacks.loop;
    this.mutedTracks = callbacks.mutedTracks ?? this.mutedTracks;
    this.soloedTracks = callbacks.soloedTracks ?? this.soloedTracks;
    this.running = true;
    this.cycle = 0;

    this.scheduleCycle();
  }

  stop(): void {
    this.running = false;

    for (const timerId of this.timers) {
      window.clearTimeout(timerId);
    }
    this.timers.clear();
    this.cycleEndTimerId = null;
    this.pendingSwapTimerId = null;
    this.scheduledEntries = [];

    for (const node of this.activeNodes) {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Ignore already-stopped nodes
      }
    }
    this.activeNodes.clear();
    this.liveControlNodes.clear();
  }

  private syncControlDescriptors(plan: ExecutionPlan): void {
    this.controlDescriptors.clear();
    for (const ctrl of plan.controls) {
      this.controlDescriptors.set(ctrl.name, ctrl);
    }
  }

  private normalizeControlPercent(control: ControlDescriptor, rawValue: number): number {
    return Math.abs(control.min) > 1 || control.max > 1 ? rawValue / 100 : rawValue;
  }

  private getControlBucket(controlName: string): LiveControlNodes {
    let bucket = this.liveControlNodes.get(controlName);
    if (!bucket) {
      bucket = {
        volumeGains: new Set(),
        filters: new Set(),
        panners: new Set(),
        delaySends: new Set(),
        reverbSends: new Set(),
        oscillators: new Set(),
      };
      this.liveControlNodes.set(controlName, bucket);
    }
    return bucket;
  }

  private resolveLiveNumber(
    event: ScheduledAudioEvent,
    param: ControlTargetParam,
    fallback: number,
    isPercent = false,
  ): number {
    const controlName = event.controlRefs?.[param];
    if (!controlName) return fallback;
    const override = this.controlOverrides.get(controlName);
    if (override === undefined) return fallback;
    if (isPercent) {
      const descriptor = this.controlDescriptors.get(controlName);
      return descriptor ? this.normalizeControlPercent(descriptor, override) : override / 100;
    }
    return override;
  }

  dispose(): void {
    this.stop();
    for (const bus of this.trackBuses.values()) {
      bus.dryGain.disconnect();
      bus.delayGate.disconnect();
      bus.reverbGate.disconnect();
    }
    this.trackBuses.clear();
    if (this.context) {
      void this.context.close();
      this.context = null;
      this.masterGain = null;
      this.analyser = null;
      this.delayInput = null;
      this.delayNode = null;
      this.delayFeedback = null;
      this.reverbInput = null;
      this.convolverNode = null;
    }
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      this.context = ctx;

      const master = ctx.createGain();
      master.gain.value = this.masterVolume;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;

      master.connect(analyser);
      analyser.connect(ctx.destination);
      this.masterGain = master;
      this.analyser = analyser;

      // Global Delay Bus
      const delayIn = ctx.createGain();
      const delay = ctx.createDelay(2.0);
      delay.delayTime.value = 0.35;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.35;
      const delayOut = ctx.createGain();
      delayOut.gain.value = 0.85;

      delayIn.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(delayOut);
      delayOut.connect(master);

      this.delayInput = delayIn;
      this.delayNode = delay;
      this.delayFeedback = feedback;

      // Global Procedural Reverb Bus
      const reverbIn = ctx.createGain();
      const convolver = ctx.createConvolver();
      convolver.buffer = createImpulseBuffer(ctx, 2.0, 2.8);
      const reverbOut = ctx.createGain();
      reverbOut.gain.value = 0.75;

      reverbIn.connect(convolver);
      convolver.connect(reverbOut);
      reverbOut.connect(master);

      this.reverbInput = reverbIn;
      this.convolverNode = convolver;
    }
    return this.context;
  }

  private getTrackBus(trackName: string): TrackBus {
    const ctx = this.ensureContext();
    let bus = this.trackBuses.get(trackName);
    if (!bus && this.masterGain && this.delayInput && this.reverbInput) {
      const dryGain = ctx.createGain();
      dryGain.connect(this.masterGain);

      const delayGate = ctx.createGain();
      delayGate.connect(this.delayInput);

      const reverbGate = ctx.createGain();
      reverbGate.connect(this.reverbInput);

      bus = { dryGain, delayGate, reverbGate };
      this.trackBuses.set(trackName, bus);
    }

    const hasSolo = this.soloedTracks.size > 0;
    const isMuted =
      this.mutedTracks.has(trackName) || (hasSolo && !this.soloedTracks.has(trackName));
    const gainVal = isMuted ? 0 : 1;
    bus!.dryGain.gain.setValueAtTime(gainVal, ctx.currentTime);
    bus!.delayGate.gain.setValueAtTime(gainVal, ctx.currentTime);
    bus!.reverbGate.gain.setValueAtTime(gainVal, ctx.currentTime);
    return bus!;
  }

  private createEventChain(
    event: ScheduledAudioEvent,
    startAt: number,
    bus: TrackBus,
  ): EventChainResult {
    const ctx = this.context!;
    const fx = event.effects;
    const cleanups: Array<() => void> = [];

    const eventOut = ctx.createGain();
    const volCtrlName = event.controlRefs?.volume;
    if (volCtrlName) {
      const liveVol = this.resolveLiveNumber(event, 'volume', event.volume / 0.4, true);
      eventOut.gain.value = Math.max(0, Math.min(1, liveVol));
      const bucket = this.getControlBucket(volCtrlName);
      bucket.volumeGains.add(eventOut);
      cleanups.push(() => bucket.volumeGains.delete(eventOut));
    } else {
      eventOut.gain.value = 1;
    }
    const panner = ctx.createStereoPanner();
      const panCtrlName = event.controlRefs?.pan;
    const livePan = this.resolveLiveNumber(event, 'pan', fx.pan ?? 0, true);
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, livePan)), startAt);
    eventOut.connect(panner);
    panner.connect(bus.dryGain);
    cleanups.push(() => {
      eventOut.disconnect();
      panner.disconnect();
    });

    if (panCtrlName) {
      const bucket = this.getControlBucket(panCtrlName);
      bucket.panners.add(panner);
      cleanups.push(() => bucket.panners.delete(panner));
    }

    const volumeRamp = event.ramps?.find((r) => r.param === 'volume');
    if (volumeRamp) {
      const fromVol = Math.max(0, Math.min(1, volumeRamp.fromValue / 100));
      const toVol = Math.max(0, Math.min(1, volumeRamp.toValue / 100));
      const rampEnd = startAt + Math.max(0.02, volumeRamp.durationSec);
      eventOut.gain.setValueAtTime(fromVol, startAt);
      eventOut.gain.linearRampToValueAtTime(toVol, rampEnd);
    }

    const panRamp = event.ramps?.find((r) => r.param === 'pan');
    if (panRamp) {
      const fromPan = Math.max(-1, Math.min(1, panRamp.fromValue / 100));
      const toPan = Math.max(-1, Math.min(1, panRamp.toValue / 100));
      const rampEnd = startAt + Math.max(0.02, panRamp.durationSec);
      panner.pan.setValueAtTime(fromPan, startAt);
      panner.pan.linearRampToValueAtTime(toPan, rampEnd);
    }

    let inputNode: AudioNode = eventOut;

    const hasFilter =
      fx.filter.mode !== 'off' ||
      Boolean(fx.lfo) ||
      Boolean(fx.sweep) ||
      Boolean(event.controlRefs?.filterFrequencyHz || event.controlRefs?.filterQ);

    if (hasFilter) {
      const filter = ctx.createBiquadFilter();
      filter.type = fx.filter.mode === 'off' ? 'lowpass' : fx.filter.mode;
      const liveFreq = this.resolveLiveNumber(event, 'filterFrequencyHz', fx.filter.frequencyHz);
      const liveQ = this.resolveLiveNumber(event, 'filterQ', fx.filter.q);
      filter.frequency.value = Math.max(20, Math.min(20000, liveFreq));
      filter.Q.value = Math.max(0.1, Math.min(25, liveQ));

      if (fx.sweep) {
        const startHz = Math.max(20, Math.min(20000, fx.sweep.startHz));
        const endHz = Math.max(20, Math.min(20000, fx.sweep.endHz));
        const secPerBeat = 60 / Math.max(20, event.bpm || 120);
        const sweepSec = Math.max(
          0.04,
          fx.sweep.durationBeats ? fx.sweep.durationBeats * secPerBeat : event.durationSec,
        );
        filter.frequency.setValueAtTime(startHz, startAt);
        filter.frequency.exponentialRampToValueAtTime(endHz, startAt + sweepSec);
      }

      const filterRamp = event.ramps?.find((r) => r.param === 'filter');
      if (filterRamp) {
        const startHz = Math.max(20, Math.min(20000, filterRamp.fromValue));
        const endHz = Math.max(20, Math.min(20000, filterRamp.toValue));
        const rampEnd = startAt + Math.max(0.02, filterRamp.durationSec);
        filter.frequency.setValueAtTime(startHz, startAt);
        filter.frequency.exponentialRampToValueAtTime(endHz, rampEnd);
      }

      if (fx.lfo && fx.lfo.depthHz > 0) {
        const lfoOsc = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfoOsc.type = 'sine';
        lfoOsc.frequency.setValueAtTime(Math.max(0.05, fx.lfo.rateHz), startAt);
        lfoGain.gain.setValueAtTime(fx.lfo.depthHz, startAt);
        lfoOsc.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        const lfoStopAt = startAt + Math.max(0.08, event.durationSec + fx.envelope.releaseSec + 0.08);
        this.activeNodes.add(lfoOsc);
        lfoOsc.start(startAt);
        lfoOsc.stop(lfoStopAt);
        cleanups.push(() => {
          this.activeNodes.delete(lfoOsc);
          try {
            lfoOsc.stop();
          } catch {
            // Already stopped
          }
          lfoOsc.disconnect();
          lfoGain.disconnect();
        });
      }

      filter.connect(eventOut);
      inputNode = filter;
      cleanups.push(() => filter.disconnect());

      const freqCtrl = event.controlRefs?.filterFrequencyHz;
      if (freqCtrl) {
        const bucket = this.getControlBucket(freqCtrl);
        bucket.filters.add(filter);
        cleanups.push(() => bucket.filters.delete(filter));
      }

      const qCtrl = event.controlRefs?.filterQ;
      if (qCtrl) {
        const bucket = this.getControlBucket(qCtrl);
        bucket.filters.add(filter);
        cleanups.push(() => bucket.filters.delete(filter));
      }
    }

    const delayMixCtrl = event.controlRefs?.delayMix;
    const liveDelayMix = this.resolveLiveNumber(event, 'delayMix', fx.delay.mix, true);
    if ((liveDelayMix > 0 || delayMixCtrl) && this.delayNode && this.delayFeedback) {
      const liveDelayTime = this.resolveLiveNumber(event, 'delayTimeSec', fx.delay.timeSec);
      const liveDelayFb = this.resolveLiveNumber(event, 'delayFeedback', fx.delay.feedback, true);

      if (!event.controlRefs?.delayTimeSec) {
        this.delayNode.delayTime.setValueAtTime(Math.max(0.02, Math.min(2.0, liveDelayTime)), startAt);
      } else {
        this.delayNode.delayTime.setValueAtTime(
          Math.max(0.02, Math.min(2.0, liveDelayTime)),
          ctx.currentTime,
        );
      }
      if (!event.controlRefs?.delayFeedback) {
        this.delayFeedback.gain.setValueAtTime(Math.max(0, Math.min(0.88, liveDelayFb)), startAt);
      } else {
        this.delayFeedback.gain.setValueAtTime(
          Math.max(0, Math.min(0.88, liveDelayFb)),
          ctx.currentTime,
        );
      }

      const delaySend = ctx.createGain();
      delaySend.gain.value = Math.max(0, Math.min(1, liveDelayMix));
      const delayRamp = event.ramps?.find((r) => r.param === 'delay');
      if (delayRamp) {
        delaySend.gain.setValueAtTime(Math.max(0, Math.min(1, delayRamp.fromValue / 100)), startAt);
        delaySend.gain.linearRampToValueAtTime(
          Math.max(0, Math.min(1, delayRamp.toValue / 100)),
          startAt + Math.max(0.02, delayRamp.durationSec),
        );
      }
      panner.connect(delaySend);
      delaySend.connect(bus.delayGate);
      cleanups.push(() => delaySend.disconnect());

      if (delayMixCtrl) {
        const bucket = this.getControlBucket(delayMixCtrl);
        bucket.delaySends.add(delaySend);
        cleanups.push(() => bucket.delaySends.delete(delaySend));
      }
    }

    const reverbMixCtrl = event.controlRefs?.reverbMix;
    const liveReverbMix = this.resolveLiveNumber(event, 'reverbMix', fx.reverbMix, true);
    if (liveReverbMix > 0 || reverbMixCtrl) {
      const reverbSend = ctx.createGain();
      reverbSend.gain.value = Math.max(0, Math.min(1, liveReverbMix));
      const reverbRamp = event.ramps?.find((r) => r.param === 'reverb');
      if (reverbRamp) {
        reverbSend.gain.setValueAtTime(Math.max(0, Math.min(1, reverbRamp.fromValue / 100)), startAt);
        reverbSend.gain.linearRampToValueAtTime(
          Math.max(0, Math.min(1, reverbRamp.toValue / 100)),
          startAt + Math.max(0.02, reverbRamp.durationSec),
        );
      }
      panner.connect(reverbSend);
      reverbSend.connect(bus.reverbGate);
      cleanups.push(() => reverbSend.disconnect());

      if (reverbMixCtrl) {
        const bucket = this.getControlBucket(reverbMixCtrl);
        bucket.reverbSends.add(reverbSend);
        cleanups.push(() => bucket.reverbSends.delete(reverbSend));
      }
    }

    return {
      inputNode,
      cleanup: () => {
        for (const fn of cleanups) {
          fn();
        }
      },
    };
  }

  private resolveRuntimeEvent(event: ScheduledAudioEvent): ScheduledAudioEvent | null {
    if (event.probability !== undefined && Math.random() * 100 >= event.probability) {
      return null;
    }

    let resolved = event;

    if (resolved.drumChoices && resolved.drumChoices.length > 0) {
      const picked =
        resolved.drumChoices[Math.floor(Math.random() * resolved.drumChoices.length)];
      resolved = {
        ...resolved,
        drum: picked,
        notes: [picked.toUpperCase()],
      };
    } else if (
      resolved.noteChoices &&
      resolved.frequencyChoices &&
      resolved.noteChoices.length > 0
    ) {
      const idx = Math.floor(Math.random() * resolved.noteChoices.length);
      resolved = {
        ...resolved,
        notes: [resolved.noteChoices[idx]],
        frequencies: [resolved.frequencyChoices[idx]],
      };
    }

    if (resolved.humanize) {
      const deltaSec = ((Math.random() * 2 - 1) * resolved.humanize.timingMs) / 1000;
      const velScale = 1 + (Math.random() * 2 - 1) * (resolved.humanize.velocityPercent / 100);
      resolved = {
        ...resolved,
        startTimeSec: Math.max(0, resolved.startTimeSec + deltaSec),
        volume:
          resolved.volume <= 0
            ? 0
            : Math.max(0.01, Math.min(0.45, resolved.volume * velScale)),
      };
    }

    return resolved;
  }

  private scheduleCycle(): void {
    if (!this.running || !this.currentPlan || !this.context || !this.masterGain) {
      return;
    }
    const baseAudioTime = this.context.currentTime + 0.04;
    this.scheduleCycleFromOffset(baseAudioTime, 0);
  }

  private scheduleCycleFromOffset(cycleOriginAudioTime: number, offsetSec: number): void {
    if (!this.running || !this.currentPlan || !this.context || !this.masterGain) {
      return;
    }

    const plan = this.currentPlan;
    const cycleNumber = ++this.cycle;
    this.callbacks.onCycleStart?.(cycleNumber);

    if (plan.events.length === 0 || plan.totalDurationSec <= 0) {
      for (const log of plan.logs) {
        this.callbacks.onLogTrigger?.(log, cycleNumber);
      }
      this.running = false;
      this.callbacks.onComplete?.();
      return;
    }

    const ctx = this.context;
    this.scheduledEntries = [];
    this.cycleStartAudioTime = cycleOriginAudioTime - offsetSec;
    this.scheduledCycleDurationSec = plan.totalDurationSec;

    for (const rawEvent of plan.events) {
      if (rawEvent.startTimeSec < offsetSec - 0.005) {
        continue;
      }

      const event = this.resolveRuntimeEvent(rawEvent);
      if (!event) {
        continue;
      }

      const relativeOffsetSec = Math.max(0, event.startTimeSec - offsetSec);
      const startAt = cycleOriginAudioTime + relativeOffsetSec;
      const delayMs = Math.max(0, (startAt - ctx.currentTime) * 1000);
      const endDelayMs = Math.max(delayMs + 30, delayMs + event.durationSec * 1000);
      const trackBus = this.getTrackBus(event.trackName);

      // When volume is bound to a CONTROL, source outputs at unit full-scale (0.4) and eventOut.gain controls volume in real time
      const sourceVolume = event.controlRefs?.volume ? 0.4 : event.volume;

      let chainCleanup: (() => void) | null = null;
      if (event.type === 'drum' && event.drum) {
        const chain = this.createEventChain(event, startAt, trackBus);
        chainCleanup = chain.cleanup;
        this.scheduleDrum(event.drum, sourceVolume, startAt, chain.inputNode, chain.cleanup);
      } else if (event.type === 'sample' && event.sampleName) {
        const buffer = this.resolveSampleBuffer(event.sampleName);
        if (buffer) {
          const chain = this.createEventChain(event, startAt, trackBus);
          chainCleanup = chain.cleanup;
          this.scheduleSample(event, buffer, sourceVolume, startAt, chain.inputNode, chain.cleanup);
        }
      } else if (event.type !== 'rest' && event.frequencies.length > 0) {
        const chain = this.createEventChain(event, startAt, trackBus);
        chainCleanup = chain.cleanup;
        this.scheduleOscillators(event, sourceVolume, startAt, chain.inputNode, chain.cleanup);
      }

      const startTimer = window.setTimeout(() => {
        if (!this.running) return;
        this.callbacks.onEventStart?.(event, cycleNumber);
      }, delayMs);
      this.timers.add(startTimer);

      const endTimer = window.setTimeout(() => {
        if (!this.running) return;
        this.callbacks.onEventEnd?.(event, cycleNumber);
      }, endDelayMs);
      this.timers.add(endTimer);

      this.scheduledEntries.push({
        startAt,
        timerIds: [startTimer, endTimer],
        cleanup: () => {
          chainCleanup?.();
        },
      });
    }

    for (const log of plan.logs) {
      if (log.timestampOffsetSec < offsetSec - 0.005) continue;
      const logDelayMs = Math.max(
        0,
        (cycleOriginAudioTime + (log.timestampOffsetSec - offsetSec) - ctx.currentTime) * 1000,
      );
      const logTimer = window.setTimeout(() => {
        if (!this.running) return;
        this.callbacks.onLogTrigger?.(log, cycleNumber);
      }, logDelayMs);
      this.timers.add(logTimer);
    }

    const remainingDurationSec = Math.max(0.05, plan.totalDurationSec - offsetSec);
    const cycleEndMs = Math.max(
      50,
      (cycleOriginAudioTime + remainingDurationSec - ctx.currentTime) * 1000 + 25,
    );
    const endTimer = window.setTimeout(() => {
      this.timers.delete(endTimer);
      this.cycleEndTimerId = null;
      if (!this.running) return;

      if (this.loopEnabled) {
        this.scheduleCycle();
      } else {
        this.running = false;
        this.callbacks.onComplete?.();
      }
    }, cycleEndMs);

    this.cycleEndTimerId = endTimer;
    this.timers.add(endTimer);
  }

  private scheduleOscillators(
    event: ScheduledAudioEvent,
    sourceVolume: number,
    startAt: number,
    destination: AudioNode,
    onChainDone: () => void,
  ): void {
    if (!this.context) return;

    const ctx = this.context;
    const duration = Math.max(0.04, event.durationSec);
    const env = event.effects.envelope;
    const detuneCtrl = event.controlRefs?.detuneCents;
    const liveDetune = this.resolveLiveNumber(event, 'detuneCents', event.effects.detuneCents);
    const voiceSpreadCount = liveDetune > 0 || detuneCtrl ? 2 : 1;

    const polyScale = 1 / Math.sqrt(event.frequencies.length * voiceSpreadCount);
    const peakGain =
      sourceVolume <= 0 ? 0.0001 : Math.min(0.45, Math.max(0.03, sourceVolume * polyScale));
    const sustainGain = Math.max(0.0002, peakGain * env.sustainLevel);

    const attack = Math.min(env.attackSec, duration * 0.6);
    const decay = Math.min(env.decaySec, Math.max(0.005, duration - attack));
    const release = Math.min(env.releaseSec, 1.5);
    const noteOffAt = Math.max(startAt + attack + decay, startAt + duration);
    const stopAt = noteOffAt + release + 0.01;

    const voiceEnvelopeGain = ctx.createGain();
    voiceEnvelopeGain.gain.setValueAtTime(0.0001, startAt);
    voiceEnvelopeGain.gain.linearRampToValueAtTime(peakGain, startAt + attack);
    voiceEnvelopeGain.gain.linearRampToValueAtTime(sustainGain, startAt + attack + decay);
    voiceEnvelopeGain.gain.setValueAtTime(sustainGain, noteOffAt);
    voiceEnvelopeGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    voiceEnvelopeGain.connect(destination);

    const detuneBucket = detuneCtrl ? this.getControlBucket(detuneCtrl) : null;
    const registeredOscs: Array<{ osc: OscillatorNode; sign: number }> = [];
    const sources: AudioScheduledSourceNode[] = [];
    const pitchOscs: OscillatorNode[] = [];

    scheduleSynthesizedOscillators(
      ctx,
      event,
      voiceEnvelopeGain,
      startAt,
      stopAt + 0.01,
      liveDetune,
      pitchOscs,
      (src) => sources.push(src),
      {
        forceDualDetune: Boolean(detuneCtrl),
        onPitchOsc: (osc, sign) => {
          if (detuneBucket) {
            const entry = { osc, sign };
            detuneBucket.oscillators.add(entry);
            registeredOscs.push(entry);
          }
        },
      },
    );

    if (sources.length === 0) {
      voiceEnvelopeGain.disconnect();
      onChainDone();
      return;
    }

    let remaining = sources.length;
    for (const src of sources) {
      this.activeNodes.add(src);
      src.onended = () => {
        this.activeNodes.delete(src);
        src.disconnect();
        remaining -= 1;
        if (remaining <= 0) {
          if (detuneBucket) {
            for (const entry of registeredOscs) {
              detuneBucket.oscillators.delete(entry);
            }
          }
          voiceEnvelopeGain.disconnect();
          onChainDone();
        }
      };
    }
  }

  private scheduleSample(
    event: ScheduledAudioEvent,
    buffer: AudioBuffer,
    volume: number,
    startAt: number,
    destination: AudioNode,
    onChainDone: () => void,
  ): void {
    const ctx = this.context;
    if (!ctx) return;

    const rate = event.sampleRate ?? 1;
    const offset = Math.max(0, Math.min(Math.max(0, buffer.duration - 0.05), event.sampleOffsetSec ?? 0));
    const maxAudioSec = Math.max(0.05, (buffer.duration - offset) / Math.max(0.1, rate));
    const playDurationSec = Math.min(event.durationSec, maxAudioSec);
    const level = volume <= 0 ? 0.0001 : Math.min(1.4, Math.max(0.05, volume * 2.1));

    const sampleGain = ctx.createGain();
    sampleGain.gain.setValueAtTime(0.0001, startAt);
    sampleGain.gain.linearRampToValueAtTime(level, startAt + 0.008);
    const fadeOutStart = Math.max(startAt + 0.01, startAt + playDurationSec - 0.015);
    sampleGain.gain.setValueAtTime(level, fadeOutStart);
    sampleGain.gain.linearRampToValueAtTime(0.0001, startAt + playDurationSec);
    sampleGain.connect(destination);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(rate, startAt);
    src.connect(sampleGain);
    src.start(startAt, offset, playDurationSec);

    this.trackSourceNode(src, [sampleGain], onChainDone);
  }

  private scheduleDrum(
    drum: DrumType,
    volume: number,
    startAt: number,
    destination: AudioNode,
    onChainDone: () => void,
  ): void {
    const ctx = this.context;
    if (!ctx) return;

    const level = volume <= 0 ? 0.0001 : Math.min(0.75, Math.max(0.08, volume * 1.6));
    const drumLevelGain = ctx.createGain();
    drumLevelGain.gain.setValueAtTime(level, startAt);
    drumLevelGain.connect(destination);

    const sources: AudioScheduledSourceNode[] = [];
    scheduleSynthesizedDrum(
      ctx,
      drum,
      drumLevelGain,
      startAt,
      this.noiseBufferCache,
      (src) => sources.push(src),
    );

    if (sources.length === 0) {
      drumLevelGain.disconnect();
      onChainDone();
      return;
    }

    let remaining = sources.length;
    for (const src of sources) {
      this.trackSourceNode(src, [], () => {
        remaining -= 1;
        if (remaining <= 0) {
          drumLevelGain.disconnect();
          onChainDone();
        }
      });
    }
  }

  private trackSourceNode(
    node: AudioScheduledSourceNode,
    extraNodes: AudioNode[],
    onDone?: () => void,
  ): void {
    this.activeNodes.add(node);
    node.onended = () => {
      this.activeNodes.delete(node);
      node.disconnect();
      for (const n of extraNodes) {
        n.disconnect();
      }
      onDone?.();
    };
  }
}
