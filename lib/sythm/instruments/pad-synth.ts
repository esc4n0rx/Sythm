/**
 * Pad Synthesizer (Atmospheric sounds)
 */

import { BaseInstrument } from './base-instrument';
import type { InstrumentConfig, EnvelopeParams } from '@/types/instruments';

export interface PadSynthConfig extends InstrumentConfig {
  type: 'pad';
  detuneAmount: number;
  chorusDepth: number;
  filterCutoff: number;
  reverb: number;
}

export class PadSynth extends BaseInstrument {
  private activeOscillators: Set<OscillatorNode> = new Set();
  private padConfig: PadSynthConfig;

  constructor(audioContext: AudioContext, config: Partial<PadSynthConfig> = {}) {
    const defaultConfig: PadSynthConfig = {
      type: 'pad',
      volume: 0.4,
      detuneAmount: 15,
      chorusDepth: 0.3,
      filterCutoff: 1200,
      reverb: 0.6,
      ...config
    };

    super(audioContext, defaultConfig);
    this.padConfig = defaultConfig;
  }

  playNote(
    frequency: number, 
    duration: number, 
    startTime: number, 
    velocity: number = 1
  ): void {
    const actualStartTime = this.audioContext.currentTime + startTime;
    
    // Múltiplos osciladores levemente desafinados para textura
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    
    const oscTypes: OscillatorType[] = ['sine', 'triangle', 'sawtooth'];
    const detunes = [0, this.padConfig.detuneAmount, -this.padConfig.detuneAmount];
    
    // Filtro suave
    const filter = this.createFilter({
      type: 'lowpass',
      frequency: this.padConfig.filterCutoff,
      Q: 0.5
    });

    // LFO para chorus
    const chorusLFO = this.audioContext.createOscillator();
    const chorusGain = this.audioContext.createGain();
    const chorusDelay = this.audioContext.createDelay(0.1);
    
    chorusLFO.type = 'triangle';
    chorusLFO.frequency.setValueAtTime(0.3, actualStartTime);
    chorusGain.gain.setValueAtTime(0.01, actualStartTime);
    chorusDelay.delayTime.setValueAtTime(0.02, actualStartTime);
    
    // Conecta o LFO ao delay para criar chorus
    chorusLFO.connect(chorusGain);
    chorusGain.connect(chorusDelay.delayTime);

    // Cria e configura múltiplos osciladores
    for (let i = 0; i < 3; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.type = oscTypes[i];
      osc.frequency.setValueAtTime(frequency, actualStartTime);
      osc.detune.setValueAtTime(detunes[i], actualStartTime);
      
      // Roteamento com chorus
      osc.connect(gain);
      gain.connect(filter);
      
      // Sinal direto
      filter.connect(this.masterGain);
      
      // Sinal com chorus
      if (i === 0) { // Apenas o primeiro oscilador vai para o chorus
        gain.connect(chorusDelay);
        chorusDelay.connect(this.masterGain);
      }
      
      oscillators.push(osc);
      gains.push(gain);
    }

    // Envelope muito suave para pads
    const envelope: EnvelopeParams = {
      attack: 1.0,   // Attack longo
      decay: 0.5,
      sustain: 0.8,
      release: 2.0   // Release longo
    };

    // Aplica envelope a cada oscilador com níveis diferentes
    gains.forEach((gain, index) => {
      const level = velocity * (0.4 / (index + 1));
      this.createEnvelope(gain, actualStartTime, duration, envelope, level);
    });

    // Modulação suave do filtro
    const modulationLFO = this.audioContext.createOscillator();
    const modulationGain = this.audioContext.createGain();
    
    modulationLFO.type = 'sine';
    modulationLFO.frequency.setValueAtTime(0.1, actualStartTime);
    modulationGain.gain.setValueAtTime(100, actualStartTime);
    
    modulationLFO.connect(modulationGain);
    modulationGain.connect(filter.frequency);

    // Inicia todos os osciladores
    oscillators.forEach(osc => {
      osc.start(actualStartTime);
      osc.stop(actualStartTime + duration + envelope.release);
      this.activeOscillators.add(osc);
    });
    
    chorusLFO.start(actualStartTime);
    chorusLFO.stop(actualStartTime + duration + envelope.release);
    
    modulationLFO.start(actualStartTime);
    modulationLFO.stop(actualStartTime + duration + envelope.release);
    
    this.activeOscillators.add(chorusLFO);
    this.activeOscillators.add(modulationLFO);

    // Cleanup
    oscillators[0].onended = () => {
      oscillators.forEach(osc => this.activeOscillators.delete(osc));
      this.activeOscillators.delete(chorusLFO);
      this.activeOscillators.delete(modulationLFO);
    };
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