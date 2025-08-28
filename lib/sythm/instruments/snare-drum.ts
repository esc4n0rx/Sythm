/**
 * Snare Drum Sintetizado
 */

import { BaseInstrument } from './base-instrument';
import type { InstrumentConfig } from '@/types/instruments';

export interface SnareDrumConfig extends InstrumentConfig {
  type: 'snare';
  fundamentalFreq: number;
  noiseLevel: number;
  snappiness: number;
  tone: number;
}

export class SnareDrum extends BaseInstrument {
  private snareConfig: SnareDrumConfig;

  constructor(audioContext: AudioContext, config: Partial<SnareDrumConfig> = {}) {
    const defaultConfig: SnareDrumConfig = {
      type: 'snare',
      volume: 0.8,
      fundamentalFreq: 200,
      noiseLevel: 0.7,
      snappiness: 0.8,
      tone: 3000,
      ...config
    };

    super(audioContext, defaultConfig);
    this.snareConfig = defaultConfig;
  }

  playNote(
    frequency: number, 
    duration: number, 
    startTime: number, 
    velocity: number = 1
  ): void {
    const actualStartTime = this.audioContext.currentTime + startTime;
    
    // Componente tonal (corpo do snare)
    const tonalOsc = this.audioContext.createOscillator();
    const tonalGain = this.audioContext.createGain();
    
    // Componente de ruído (estalo do snare)
    const noiseBuffer = this.createNoiseBuffer();
    const noiseSource = this.audioContext.createBufferSource();
    const noiseGain = this.audioContext.createGain();
    
    // Filtros
    const tonalFilter = this.createFilter({
      type: 'bandpass',
      frequency: this.snareConfig.fundamentalFreq,
      Q: 2
    });
    
    const noiseFilter = this.createFilter({
      type: 'highpass',
      frequency: this.snareConfig.tone,
      Q: 1
    });

    // Configuração tonal
    tonalOsc.type = 'triangle';
    tonalOsc.frequency.setValueAtTime(this.snareConfig.fundamentalFreq, actualStartTime);
    
    // Pitch bend no tonal
    tonalOsc.frequency.exponentialRampToValueAtTime(
      this.snareConfig.fundamentalFreq * 0.7, 
      actualStartTime + 0.05
    );

    // Configuração do ruído
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = false;

    // Roteamento
    tonalOsc.connect(tonalGain);
    tonalGain.connect(tonalFilter);
    tonalFilter.connect(this.masterGain);
    
    noiseSource.connect(noiseGain);
    noiseGain.connect(noiseFilter);
    noiseFilter.connect(this.masterGain);

    // Envelope tonal
    const tonalLevel = velocity * (1 - this.snareConfig.noiseLevel);
    tonalGain.gain.setValueAtTime(0, actualStartTime);
    tonalGain.gain.linearRampToValueAtTime(tonalLevel * 0.8, actualStartTime + 0.001);
    tonalGain.gain.exponentialRampToValueAtTime(tonalLevel * 0.3, actualStartTime + 0.02);
    tonalGain.gain.exponentialRampToValueAtTime(0.001, actualStartTime + Math.min(duration, 0.2));

    // Envelope do ruído (mais curto e snappy)
    const noiseLevel = velocity * this.snareConfig.noiseLevel * this.snareConfig.snappiness;
    noiseGain.gain.setValueAtTime(0, actualStartTime);
    noiseGain.gain.linearRampToValueAtTime(noiseLevel, actualStartTime + 0.001);
    noiseGain.gain.exponentialRampToValueAtTime(noiseLevel * 0.5, actualStartTime + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, actualStartTime + 0.08);

    // Inicia e para
    const snareDuration = Math.min(duration, 0.3);
    tonalOsc.start(actualStartTime);
    noiseSource.start(actualStartTime);
    tonalOsc.stop(actualStartTime + snareDuration);
    noiseSource.stop(actualStartTime + 0.15);
  }

  private createNoiseBuffer(): AudioBuffer {
    const bufferSize = this.audioContext.sampleRate * 0.2; // 200ms de ruído
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1; // Ruído branco
    }
    
    return buffer;
  }

  stop(): void {
    // Snare drums são percussivos e param naturalmente
  }
}