/**
 * Classe base para todos os instrumentos Sythm
 */

import type { EnvelopeParams, FilterParams, InstrumentConfig } from '@/types/instruments';

export abstract class BaseInstrument {
  getState() {
    throw new Error('Method not implemented.');
  }
  protected audioContext: AudioContext;
  protected config: InstrumentConfig;
  protected masterGain: GainNode;
  dispose: any;

  constructor(audioContext: AudioContext, config: InstrumentConfig) {
    this.audioContext = audioContext;
    this.config = config;
    this.masterGain = audioContext.createGain();
    this.masterGain.connect(audioContext.destination);
    this.masterGain.gain.setValueAtTime(config.volume, audioContext.currentTime);
  }

  /**
   * Toca uma nota com o instrumento
   */
  abstract playNote(
    frequency: number, 
    duration: number, 
    startTime: number, 
    velocity?: number
  ): void;

  /**
   * Toca múltiplas notas (acorde)
   */
  playChord(
    frequencies: number[], 
    duration: number, 
    startTime: number, 
    velocity: number = 1
  ): void {
    frequencies.forEach(freq => {
      this.playNote(freq, duration, startTime, velocity / Math.sqrt(frequencies.length));
    });
  }

  /**
   * Cria envelope ADSR
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
    
    // Attack
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    
    // Decay
    gainNode.gain.linearRampToValueAtTime(
      peakGain * sustain, 
      startTime + attack + decay
    );
    
    // Sustain
    gainNode.gain.setValueAtTime(peakGain * sustain, releaseStartTime);
    
    // Release
    gainNode.gain.linearRampToValueAtTime(0, releaseStartTime + release);
  }

  /**
   * Cria filtro
   */
  protected createFilter(params: FilterParams): BiquadFilterNode {
    const filter = this.audioContext.createBiquadFilter();
    filter.type = params.type;
    filter.frequency.setValueAtTime(params.frequency, this.audioContext.currentTime);
    filter.Q.setValueAtTime(params.Q, this.audioContext.currentTime);
    return filter;
  }

  /**
   * Para todas as notas em reprodução
   */
  stop(): void {
    // Implementação específica em cada instrumento
  }

  /**
   * Atualiza configurações
   */
  updateConfig(newConfig: Partial<InstrumentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.masterGain.gain.setValueAtTime(
      this.config.volume, 
      this.audioContext.currentTime
    );
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): InstrumentConfig {
    return { ...this.config };
  }
}