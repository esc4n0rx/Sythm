/**
 * Motor de áudio para execução de música Sythm
 */

import { getNoteFrequency } from './note-frequencies';

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
    }
  }

  /**
   * Para toda a execução atual
   */
  stop(): void {
    if (this.audioContext) {
      // Para todos os nós agendados
      this.scheduledNodes.forEach(node => {
        try {
          if (node instanceof OscillatorNode) {
            node.stop();
          }
        } catch (e) {
          // Ignora erros se o nó já foi parado
        }
      });
      this.scheduledNodes.clear();
    }
  }

  /**
   * Toca uma nota musical
   */
  playNote(note: string, duration: number = this.config.baseNoteDuration, startTime: number = 0): void {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      const frequency = getNoteFrequency(note);
      const actualDuration = this.calculateActualDuration(duration);
      const actualStartTime = this.audioContext.currentTime + startTime;

      // Cria oscilador
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      // Conecta os nós
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

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
   * Toca múltiplas notas simultaneamente (acorde)
   */
  playChord(notes: string[], duration: number = this.config.baseNoteDuration, startTime: number = 0): void {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      const actualDuration = this.calculateActualDuration(duration);
      const actualStartTime = this.audioContext.currentTime + startTime;

      // Cria um nó de ganho mestre para o acorde
      const masterGain = this.audioContext.createGain();
      masterGain.connect(this.audioContext.destination);

      // Volume ajustado para evitar distorção com múltiplas notas
      const chordVolume = this.config.masterVolume / Math.sqrt(notes.length);

      // Cria um oscilador para cada nota do acorde
      notes.forEach(note => {
        try {
          const frequency = getNoteFrequency(note);

          // Cria oscilador e gain para esta nota
          const oscillator = this.audioContext!.createOscillator();
          const gainNode = this.audioContext!.createGain();

          // Conecta os nós
          oscillator.connect(gainNode);
          gainNode.connect(masterGain);

          // Configura o oscilador
          oscillator.frequency.setValueAtTime(frequency, actualStartTime);
          oscillator.type = this.config.waveType;

          // Configura envelope ADSR
          const attackTime = 0.01;
          const decayTime = 0.1;
          const sustainLevel = 0.7;
          const releaseTime = 0.1;

          // Attack
          gainNode.gain.setValueAtTime(0, actualStartTime);
          gainNode.gain.linearRampToValueAtTime(
            chordVolume, 
            actualStartTime + attackTime
          );

          // Decay
          gainNode.gain.linearRampToValueAtTime(
            chordVolume * sustainLevel, 
            actualStartTime + attackTime + decayTime
          );

          // Sustain
          const releaseStartTime = actualStartTime + actualDuration - releaseTime;
          gainNode.gain.setValueAtTime(
            chordVolume * sustainLevel, 
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

          // Registra nós para controle
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
  }

  /**
   * Obtém estado atual
   */
  getState() {
    return {
      isInitialized: !!this.audioContext,
      isPlaying: this.scheduledNodes.size > 0,
      timeModifier: this.timeModifier,
      config: { ...this.config }
    };
  }

  /**
   * Limpa recursos
   */
  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}