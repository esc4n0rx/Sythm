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
    CommentNode 
  } from './ast';
  import { SythmAudioEngine } from './audio-engine';
  
  export interface InterpreterOptions {
    onNotePlay?: (note: string, duration: number) => void;
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
        
        // Aguarda todas as notas terminarem antes de chamar onComplete
        const finalWaitTime = Math.max(this.totalDuration * 1000, 500);
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
            // Comentários são ignorados durante execução
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
      
      this.engine.playNote(node.note, duration, this.currentTime);
      this.options.onNotePlay?.(node.note, duration);
      
      // Avança o tempo
      const noteDuration = beatDuration * duration;
      this.currentTime += noteDuration;
      this.totalDuration = Math.max(this.totalDuration, this.currentTime + noteDuration);
    }
  
    /**
     * Executa uma pausa
     */
    private async executeRest(node: RestNode): Promise<void> {
      const duration = node.duration ?? 1; // duração padrão de 1 beat
      const beatDuration = this.engine.getBeatDuration();
      
      this.engine.playRest(duration);
      this.options.onRest?.(duration);
      
      // Avança o tempo
      const restDuration = beatDuration * duration;
      this.currentTime += restDuration;
    }
  
    /**
     * Executa comando slow
     */
    private async executeSlow(node: SlowNode): Promise<void> {
      this.engine.setSlow();
      this.options.onSpeedChange?.(0.5);
    }
  
    /**
     * Executa comando fast
     */
    private async executeFast(node: FastNode): Promise<void> {
      this.engine.setFast();
      this.options.onSpeedChange?.(1.5);
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