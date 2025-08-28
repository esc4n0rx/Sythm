/**
 * Exportações dos instrumentos Sythm
 */

export { BaseInstrument } from './base-instrument';
export { BassSynth, type BassSynthConfig } from './bass-synth';
export { KickDrum, type KickDrumConfig } from './kick-drum';
export { SnareDrum, type SnareDrumConfig } from './snare-drum';
export { HiHat, type HiHatConfig } from './hihat';
export { LeadSynth, type LeadSynthConfig } from './lead-synth';
export { PadSynth, type PadSynthConfig } from './pad-synth';

import { BaseInstrument } from './base-instrument';
import { BassSynth } from './bass-synth';
import { KickDrum } from './kick-drum';
import { SnareDrum } from './snare-drum';
import { HiHat } from './hihat';
import { LeadSynth } from './lead-synth';
import { PadSynth } from './pad-synth';
import type { InstrumentType, InstrumentConfig } from '@/types/instruments';

/**
 * Factory para criar instrumentos
 */
export class InstrumentFactory {
  static createInstrument(
    audioContext: AudioContext,
    type: InstrumentType,
    config: Partial<InstrumentConfig> = {}
  ): BaseInstrument {
    switch (type) {
      case 'bass':
        return new BassSynth(audioContext, config);
      case 'kick':
        return new KickDrum(audioContext, config);
      case 'snare':
        return new SnareDrum(audioContext, config);
      case 'hihat':
        return new HiHat(audioContext, config);
      case 'lead':
        return new LeadSynth(audioContext, config);
      case 'pad':
        return new PadSynth(audioContext, config);
      default:
        return new LeadSynth(audioContext, { ...config, type: 'default' });
    }
  }

  /**
   * Lista de instrumentos disponíveis
   */
  static getAvailableInstruments(): Array<{
    type: InstrumentType;
    name: string;
    description: string;
  }> {
    return [
      { type: 'default', name: 'Padrão', description: 'Som sintetizado padrão' },
      { type: 'bass', name: 'Bass', description: 'Sintetizador de baixo profundo' },
      { type: 'lead', name: 'Lead', description: 'Sintetizador lead para melodias' },
      { type: 'pad', name: 'Pad', description: 'Sons atmosféricos e texturas' },
      { type: 'kick', name: 'Kick', description: 'Bumbo sintetizado' },
      { type: 'snare', name: 'Snare', description: 'Caixa sintetizada' },
      { type: 'hihat', name: 'Hi-Hat', description: 'Chimbal sintetizado' },
    ];
  }
}