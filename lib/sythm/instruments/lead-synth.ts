/**
 * Lead Synthesizer
 */

import { BaseInstrument } from './base-instrument';
import type { InstrumentConfig, EnvelopeParams } from '@/types/instruments';

export interface LeadSynthConfig extends InstrumentConfig {
  type: 'lead';
  oscillatorType: OscillatorType;
  filterCutoff: number;
  filterResonance: number;
  portamento: number;
  vibrato: number;
}

export class LeadSynth extends BaseInstrument {
  private activeOscillators: Set<OscillatorNode> = new Set();
  private leadConfig: LeadSynthConfig;
  private lastFrequency: number = 440;

  constructor(audioContext: AudioContext, config: Partial<LeadSynthConfig> = {}) {
    const defaultConfig: LeadSynthConfig = {
      type: 'lead',
      volume: 0.6,
      oscillatorType: 'sawtooth',
      filterCutoff: 2000,
      filterResonance: 5,
      portamento: 0.1,
      vibrato: 0.02,
      ...config
    };

    super(audioContext, defaultConfig);
    this.leadConfig = defaultConfig;
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
    
    // LFO para vibrato
    const vibratoLFO = this.audioContext.createOscillator();
    const vibratoGain = this.audioContext.createGain();
    
    // Filtro passa-baixas resonante
    const filter = this.createFilter({
      type: 'lowpass',
      frequency: this.leadConfig.filterCutoff,
      Q: this.leadConfig.filterResonance
    });

    // Configuração do oscilador principal
    mainOsc.type = this.leadConfig.oscillatorType;
    
    // Portamento (glide entre notas)
    if (this.leadConfig.portamento > 0) {
      mainOsc.frequency.setValueAtTime(this.lastFrequency, actualStartTime);
      mainOsc.frequency.exponentialRampToValueAtTime(
        frequency, 
        actualStartTime + this.leadConfig.portamento
      );
    } else {
      mainOsc.frequency.setValueAtTime(frequency, actualStartTime);
    }
    
    this.lastFrequency = frequency;

    // Configuração do vibrato
    vibratoLFO.type = 'sine';
    vibratoLFO.frequency.setValueAtTime(5, actualStartTime); // 5 Hz de vibrato
    vibratoGain.gain.setValueAtTime(frequency * this.leadConfig.vibrato, actualStartTime);

    // Roteamento de áudio
    vibratoLFO.connect(vibratoGain);
    vibratoGain.connect(mainOsc.frequency);
    
    mainOsc.connect(mainGain);
    mainGain.connect(filter);
    filter.connect(this.masterGain);

    // Envelope principal (lead synth needs punch)
    const envelope: EnvelopeParams = {
      attack: 0.05,
      decay: 0.2,
      sustain: 0.7,
      release: 0.3
    };

    this.createEnvelope(mainGain, actualStartTime, duration, envelope, velocity);

    // Modulação do filtro (filter sweep)
    const filterStart = this.leadConfig.filterCutoff * 0.3;
    const filterPeak = this.leadConfig.filterCutoff * 1.5;
    
    filter.frequency.setValueAtTime(filterStart, actualStartTime);
    filter.frequency.exponentialRampToValueAtTime(
      filterPeak, 
      actualStartTime + envelope.attack + envelope.decay
    );
    filter.frequency.exponentialRampToValueAtTime(
      this.leadConfig.filterCutoff, 
      actualStartTime + duration - envelope.release
    );

    // Inicia osciladores
    mainOsc.start(actualStartTime);
    vibratoLFO.start(actualStartTime);
    
    // Para osciladores
    mainOsc.stop(actualStartTime + duration);
    vibratoLFO.stop(actualStartTime + duration);

    // Controle de osciladores ativos
    this.activeOscillators.add(mainOsc);
    this.activeOscillators.add(vibratoLFO);

    mainOsc.onended = () => {
      this.activeOscillators.delete(mainOsc);
      this.activeOscillators.delete(vibratoLFO);
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