/**
 * Sintetizador de Baixo
 */

import { BaseInstrument } from './base-instrument';
import type { InstrumentConfig, EnvelopeParams } from '@/types/instruments';

export interface BassSynthConfig extends InstrumentConfig {
  type: 'bass';
  oscillatorType: OscillatorType;
  filterCutoff: number;
  filterResonance: number;
  subOscillatorLevel: number;
  distortion: number;
}

export class BassSynth extends BaseInstrument {
  private activeOscillators: Set<OscillatorNode> = new Set();
  private bassConfig: BassSynthConfig;

  constructor(audioContext: AudioContext, config: Partial<BassSynthConfig> = {}) {
    const defaultConfig: BassSynthConfig = {
      type: 'bass',
      volume: 0.7,
      oscillatorType: 'sawtooth',
      filterCutoff: 800,
      filterResonance: 8,
      subOscillatorLevel: 0.3,
      distortion: 0.2,
      ...config
    };

    super(audioContext, defaultConfig);
    this.bassConfig = defaultConfig;
  }

  playNote(
    frequency: number, 
    duration: number, 
    startTime: number, 
    velocity: number = 1
  ): void {
    const actualStartTime = this.audioContext.currentTime + startTime;
    
    // Oscilador principal
    const mainOsc = this.audioContext.createOscillator();
    const mainGain = this.audioContext.createGain();
    
    // Sub-oscilador (uma oitava abaixo)
    const subOsc = this.audioContext.createOscillator();
    const subGain = this.audioContext.createGain();
    
    // Filtro passa-baixas
    const filter = this.createFilter({
      type: 'lowpass',
      frequency: this.bassConfig.filterCutoff,
      Q: this.bassConfig.filterResonance
    });

    // Distorção suave
    const waveshaper = this.audioContext.createWaveShaper();
    waveshaper.curve = this.createDistortionCurve(this.bassConfig.distortion);

    // Configuração dos osciladores
    mainOsc.type = this.bassConfig.oscillatorType;
    mainOsc.frequency.setValueAtTime(frequency, actualStartTime);
    
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(frequency / 2, actualStartTime); // Uma oitava abaixo
    
    // Roteamento de áudio
    mainOsc.connect(mainGain);
    subOsc.connect(subGain);
    
    mainGain.connect(waveshaper);
    subGain.connect(waveshaper);
    waveshaper.connect(filter);
    filter.connect(this.masterGain);

    // Envelope principal
    const envelope: EnvelopeParams = {
      attack: 0.02,
      decay: 0.3,
      sustain: 0.6,
      release: 0.4
    };

    this.createEnvelope(mainGain, actualStartTime, duration, envelope, velocity * 0.8);
    this.createEnvelope(
      subGain, 
      actualStartTime, 
      duration, 
      envelope, 
      velocity * this.bassConfig.subOscillatorLevel
    );

    // Modulação do filtro
    filter.frequency.setValueAtTime(this.bassConfig.filterCutoff * 0.5, actualStartTime);
    filter.frequency.exponentialRampToValueAtTime(
      this.bassConfig.filterCutoff, 
      actualStartTime + envelope.attack + envelope.decay
    );

    // Inicia e para osciladores
    mainOsc.start(actualStartTime);
    subOsc.start(actualStartTime);
    mainOsc.stop(actualStartTime + duration);
    subOsc.stop(actualStartTime + duration);

    // Controle de osciladores ativos
    this.activeOscillators.add(mainOsc);
    this.activeOscillators.add(subOsc);

    mainOsc.onended = () => {
      this.activeOscillators.delete(mainOsc);
      this.activeOscillators.delete(subOsc);
    };
  }

  private createDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    return curve;
  }

  stop(): void {
    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // Ignora se já foi parado
      }
    });
    this.activeOscillators.clear();
  }
}