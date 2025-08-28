/**
 * Hi-Hat Sintetizado
 */

import { BaseInstrument } from './base-instrument';
import type { InstrumentConfig } from '@/types/instruments';

export interface HiHatConfig extends InstrumentConfig {
  type: 'hihat';
  tone: number;
  decay: number;
  brightness: number;
  isOpen: boolean;
}

export class HiHat extends BaseInstrument {
  private hihatConfig: HiHatConfig;

  constructor(audioContext: AudioContext, config: Partial<HiHatConfig> = {}) {
    const defaultConfig: HiHatConfig = {
      type: 'hihat',
      volume: 0.6,
      tone: 8000,
      decay: 0.1,
      brightness: 0.8,
      isOpen: false,
      ...config
    };

    super(audioContext, defaultConfig);
    this.hihatConfig = defaultConfig;
  }

  playNote(
    frequency: number, 
    duration: number, 
    startTime: number, 
    velocity: number = 1
  ): void {
    const actualStartTime = this.audioContext.currentTime + startTime;
    
    // Múltiplos osciladores para simular o som metálico
    const oscCount = 6;
    const frequencies = [
      this.hihatConfig.tone,
      this.hihatConfig.tone * 1.4,
      this.hihatConfig.tone * 2.1,
      this.hihatConfig.tone * 3.2,
      this.hihatConfig.tone * 4.7,
      this.hihatConfig.tone * 6.3
    ];

    // Ruído para adicionar textura
    const noiseBuffer = this.createMetallicNoise();
    const noiseSource = this.audioContext.createBufferSource();
    const noiseGain = this.audioContext.createGain();

    // Filtro passa-altas para dar brilho
    const highpassFilter = this.createFilter({
      type: 'highpass',
      frequency: 6000,
      Q: 0.5
    });

    // Filtro passa-baixas para controlar brilho excessivo
    const lowpassFilter = this.createFilter({
      type: 'lowpass',
      frequency: 12000,
      Q: 1
    });

    // Configuração do ruído
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = false;

    // Roteamento do ruído
    noiseSource.connect(noiseGain);
    noiseGain.connect(highpassFilter);
    highpassFilter.connect(lowpassFilter);
    lowpassFilter.connect(this.masterGain);

    // Cria osciladores tonais
    frequencies.forEach((freq, index) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, actualStartTime);
      
      osc.connect(gain);
      gain.connect(lowpassFilter);
      
      // Envelope individual para cada oscilador
      const level = velocity * (0.15 / (index + 1)) * this.hihatConfig.brightness;
      gain.gain.setValueAtTime(0, actualStartTime);
      gain.gain.linearRampToValueAtTime(level, actualStartTime + 0.001);
      
      const decayTime = this.hihatConfig.isOpen ? 
        this.hihatConfig.decay * 3 : 
        this.hihatConfig.decay;
        
      gain.gain.exponentialRampToValueAtTime(0.001, actualStartTime + decayTime);
      
      osc.start(actualStartTime);
      osc.stop(actualStartTime + Math.min(duration, decayTime + 0.1));
    });

    // Envelope do ruído
    const noiseLevel = velocity * 0.8;
    noiseGain.gain.setValueAtTime(0, actualStartTime);
    noiseGain.gain.linearRampToValueAtTime(noiseLevel, actualStartTime + 0.001);
    
    const noiseDecay = this.hihatConfig.isOpen ? 
      this.hihatConfig.decay * 2 : 
      this.hihatConfig.decay * 0.5;
      
    noiseGain.gain.exponentialRampToValueAtTime(0.001, actualStartTime + noiseDecay);

    // Inicia ruído
    noiseSource.start(actualStartTime);
    noiseSource.stop(actualStartTime + Math.min(duration, noiseDecay + 0.05));
  }

  private createMetallicNoise(): AudioBuffer {
    const bufferSize = this.audioContext.sampleRate * 0.3;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    // Ruído filtrado para simular som metálico
    for (let i = 0; i < bufferSize; i++) {
      let sample = 0;
      
      // Múltiplas frequências de ruído
      for (let j = 0; j < 5; j++) {
        sample += (Math.random() * 2 - 1) * Math.pow(0.7, j);
      }
      
      output[i] = sample * 0.3;
    }
    
    return buffer;
  }

  /**
   * Toca hi-hat aberto
   */
  playOpen(duration: number, startTime: number, velocity: number = 1): void {
    const originalIsOpen = this.hihatConfig.isOpen;
    this.hihatConfig.isOpen = true;
    this.playNote(0, duration, startTime, velocity);
    this.hihatConfig.isOpen = originalIsOpen;
  }

  /**
   * Toca hi-hat fechado
   */
  playClosed(duration: number, startTime: number, velocity: number = 1): void {
    const originalIsOpen = this.hihatConfig.isOpen;
    this.hihatConfig.isOpen = false;
    this.playNote(0, duration, startTime, velocity);
    this.hihatConfig.isOpen = originalIsOpen;
  }

  stop(): void {
    // Hi-hats são percussivos e param naturalmente
  }
}