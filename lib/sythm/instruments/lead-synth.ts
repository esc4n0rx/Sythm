/**
 * Lead Synthesizer - Versão Otimizada com Som Fino e Natural
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
  brightness: number;
}

export class LeadSynth extends BaseInstrument {
  private activeOscillators: Set<OscillatorNode> = new Set();
  private leadConfig: LeadSynthConfig;
  private lastFrequency: number = 440;

  constructor(audioContext: AudioContext, config: Partial<LeadSynthConfig> = {}) {
    const defaultConfig: LeadSynthConfig = {
      type: 'lead',
      volume: 0.4,
      oscillatorType: 'triangle', // Mudança para triangle - som mais fino
      filterCutoff: 3000,
      filterResonance: 2, // Reduzido para som mais natural
      portamento: 0.02, // Reduzido para resposta mais rápida
      vibrato: 0.008, // Reduzido para vibrato mais sutil
      brightness: 0.3, // Nova propriedade para controlar brilho
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
    
    // Oscilador principal - triangle para som mais fino
    const mainOsc = this.audioContext.createOscillator();
    const mainGain = this.audioContext.createGain();
    
    // LFO para vibrato suave
    const vibratoLFO = this.audioContext.createOscillator();
    const vibratoGain = this.audioContext.createGain();
    
    // Filtro passa-alta para deixar o som mais fino
    const highpassFilter = this.audioContext.createBiquadFilter();
    highpassFilter.type = 'highpass';
    highpassFilter.frequency.setValueAtTime(200, actualStartTime);
    highpassFilter.Q.setValueAtTime(0.7, actualStartTime);
    
    // Filtro passa-baixas para controle de brilho
    const lowpassFilter = this.audioContext.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.frequency.setValueAtTime(this.leadConfig.filterCutoff, actualStartTime);
    lowpassFilter.Q.setValueAtTime(this.leadConfig.filterResonance, actualStartTime);

    // Configuração do oscilador principal
    mainOsc.type = this.leadConfig.oscillatorType;
    
    // Portamento suave (glide entre notas)
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

    // Configuração do vibrato muito sutil
    vibratoLFO.type = 'sine';
    vibratoLFO.frequency.setValueAtTime(4.5, actualStartTime); // 4.5 Hz - vibrato natural
    vibratoGain.gain.setValueAtTime(frequency * this.leadConfig.vibrato, actualStartTime);

    // Roteamento de áudio: Osc -> Filtros -> Gain -> Output
    vibratoLFO.connect(vibratoGain);
    vibratoGain.connect(mainOsc.frequency);
    
    mainOsc.connect(highpassFilter);
    highpassFilter.connect(lowpassFilter);
    lowpassFilter.connect(mainGain);
    mainGain.connect(this.masterGain);

    // Envelope ADSR otimizado para lead - ataque rápido, sustain controlado
    const envelope: EnvelopeParams = {
      attack: 0.01,   // Ataque muito rápido - sem clique
      decay: 0.15,    // Decay curto
      sustain: 0.6,   // Sustain moderado - não fica "barrigudo"
      release: 0.2    // Release curto - não corta seco
    };

    this.createEnvelope(mainGain, actualStartTime, duration, envelope, velocity * this.leadConfig.volume);

    // Modulação sutil do filtro para adicionar movimento
    const filterModStart = this.leadConfig.filterCutoff * 0.8;
    const filterModPeak = this.leadConfig.filterCutoff * (1 + this.leadConfig.brightness);
    
    lowpassFilter.frequency.setValueAtTime(filterModStart, actualStartTime);
    lowpassFilter.frequency.exponentialRampToValueAtTime(
      filterModPeak, 
      actualStartTime + envelope.attack + envelope.decay * 0.5
    );
    lowpassFilter.frequency.exponentialRampToValueAtTime(
      this.leadConfig.filterCutoff, 
      actualStartTime + duration - envelope.release
    );

    // Inicia osciladores
    mainOsc.start(actualStartTime);
    vibratoLFO.start(actualStartTime);
    
    // Para osciladores
    const stopTime = actualStartTime + duration + envelope.release;
    mainOsc.stop(stopTime);
    vibratoLFO.stop(stopTime);

    // Controle de osciladores ativos
    this.activeOscillators.add(mainOsc);
    this.activeOscillators.add(vibratoLFO);

    mainOsc.onended = () => {
      this.activeOscillators.delete(mainOsc);
      this.activeOscillators.delete(vibratoLFO);
    };
  }

  /**
   * Método para criar envelope ADSR mais suave
   */
  protected createEnvelope(
    gainNode: GainNode, 
    startTime: number, 
    duration: number, 
    envelope: EnvelopeParams, 
    peakGain: number = 1
  ): void {
    const { attack, decay, sustain, release } = envelope;
    const releaseStartTime = startTime + Math.max(0, duration - release);
    
    // Attack - curva exponencial suave
    gainNode.gain.setValueAtTime(0.001, startTime); // Evita clique inicial
    gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + attack);
    
    // Decay - curva exponencial
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(0.001, peakGain * sustain), 
      startTime + attack + decay
    );
    
    // Sustain
    gainNode.gain.setValueAtTime(
      Math.max(0.001, peakGain * sustain), 
      releaseStartTime
    );
    
    // Release - curva exponencial suave
    gainNode.gain.exponentialRampToValueAtTime(0.001, releaseStartTime + release);
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

  /**
   * Atualiza configurações específicas do lead synth
   */
  updateLeadConfig(newConfig: Partial<LeadSynthConfig>): void {
    this.leadConfig = { ...this.leadConfig, ...newConfig };
    this.updateConfig(newConfig);
  }

  /**
   * Obtém configuração específica do lead synth
   */
  getLeadConfig(): LeadSynthConfig {
    return { ...this.leadConfig };
  }
}