/**
 * Kick Drum Sintetizado
 */

import { BaseInstrument } from './base-instrument';
import type { InstrumentConfig } from '@/types/instruments';

export interface KickDrumConfig extends InstrumentConfig {
  type: 'kick';
  frequency: number;
  pitchDecay: number;
  bodyResonance: number;
  clickAmount: number;
}

export class KickDrum extends BaseInstrument {
  private kickConfig: KickDrumConfig;

  constructor(audioContext: AudioContext, config: Partial<KickDrumConfig> = {}) {
    const defaultConfig: KickDrumConfig = {
      type: 'kick',
      volume: 0.9,
      frequency: 60,
      pitchDecay: 0.05,
      bodyResonance: 0.3,
      clickAmount: 0.4,
      ...config
    };

    super(audioContext, defaultConfig);
    this.kickConfig = defaultConfig;
  }

  playNote(
    frequency: number, 
    duration: number, 
    startTime: number, 
    velocity: number = 1
  ): void {
    const actualStartTime = this.audioContext.currentTime + startTime;
    
    // Oscilador principal (corpo do kick)
    const bodyOsc = this.audioContext.createOscillator();
    const bodyGain = this.audioContext.createGain();
    
    // Oscilador para o "click" do kick
    const clickOsc = this.audioContext.createOscillator();
    const clickGain = this.audioContext.createGain();
    
    // Filtros
    const bodyFilter = this.createFilter({
      type: 'lowpass',
      frequency: 100,
      Q: this.kickConfig.bodyResonance
    });
    
    const clickFilter = this.createFilter({
      type: 'highpass',
      frequency: 1000,
      Q: 1
    });

    // Configuração do corpo do kick
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(this.kickConfig.frequency, actualStartTime);
    
    // Pitch envelope (frequência cai rapidamente)
    bodyOsc.frequency.exponentialRampToValueAtTime(
      this.kickConfig.frequency * 0.3, 
      actualStartTime + this.kickConfig.pitchDecay
    );

    // Configuração do click
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(2000, actualStartTime);
    clickOsc.frequency.exponentialRampToValueAtTime(500, actualStartTime + 0.01);

    // Roteamento
    bodyOsc.connect(bodyGain);
    bodyGain.connect(bodyFilter);
    bodyFilter.connect(this.masterGain);
    
    clickOsc.connect(clickGain);
    clickGain.connect(clickFilter);
    clickFilter.connect(this.masterGain);

    // Envelope do corpo (longo e punchy)
    bodyGain.gain.setValueAtTime(0, actualStartTime);
    bodyGain.gain.linearRampToValueAtTime(velocity * 1.2, actualStartTime + 0.001);
    bodyGain.gain.exponentialRampToValueAtTime(velocity * 0.8, actualStartTime + 0.05);
    bodyGain.gain.exponentialRampToValueAtTime(velocity * 0.3, actualStartTime + 0.2);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, actualStartTime + Math.min(duration, 0.6));

    // Envelope do click (muito curto e percussivo)
    const clickLevel = velocity * this.kickConfig.clickAmount;
    clickGain.gain.setValueAtTime(0, actualStartTime);
    clickGain.gain.linearRampToValueAtTime(clickLevel, actualStartTime + 0.001);
    clickGain.gain.exponentialRampToValueAtTime(0.001, actualStartTime + 0.02);

    // Inicia e para
    const kickDuration = Math.min(duration, 0.8);
    bodyOsc.start(actualStartTime);
    clickOsc.start(actualStartTime);
    bodyOsc.stop(actualStartTime + kickDuration);
    clickOsc.stop(actualStartTime + 0.05);
  }

  stop(): void {
    // Kick drums são percussivos e param naturalmente
  }
}