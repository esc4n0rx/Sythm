/**
 * Interpretador para executar código Sythm compilado
 */

import { 
  ASTNode, 
  ProgramNode, 
  NoteNode, 
  RestNode, 
  SlowNode, 
  FastNode, 
  CommentNode,
  ChordNode,
  LoopNode,
  GroupNode
} from './ast';
import { SythmAudioEngine } from './audio-engine';

export interface InterpreterOptions {
  onNotePlay?: (note: string, duration: number) => void;
  onChordPlay?: (notes: string[], duration: number) => void;
  onRest?: (duration: number) => void;
  onSpeedChange?: (modifier: number) => void;
  onError?: (error: Error, node: ASTNode) => void;
  onComplete?: () => void;
}

export class SythmInterpreter {
  private engine: SythmAudioEngine;
  private options: InterpreterOptions;
  private currentTime: number = 0;
  private isRunning: boolean = false;
  private totalDuration: number = 0;

  constructor(engine: SythmAudioEngine, options: InterpreterOptions = {}) {
    this.engine = engine;
    this.options = options;
  }

  /**
   * Executa um programa Sythm
   */
  async execute(program: ProgramNode): Promise<void> {
    if (this.isRunning) {
      throw new Error('Interpreter is already running');
    }

    this.isRunning = true;
    this.currentTime = 0;
    this.totalDuration = 0;
    
    // Reseta velocidade para normal no início
    this.engine.setNormalSpeed();

    try {
      await this.engine.initialize();
      
      for (const node of program.body) {
        if (!this.isRunning) {
          break; // Parou durante execução
        }
        
        await this.executeNode(node);
      }
      
      // Aguarda um pouco mais para garantir que todas as notas terminaram
      const finalWaitTime = Math.max(this.totalDuration * 1000, 1000);
      setTimeout(() => {
        if (this.isRunning) {
          this.isRunning = false;
          this.options.onComplete?.();
        }
      }, finalWaitTime);
      
    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Para a execução
   */
  stop(): void {
    this.isRunning = false;
    this.engine.stop();
    this.currentTime = 0;
    this.totalDuration = 0;
  }

  /**
   * Pausa a execução por um tempo determinado
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Executa um nó individual do AST
   */
  private async executeNode(node: ASTNode): Promise<void> {
    try {
      switch (node.type) {
        case 'Note':
          await this.executeNote(node as NoteNode);
          break;
        case 'Rest':
          await this.executeRest(node as RestNode);
          break;
        case 'Slow':
          await this.executeSlow(node as SlowNode);
          break;
        case 'Fast':
          await this.executeFast(node as FastNode);
          break;
        case 'Comment':
          // Comentários são processados instantaneamente
          await this.sleep(100); // Pequena pausa para visualização
          break;
        case 'Chord':
          await this.executeChord(node as ChordNode);
          break;
        case 'Loop':
          await this.executeLoop(node as LoopNode);
          break;
        case 'Group':
          await this.executeGroup(node as GroupNode);
          break;
        default:
          console.warn(`Unknown node type: ${node.type}`);
      }
    } catch (error) {
      this.options.onError?.(error as Error, node);
      throw error;
    }
  }

  /**
   * Executa uma nota musical
   */
  private async executeNote(node: NoteNode): Promise<void> {
    const duration = node.duration ?? 1; // duração padrão de 1 beat
    const beatDuration = this.engine.getBeatDuration();
    const realDurationMs = beatDuration * duration * 1000; // Converte para millisegundos
    
    // Toca a nota
    this.engine.playNote(node.note, duration, this.currentTime);
    this.options.onNotePlay?.(node.note, duration);
    
    // AGUARDA a duração real da nota antes de continuar
    await this.sleep(realDurationMs);
    
    // Avança o tempo apenas após a nota ter sido "tocada"
    const noteDuration = beatDuration * duration;
    this.currentTime += noteDuration;
    this.totalDuration = Math.max(this.totalDuration, this.currentTime + noteDuration);
  }

  /**
   * Executa um acorde (múltiplas notas simultâneas)
   */
  private async executeChord(node: ChordNode): Promise<void> {
    const duration = node.duration ?? 1; // duração padrão de 1 beat
    const beatDuration = this.engine.getBeatDuration();
    const realDurationMs = beatDuration * duration * 1000; // Converte para millisegundos
    
    // Toca o acorde
    this.engine.playChord(node.notes, duration, this.currentTime);
    this.options.onChordPlay?.(node.notes, duration);
    
    // AGUARDA a duração real do acorde antes de continuar
    await this.sleep(realDurationMs);
    
    // Avança o tempo apenas após o acorde ter sido "tocado"
    const chordDuration = beatDuration * duration;
    this.currentTime += chordDuration;
    this.totalDuration = Math.max(this.totalDuration, this.currentTime + chordDuration);
  }

  /**
   * Executa um loop
   */
  private async executeLoop(node: LoopNode): Promise<void> {
    for (let i = 0; i < node.iterations; i++) {
      if (!this.isRunning) {
        break; // Parou durante execução
      }
      
      // Executa cada comando do corpo do loop
      for (const bodyNode of node.body) {
        if (!this.isRunning) {
          break;
        }
        
        await this.executeNode(bodyNode);
      }
    }
  }

  /**
   * Executa um grupo (com possível multiplicação)
   */
  private async executeGroup(node: GroupNode): Promise<void> {
    const iterations = node.multiplier ?? 1; // se não tem multiplicador, executa 1 vez
    
    for (let i = 0; i < iterations; i++) {
      if (!this.isRunning) {
        break; // Parou durante execução
      }
      
      // Executa cada comando do corpo do grupo
      for (const bodyNode of node.body) {
        if (!this.isRunning) {
          break;
        }
        
        await this.executeNode(bodyNode);
      }
    }
  }

  /**
   * Executa uma pausa
   */
  private async executeRest(node: RestNode): Promise<void> {
    const duration = node.duration ?? 1; // duração padrão de 1 beat
    const beatDuration = this.engine.getBeatDuration();
    const realDurationMs = beatDuration * duration * 1000; // Converte para millisegundos
    
    this.engine.playRest(duration);
    this.options.onRest?.(duration);
    
    // AGUARDA a duração real da pausa antes de continuar
    await this.sleep(realDurationMs);
    
    // Avança o tempo apenas após a pausa ter sido "executada"
    const restDuration = beatDuration * duration;
    this.currentTime += restDuration;
  }

  /**
   * Executa comando slow
   */
  private async executeSlow(node: SlowNode): Promise<void> {
    this.engine.setSlow();
    this.options.onSpeedChange?.(0.5);
    // Comandos de tempo são instantâneos, apenas uma pequena pausa visual
    await this.sleep(200);
  }

  /**
   * Executa comando fast
   */
  private async executeFast(node: FastNode): Promise<void> {
    this.engine.setFast();
    this.options.onSpeedChange?.(1.5);
    // Comandos de tempo são instantâneos, apenas uma pequena pausa visual
    await this.sleep(200);
  }

  /**
   * Obtém estado atual
   */
  getState() {
    return {
      isRunning: this.isRunning,
      currentTime: this.currentTime,
      totalDuration: this.totalDuration,
      engineState: this.engine.getState()
    };
  }
}