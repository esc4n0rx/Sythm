export interface AudioContextType {
    context: AudioContext | null
    isPlaying: boolean
    bpm: number
  }
  
  export interface Component {
    title: string
    description: string
    icon: any
    subcomponents: string[]
  }
  
  export interface SythmIDEProps {
    initialCode?: string
    initialBpm?: number
  }