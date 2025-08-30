/**
 * Motor de áudio para execução de música Sythm com suporte multitrack
 */

import { getNoteFrequency } from './note-frequencies';
import { InstrumentFactory } from './instruments';
import { BaseInstrument } from './instruments/base-instrument';
import type { InstrumentType } from '@/types/instruments';

export interface AudioConfig {
  baseBeatsPerMinute: number;
  baseNoteDuration: number; // duração padrão em beats
  waveType: OscillatorType;
  masterVolume: number;
}

export class SythmAudioEngine {
  private audioContext: AudioContext | null = null;
  private config: AudioConfig;
  private timeModifier: number = 1; // 1 = normal, 0.5 = slow, 1.5 = fast
  private scheduledNodes: Set<AudioNode> = new Set();
  
  // Sistema de instrumentos
  private instruments: Map<InstrumentType, BaseInstrument> = new Map();
  private currentInstrument: InstrumentType = 'default';

  constructor(config: Partial<AudioConfig> = {}) {
    this.config = {
      baseBeatsPerMinute: 120,
      baseNoteDuration: 1,
      waveType: 'sine',
      masterVolume: 0.3,
      ...config
    };
  }

  /**
   * Inicializa o contexto de áudio
   */
  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context se estiver suspenso (requisito de alguns navegadores)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Inicializa instrumentos padrão
      this.initializeInstruments();
    }
  }

  /**
   * Inicializa todos os instrumentos disponíveis
   */
  private initializeInstruments(): void {
    if (!this.audioContext) return;

    const instrumentTypes: InstrumentType[] = [
      'default', 'bass', 'kick', 'snare', 'hihat', 'lead', 'pad'
    ];

    instrumentTypes.forEach(type => {
      const instrument = InstrumentFactory.createInstrument(
        this.audioContext!,
        type,
        { volume: this.config.masterVolume }
      );
      this.instruments.set(type, instrument);
    });
  }

  /**
   * Seleciona o instrumento atual
   */
  setCurrentInstrument(instrumentType: InstrumentType): void {
    this.currentInstrument = instrumentType;
  }

  /**
   * Obtém o instrumento atual
   */
  getCurrentInstrument(): BaseInstrument | null {
    return this.instruments.get(this.currentInstrument) || null;
  }

  /**
   * Toca uma nota usando o sistema de instrumentos
   */
  playNote(note: string, duration: number = this.config.baseNoteDuration, startTime: number = 0): void {
    try {
      const frequency = getNoteFrequency(note);
      const actualDuration = this.calculateActualDuration(duration);
      const actualStartTime = this.audioContext!.currentTime + startTime;

      const instrument = this.instruments.get(this.currentInstrument);
      if (instrument) {
        instrument.playNote(frequency, actualDuration, actualStartTime);
      } else {
        // Fallback para sistema legado
        this.playNoteLegacy(note, duration, startTime);
      }

    } catch (error) {
      console.error(`Error playing note ${note}:`, error);
    }
  }

  /**
   * Toca um acorde usando o sistema de instrumentos
   */
  playChord(notes: string[], duration: number = this.config.baseNoteDuration, startTime: number = 0): void {
    try {
      const frequencies = notes.map(note => getNoteFrequency(note));
      const actualDuration = this.calculateActualDuration(duration);
      const actualStartTime = this.audioContext!.currentTime + startTime;

      const instrument = this.instruments.get(this.currentInstrument);
      if (instrument) {
        instrument.playChord(frequencies, actualDuration, actualStartTime);
      } else {
        // Fallback para sistema legado
        this.playChordLegacy(notes, duration, startTime);
      }

    } catch (error) {
      console.error(`Error playing chord:`, error);
    }
  }

  /**
   * Sistema legado de tocar nota (mantido para compatibilidade)
   */
  private playNoteLegacy(note: string, duration: number = this.config.baseNoteDuration, startTime: number = 0): void {
    try {
      const frequency = getNoteFrequency(note);
      const actualDuration = this.calculateActualDuration(duration);
      const actualStartTime = this.audioContext!.currentTime + startTime;

      // Cria oscilador
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      // Conecta os nós
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      // Configura o oscilador
      oscillator.frequency.setValueAtTime(frequency, actualStartTime);
      oscillator.type = this.config.waveType;

      // Configura envelope ADSR simples
      const attackTime = 0.01;
      const decayTime = 0.1;
      const sustainLevel = 0.7;
      const releaseTime = 0.1;

      // Attack
      gainNode.gain.setValueAtTime(0, actualStartTime);
      gainNode.gain.linearRampToValueAtTime(
        this.config.masterVolume, 
        actualStartTime + attackTime
      );

      // Decay
      gainNode.gain.linearRampToValueAtTime(
        this.config.masterVolume * sustainLevel, 
        actualStartTime + attackTime + decayTime
      );

      // Sustain (mantém o nível)
      const releaseStartTime = actualStartTime + actualDuration - releaseTime;
      gainNode.gain.setValueAtTime(
        this.config.masterVolume * sustainLevel, 
        releaseStartTime
      );

      // Release
      gainNode.gain.linearRampToValueAtTime(
        0, 
        releaseStartTime + releaseTime
      );

      // Agenda início e fim
      oscillator.start(actualStartTime);
      oscillator.stop(actualStartTime + actualDuration);

      // Registra nó para controle
      this.scheduledNodes.add(oscillator);

      // Remove nó do conjunto após execução
      oscillator.onended = () => {
        this.scheduledNodes.delete(oscillator);
      };

    } catch (error) {
      console.error(`Error playing note ${note}:`, error);
    }
  }

  /**
   * Sistema legado de tocar acordes (mantido para compatibilidade)
   */
  private playChordLegacy(notes: string[], duration: number = this.config.baseNoteDuration, startTime: number = 0): void {
    try {
      const actualDuration = this.calculateActualDuration(duration);
      const actualStartTime = this.audioContext!.currentTime + startTime;

      // Master gain para o acorde
      const masterGain = this.audioContext!.createGain();
      masterGain.connect(this.audioContext!.destination);
      masterGain.gain.setValueAtTime(this.config.masterVolume / Math.sqrt(notes.length), actualStartTime);

      // Cria um oscilador para cada nota
      notes.forEach((note, index) => {
        try {
          const frequency = getNoteFrequency(note);
          
          const oscillator = this.audioContext!.createOscillator();
          const gainNode = this.audioContext!.createGain();

          // Conecta os nós
          oscillator.connect(gainNode);
          gainNode.connect(masterGain);

          // Configura o oscilador
          oscillator.frequency.setValueAtTime(frequency, actualStartTime);
          oscillator.type = this.config.waveType;

          // Envelope ADSR
          const attackTime = 0.01;
          const decayTime = 0.1;
          const sustainLevel = 0.7;
          const releaseTime = 0.1;

          gainNode.gain.setValueAtTime(0, actualStartTime);
          gainNode.gain.linearRampToValueAtTime(1, actualStartTime + attackTime);
          gainNode.gain.linearRampToValueAtTime(sustainLevel, actualStartTime + attackTime + decayTime);

          const releaseStartTime = actualStartTime + actualDuration - releaseTime;
          gainNode.gain.setValueAtTime(sustainLevel, releaseStartTime);
          gainNode.gain.linearRampToValueAtTime(0, releaseStartTime + releaseTime);

          oscillator.start(actualStartTime);
          oscillator.stop(actualStartTime + actualDuration);

          this.scheduledNodes.add(oscillator);
          this.scheduledNodes.add(gainNode);

          // Remove nós do conjunto após execução
          oscillator.onended = () => {
            this.scheduledNodes.delete(oscillator);
            this.scheduledNodes.delete(gainNode);
          };

        } catch (error) {
          console.error(`Error playing note ${note} in chord:`, error);
        }
      });

      // Registra o nó master gain
      this.scheduledNodes.add(masterGain);

      // Remove o master gain após a execução
      setTimeout(() => {
        this.scheduledNodes.delete(masterGain);
      }, (actualDuration + 0.2) * 1000);

    } catch (error) {
      console.error(`Error playing chord:`, error);
    }
  }

  /**
   * Para todos os sons ativos
   */
  stop(): void {
    this.scheduledNodes.forEach(node => {
      try {
        if ('stop' in node && typeof node.stop === 'function') {
          (node as OscillatorNode).stop();
        }
      } catch (error) {
        // Ignora erros de nós já parados
      }
    });
    
    this.scheduledNodes.clear();

    // Para instrumentos
    this.instruments.forEach(instrument => {
      if (instrument.stop) {
        instrument.stop();
      }
    });
  }

  /**
   * Cria uma pausa
   */
  playRest(duration: number = this.config.baseNoteDuration): void {
    // Rest é implementado como silêncio - não faz nada
    // A duração é calculada pelo interpretador
  }

  /**
   * Modifica o tempo para mais lento
   */
  setSlow(): void {
    this.timeModifier = 0.5; // 50% mais lento
  }

  /**
   * Modifica o tempo para mais rápido
   */
  setFast(): void {
    this.timeModifier = 1.5; // 50% mais rápido
  }

  /**
   * Reseta o tempo para normal
   */
  setNormalSpeed(): void {
    this.timeModifier = 1;
  }

  /**
   * Calcula a duração real baseada no tempo atual e modificadores
   */
  private calculateActualDuration(beats: number): number {
    const secondsPerBeat = 60 / this.config.baseBeatsPerMinute;
    return (beats * secondsPerBeat) / this.timeModifier;
  }

  /**
   * Obtém a duração de uma batida em segundos (considerando modificadores)
   */
  getBeatDuration(): number {
    return this.calculateActualDuration(1);
  }

  /**
   * Atualiza configurações
   */
  updateConfig(newConfig: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Atualiza configuração de todos os instrumentos
    this.instruments.forEach(instrument => {
      instrument.updateConfig({ volume: this.config.masterVolume });
    });
  }

  /**

Obtém lista de instrumentos disponíveis
*/
getAvailableInstruments() {
  return InstrumentFactory.getAvailableInstruments();
  }
  /**
  
  Obtém estado atual
  */
  getState() {
  return {
  context: this.audioContext,
  isInitialized: !!this.audioContext,
  isPlaying: this.scheduledNodes.size > 0,
  timeModifier: this.timeModifier,
  currentInstrument: this.currentInstrument,
  availableInstruments: this.getAvailableInstruments(),
  config: { ...this.config }
  };
  }
  /**
  
  Limpa recursos
  */
  dispose(): void {
  this.stop();
  // Dispose de todos os instrumentos
  this.instruments.forEach(instrument => {
    if (instrument.dispose) {
      instrument.dispose();
    }
  });
  this.instruments.clear();if (this.audioContext) {
    this.audioContext.close();
    this.audioContext = null;
  }
  }
  }