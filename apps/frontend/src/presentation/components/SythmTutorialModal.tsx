import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Lightbulb,
  Play,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

export interface SythmTutorialModalProps {
  isOpen: boolean;
  onInsertSnippet: (snippet: string) => void;
  onLoadFullExample: (code: string, title: string) => void;
  onClose: () => void;
}

interface SyntaxRule {
  pattern: string;
  explanation: string;
}

interface TutorialChapter {
  number: number;
  title: string;
  subtitle: string;
  summary: string;
  syntaxRules: SyntaxRule[];
  proTip: string;
  lineNotes: string[];
  insertSnippet: string;
  fullExample: string;
}

const TUTORIAL_CHAPTERS: TutorialChapter[] = [
  {
    number: 1,
    title: 'Estrutura em Divisões',
    subtitle: 'HEADER, CONFIG, PROCEDURES & PLAY',
    summary:
      'Todo código Sythm segue a arquitetura legível inspirada no COBOL, dividida em blocos chamados DIVISIONS. Cada instrução termina sempre com ponto final (.) e comentários começam com *>.',
    syntaxRules: [
      {
        pattern: 'HEADER DIVISION.',
        explanation: 'Identifica o projeto com PROGRAM-ID, TITLE IS "..." e AUTHOR IS "...".',
      },
      {
        pattern: 'CONFIG DIVISION.',
        explanation: 'Define BPM global (TEMPO IS 120 BPM.), instrumento padrão e controles SLIDER.',
      },
      {
        pattern: 'PROCEDURES DIVISION.',
        explanation: 'Guarda rotinas musicais reutilizáveis em blocos SECTION ... END-SECTION.',
      },
      {
        pattern: 'PLAY DIVISION.',
        explanation: 'Onde a música acontece: notas, acordes, bateria e TRACKs paralelas.',
      },
    ],
    proTip:
      'Nunca esqueça o ponto final (.) ao término de cada comando. Comentários começam com *> e não afetam o som.',
    lineNotes: [
      'HEADER DIVISION guarda metadados exibidos no visor LCD da barra superior.',
      'TEMPO IS 118 BPM. define a velocidade global em batidas por minuto.',
      'PLAY DIVISION executa sequencialmente cada nota ou bloco TRACK.',
    ],
    insertSnippet: `HEADER DIVISION.
  PROGRAM-ID. MINHA-MUSICA.
  TITLE IS "Minha Primeira Faixa".
CONFIG DIVISION.
  TEMPO IS 120 BPM.
  WAVE IS SAW.
PLAY DIVISION.`,
    fullExample: `*> Capítulo 1 — Estrutura Completa em Divisões
HEADER DIVISION.
  PROGRAM-ID. CAPITULO-01.
  TITLE IS "Introdução ao Sythm".
  AUTHOR IS "Estudante Sythm".

CONFIG DIVISION.
  TEMPO IS 118 BPM.
  WAVE IS FM-KEYS.
  VOLUME IS 80.

PLAY DIVISION.
  PRINT "Iniciando Capítulo 1!".
  PLAY NOTE C4 FOR 1 BEATS.
  PLAY NOTE E4 FOR 1 BEATS.
  PLAY NOTE G4 FOR 1 BEATS.
  PLAY NOTE C5 FOR 2 BEATS.
`,
  },
  {
    number: 2,
    title: 'Notas, Pausas & Sequências',
    subtitle: 'PLAY NOTE, PLAY NOTES & REST',
    summary:
      'Escreva melodias nota por nota ou em frases rápidas na mesma linha. O Sythm aceita notas musicais com oitava (C3, F#4, Bb5) e pausas rítmicas com REST.',
    syntaxRules: [
      {
        pattern: 'PLAY NOTE <Nota> FOR <N> BEATS.',
        explanation: 'Toca uma única nota (ex: C4, F#4, Bb4) pela duração informada em batidas.',
      },
      {
        pattern: 'PLAY NOTES <Lista> FOR <N> BEATS.',
        explanation: 'Toca várias notas em sequência, cada uma com a duração N (ex: 0.5 BEATS).',
      },
      {
        pattern: 'REST FOR <N> BEATS.',
        explanation: 'Cria silêncio musical pelo tempo N para dar respiro à melodia.',
      },
    ],
    proTip:
      'Use oitavas baixas (C1–C2) para linhas de baixo, médias (C4–B4) para acordes e agudas (C5–C6) para leads.',
    lineNotes: [
      '0.5 BEATS equivale a uma colcheia; 0.25 BEATS a uma semicolcheia.',
      'Sustenidos (#) e bemóis (b) funcionam direto no nome da nota: D#4, Bb3.',
      'PLAY NOTES economiza dezenas de linhas em riffs melódicos.',
    ],
    insertSnippet: `PLAY NOTES C4 E4 G4 B4 FOR 0.5 BEATS.
REST FOR 0.5 BEATS.
PLAY NOTES A4 G4 E4 C4 FOR 0.5 BEATS.`,
    fullExample: `*> Capítulo 2 — Notas, Oitavas, Pausas e Sequências
HEADER DIVISION.
  PROGRAM-ID. MELODIA-BASICA.
  TITLE IS "Notas e Pausas".

CONFIG DIVISION.
  TEMPO IS 124 BPM.
  WAVE IS TRIANGLE.
  VOLUME IS 80.
  REVERB IS 25 PERCENT.

PLAY DIVISION.
  PLAY NOTES C4 E4 G4 B4 FOR 0.5 BEATS.
  PLAY NOTE C5 FOR 1 BEATS.
  REST FOR 0.5 BEATS.
  PLAY NOTES B4 G4 F#4 E4 FOR 0.5 BEATS.
  PLAY NOTE D4 FOR 1.5 BEATS.
  REST FOR 0.5 BEATS.
  PLAY NOTES G4 A4 B4 D5 FOR 0.5 BEATS.
  PLAY NOTE C5 FOR 2 BEATS.
`,
  },
  {
    number: 3,
    title: 'Acordes, Cifras & Escalas',
    subtitle: 'PLAY CHORD, CHORDS, SCALE & TRANSPOSE',
    summary:
      'Crie harmonias ricas tocando múltiplas notas simultaneamente, usando cifras populares (Am7, Fmaj7, G7, Dm9) e mudando a tonalidade do trecho com TRANSPOSE.',
    syntaxRules: [
      {
        pattern: 'PLAY CHORD <Cifra|Notas> FOR <N> BEATS.',
        explanation: 'Toca um acorde por cifra (Am7) ou notas explicitadas (C4 E4 G4).',
      },
      {
        pattern: 'PLAY CHORDS <Cifra1> <Cifra2> ... FOR <N> BEATS.',
        explanation: 'Encadeia uma progressão harmônica inteira numa única linha.',
      },
      {
        pattern: 'SCALE IS <Nota> <MODO>.',
        explanation: 'Define a escala guia (MAJOR, MINOR, DORIAN, PHRYGIAN, PENTATONIC).',
      },
      {
        pattern: 'TRANSPOSE UP|DOWN <N> SEMITONES.',
        explanation: 'Desloca todas as próximas notas N semitons acima ou abaixo.',
      },
    ],
    proTip:
      'Experimente combinações neo-soul ou synthwave usando acordes com 7ª e 9ª como Am9, Fmaj7 e Em7 com WAVE IS FM-KEYS.',
    lineNotes: [
      'PLAY CHORDS dispara cada cifra na sequência com duração fixa.',
      'TRANSPOSE UP 2 SEMITONES sobe 1 tom inteiro sem reescrever a melodia.',
      'Você pode misturar cifras modernas e notas explícitas no mesmo programa.',
    ],
    insertSnippet: `SCALE IS A MINOR.
PLAY CHORDS Am7 Fmaj7 Cmaj7 G7 FOR 2 BEATS.`,
    fullExample: `*> Capítulo 3 — Harmonia com Cifras e Transposição
HEADER DIVISION.
  PROGRAM-ID. PROGRESSAO-CIFRAS.
  TITLE IS "Harmonia & Escalas".

CONFIG DIVISION.
  TEMPO IS 98 BPM.
  WAVE IS FM-KEYS.
  VOLUME IS 75.
  SCALE IS A MINOR.
  REVERB IS 35 PERCENT.

PLAY DIVISION.
  PLAY CHORDS Am7 Fmaj7 Cmaj7 G7 FOR 2 BEATS.
  TRANSPOSE UP 2 SEMITONES.
  PLAY CHORDS Am7 Fmaj7 Cmaj7 G7 FOR 2 BEATS.
  TRANSPOSE DOWN 2 SEMITONES.
  PLAY CHORD Am9 FOR 4 BEATS.
`,
  },
  {
    number: 4,
    title: 'Arpejador Inteligente',
    subtitle: 'ARPEGGIATE / ARP (UP, DOWN, UP-DOWN)',
    summary:
      'Transforme qualquer acorde parado em um movimento pulsante de sintetizador! O comando ARPEGGIATE (ou a abreviação ARP) divide as notas do acorde automaticamente em degraus rítmicos.',
    syntaxRules: [
      {
        pattern: 'ARPEGGIATE <Cifra|Notas> UP FOR <N> BEATS.',
        explanation: 'Toca as notas do acorde da mais grave até a mais aguda em passos de N batidas.',
      },
      {
        pattern: 'ARPEGGIATE <Cifra> DOWN FOR <N> BEATS.',
        explanation: 'Arpejo descendente (da nota mais aguda para a mais grave).',
      },
      {
        pattern: 'ARP <Cifra> UP-DOWN FOR <N> BEATS.',
        explanation: 'Forma curta ARP subindo e descendo em efeito ping-pong.',
      },
    ],
    proTip:
      'Combine WAVE IS PLUCK + DELAY + ARPEGGIATE ... FOR 0.25 BEATS para obter texturas estilo Stranger Things e synth-pop dos anos 80.',
    lineNotes: [
      'Quanto menor o valor de FOR (ex: 0.25 ou 0.125 BEATS), mais rápido o arpejo.',
      'Aceita tanto cifras (Dm9, Fmaj7) quanto listas soltas (C4 E4 G4 B4).',
    ],
    insertSnippet: `ARPEGGIATE Am7 UP FOR 0.25 BEATS.
ARP Fmaj7 UP-DOWN FOR 0.25 BEATS.`,
    fullExample: `*> Capítulo 4 — Arpejos UP, DOWN e UP-DOWN
HEADER DIVISION.
  PROGRAM-ID. ARP-80S.
  TITLE IS "Arpejador Clássico".

CONFIG DIVISION.
  TEMPO IS 116 BPM.
  WAVE IS PLUCK.
  VOLUME IS 75.
  DELAY IS 35 PERCENT TIME 0.25 SEC FEEDBACK 40 PERCENT.
  REVERB IS 30 PERCENT.

PLAY DIVISION.
  ARPEGGIATE Am7 UP FOR 0.25 BEATS.
  ARPEGGIATE Fmaj7 UP-DOWN FOR 0.25 BEATS.
  ARP Cmaj7 DOWN FOR 0.25 BEATS.
  ARP G7 UP-DOWN FOR 0.25 BEATS.
  PLAY CHORD Am9 FOR 2 BEATS.
`,
  },
  {
    number: 5,
    title: 'Bateria & Ritmos Euclidianos',
    subtitle: 'PLAY DRUM, PLAY DRUMS & PLAY EUCLIDEAN',
    summary:
      'O Sythm possui sintetizador de percussão embutido com 10 peças de bateria eletrônica além de um gerador matemático de Ritmos Euclidianos para grooves polirrítmicos instantâneos.',
    syntaxRules: [
      {
        pattern: 'PLAY DRUMS <Peças...> FOR <N> BEATS.',
        explanation: 'Sequencia peças em passos iguais: KICK, SNARE, HIHAT, OPEN-HIHAT, CLAP, TOM, RIM, COWBELL, CRASH, PERC.',
      },
      {
        pattern: 'PLAY EUCLIDEAN <Alvo> <Pulsos> IN <Passos> FOR <N> BEATS.',
        explanation: 'Distribui K pulsos de forma matematicamente equilibrada dentro de M passos (ex: 5 IN 16).',
      },
    ],
    proTip:
      'Use PLAY EUCLIDEAN dentro de TRACKs separadas (ex: KICK 4 IN 16 + RIM 5 IN 16 + HIHAT 11 IN 16) para grooves hipnóticos instantâneos!',
    lineNotes: [
      '4 IN 16 com FOR 0.25 BEATS gera o clássico bumbo "Four-on-the-Floor" da música eletrônica.',
      '5 IN 16 cria a famosa clave afro-latina / bossa / techno.',
      'Também aceita notas musicais no lugar da bateria: PLAY EUCLIDEAN C3 5 IN 16 FOR 0.25 BEATS.',
    ],
    insertSnippet: `PLAY DRUMS KICK HIHAT SNARE OPEN-HIHAT FOR 0.5 BEATS.
PLAY EUCLIDEAN RIM 5 IN 16 FOR 0.25 BEATS.`,
    fullExample: `*> Capítulo 5 — Drum Machine + Algoritmo Euclidiano
HEADER DIVISION.
  PROGRAM-ID. DRUM-LAB.
  TITLE IS "Grooves Euclidianos".

CONFIG DIVISION.
  TEMPO IS 125 BPM.
  VOLUME IS 80.

PLAY DIVISION.
  TRACK KICK-FOUR.
    PLAY EUCLIDEAN KICK 4 IN 16 FOR 0.25 BEATS.
  END-TRACK.

  TRACK POLIRRITMO-RIM.
    PLAY EUCLIDEAN RIM 5 IN 16 FOR 0.25 BEATS.
  END-TRACK.

  TRACK CLAP-HIHAT.
    PLAY DRUMS HIHAT HIHAT CLAP HIHAT HIHAT HIHAT CLAP OPEN-HIHAT FOR 0.5 BEATS.
  END-TRACK.
`,
  },
  {
    number: 6,
    title: 'Instrumentos & Timbres',
    subtitle: 'WAVE / INSTRUMENT IS ...',
    summary:
      'Escolha entre 4 formas de onda puras analógicas e 5 sintetizadores compostos modelados especialmente no motor Web Audio do Sythm.',
    syntaxRules: [
      {
        pattern: 'WAVE IS SINE | TRIANGLE | SQUARE | SAW.',
        explanation: 'Osciladores clássicos: SINE (suave), TRIANGLE (aveludada), SQUARE (retro 8-bit), SAW (rica para bass/leads).',
      },
      {
        pattern: 'WAVE IS FM-KEYS.',
        explanation: 'Piano elétrico estilo DX7 sintetizado via modulação em frequência (FM).',
      },
      {
        pattern: 'WAVE IS ACID-BASS | SUB-808 | PLUCK | PAD-WARM.',
        explanation: 'Baixo ácido 303, sub-grave 808 encorpado, corda dedilhada PLUCK e colchão harmônico PAD-WARM.',
      },
    ],
    proTip:
      'Você pode declarar WAVE IS (ou INSTRUMENT IS) globalmente na CONFIG DIVISION e trocá-la dentro de cada TRACK!',
    lineNotes: [
      'Cada TRACK herda as configurações da CONFIG DIVISION, mas sobrescreve seu próprio timbre.',
      'SUB-808 funciona melhor entre as oitavas 1 e 2 (ex: C1, A1, F1).',
    ],
    insertSnippet: `INSTRUMENT IS FM-KEYS.`,
    fullExample: `*> Capítulo 6 — Catálogo de Timbres do Sythm
HEADER DIVISION.
  PROGRAM-ID. SHOWCASE-TIMBRES.
  TITLE IS "Instrumentos Sintetizados".

CONFIG DIVISION.
  TEMPO IS 112 BPM.
  REVERB IS 30 PERCENT.

PLAY DIVISION.
  TRACK SUB-GRAVE.
    INSTRUMENT IS SUB-808.
    VOLUME IS 80.
    PLAY NOTES A1 A1 F1 G1 FOR 1 BEATS.
  END-TRACK.

  TRACK PIANO-FM.
    WAVE IS FM-KEYS.
    VOLUME IS 70.
    PLAY CHORDS Am7 Fmaj7 FOR 2 BEATS.
  END-TRACK.

  TRACK DEDILHADO.
    WAVE IS PLUCK.
    VOLUME IS 65.
    ARPEGGIATE Am7 UP-DOWN FOR 0.5 BEATS.
  END-TRACK.
`,
  },
  {
    number: 7,
    title: 'Tracks Paralelas, Seções & Loops',
    subtitle: 'TRACK, SECTION, PERFORM & REPEAT',
    summary:
      'Para que bateria, baixo, acordes e melodia toquem ao mesmo tempo (em paralelo), envolva cada instrumento em um bloco TRACK. Use SECTION e REPEAT para estruturar arranjos completos sem repetir código.',
    syntaxRules: [
      {
        pattern: 'TRACK <Nome>. ... END-TRACK.',
        explanation: 'Todas as TRACKs definidas na PLAY DIVISION começam no tempo 0 em sincronia paralela.',
      },
      {
        pattern: 'SECTION <Nome>. ... END-SECTION.',
        explanation: 'Declara um bloco reutilizável dentro da PROCEDURES DIVISION.',
      },
      {
        pattern: 'PERFORM <Nome> <N> TIMES.',
        explanation: 'Chama uma SECTION N vezes seguidas dentro de uma Track.',
      },
      {
        pattern: 'REPEAT <N> TIMES ... END-REPEAT.',
        explanation: 'Repete um bloco inline N vezes dentro da execução atual.',
      },
    ],
    proTip:
      'Cada TRACK aparece automaticamente no Track Mixer acima do editor com botões individuais de Mute (M) e Solo (S)!',
    lineNotes: [
      'PROCEDURES DIVISION organiza motivos musicais antes da execução.',
      'TRACK BATERIA e TRACK BAIXO tocam juntas no mesmo compasso.',
    ],
    insertSnippet: `TRACK NOVA-PISTA.
  WAVE IS SAW.
  VOLUME IS 70.
  REPEAT 2 TIMES
    PLAY NOTES C3 G3 C4 G3 FOR 0.5 BEATS.
  END-REPEAT.
END-TRACK.`,
    fullExample: `*> Capítulo 7 — Arranjo Multi-Track com SECTION e REPEAT
HEADER DIVISION.
  PROGRAM-ID. MULTI-TRACK-DEMO.
  TITLE IS "Tracks & Seções".

CONFIG DIVISION.
  TEMPO IS 120 BPM.

PROCEDURES DIVISION.
  SECTION LEVADA-BASS.
    PLAY NOTES A1 A1 C2 E2 FOR 0.5 BEATS.
  END-SECTION.

PLAY DIVISION.
  TRACK BATERIA.
    REPEAT 4 TIMES
      PLAY DRUMS KICK HIHAT SNARE HIHAT FOR 0.5 BEATS.
    END-REPEAT.
  END-TRACK.

  TRACK BAIXO.
    WAVE IS SAW.
    VOLUME IS 75.
    FILTER IS LOWPASS 950 HZ Q 3.
    PERFORM LEVADA-BASS 4 TIMES.
  END-TRACK.
`,
  },
  {
    number: 8,
    title: 'Efeitos de Estúdio & Modulação',
    subtitle: 'FILTER, SWEEP, ENVELOPE, DELAY, REVERB, LFO & PAN',
    summary:
      'Esculpe o som profissionalmente! Adicione filtros ressonantes, automação SWEEP de frequência, envelopes ADSR, delay rítmico, reverb espacial, desafinação analógica (DETUNE), panorama estéreo (PAN) e LFO.',
    syntaxRules: [
      {
        pattern: 'FILTER IS LOWPASS|HIGHPASS|BANDPASS <Hz> HZ Q <Res>.',
        explanation: 'Corta frequências e aplica ressonância analógica (Q).',
      },
      {
        pattern: 'SWEEP FROM <Hz1> TO <Hz2> OVER <N> BEATS.',
        explanation: 'Abre ou fecha automaticamente o corte do filtro durante N batidas.',
      },
      {
        pattern: 'LFO IS ON RATE <Hz> HZ DEPTH <Hz> HZ.',
        explanation: 'Modula ciclicamente o filtro criando efeito wobble ou movimento orgânico.',
      },
      {
        pattern: 'ENVELOPE ATTACK <s1> SEC DECAY <s2> SEC SUSTAIN <%> PERCENT RELEASE <s3> SEC.',
        explanation: 'Desenha o ataque suave (pad) ou percussivo (pluck) de cada nota.',
      },
      {
        pattern: 'DELAY / REVERB / DETUNE / PAN',
        explanation: 'Exemplos: DELAY IS 35 PERCENT TIME 0.25 SEC FEEDBACK 40 PERCENT. | PAN IS LEFT 40 PERCENT.',
      },
    ],
    proTip:
      'Para efeito "SuperSaw" gordo de trance/synthwave, use WAVE IS SAW + DETUNE IS 14 CENTS + REVERB IS 35 PERCENT.',
    lineNotes: [
      'PAN aceita LEFT <N> PERCENT, RIGHT <N> PERCENT, CENTER ou número de -100 a 100.',
      'SWEEP FROM 250 TO 3200 OVER 4 BEATS gera uma subida épica de filtro.',
    ],
    insertSnippet: `FILTER IS LOWPASS 1400 HZ Q 4.
SWEEP FROM 300 TO 3200 OVER 4 BEATS.
LFO IS ON RATE 2 HZ DEPTH 350 HZ.
REVERB IS 35 PERCENT.`,
    fullExample: `*> Capítulo 8 — Cadeia Completa de Efeitos & Modulação
HEADER DIVISION.
  PROGRAM-ID. FX-STUDIO.
  TITLE IS "Efeitos & Modulação".

CONFIG DIVISION.
  TEMPO IS 118 BPM.

PLAY DIVISION.
  TRACK SYNTH-SWEEP.
    WAVE IS ACID-BASS.
    VOLUME IS 80.
    FILTER IS LOWPASS 600 HZ Q 5.
    SWEEP FROM 260 TO 3400 OVER 8 BEATS.
    LFO IS ON RATE 4 HZ DEPTH 320 HZ.
    DELAY IS 30 PERCENT TIME 0.25 SEC FEEDBACK 38 PERCENT.
    PLAY NOTES C2 C2 Eb2 G2 C2 C2 Bb1 G1 FOR 0.5 BEATS.
    PLAY NOTES C2 C2 Eb2 G2 C3 Bb2 G2 Eb2 FOR 0.5 BEATS.
  END-TRACK.

  TRACK PAD-ESTEREO.
    WAVE IS PAD-WARM.
    VOLUME IS 55.
    DETUNE IS 12 CENTS.
    PAN IS RIGHT 35 PERCENT.
    REVERB IS 55 PERCENT.
    ENVELOPE ATTACK 0.35 SEC DECAY 0.2 SEC SUSTAIN 80 PERCENT RELEASE 0.4 SEC.
    PLAY CHORD Cm9 FOR 8 BEATS.
  END-TRACK.
`,
  },
  {
    number: 9,
    title: 'Controles Live & Sliders no Código',
    subtitle: 'CONTROL ... IS SLIDER ... FROM ... TO ...',
    summary:
      'Inspire-se no live-coding estilo Strudel! Declare variáveis com CONTROL ou use SLIDER inline e o Sythm cria instantaneamente controles deslizantes no editor e no Track Mixer para modular áudio em tempo real sem parar a música.',
    syntaxRules: [
      {
        pattern: 'CONTROL <NOME> IS SLIDER <Init> FROM <Min> TO <Max>.',
        explanation: 'Declara uma variável modulável na CONFIG DIVISION (ex: CONTROL FILTRO IS SLIDER 900 FROM 120 TO 4500.).',
      },
      {
        pattern: 'Substituição em Qualquer Parâmetro',
        explanation: 'Use o nome da variável em VOLUME IS <NOME>., FILTER IS LOWPASS <NOME> HZ., REVERB IS <NOME> PERCENT. ou PAN IS <NOME>.',
      },
    ],
    proTip:
      'Os sliders aparecem tanto inline ao lado da linha do código quanto agrupados nas faixas do Track Mixer acima do editor!',
    lineNotes: [
      'Arrastar o slider altera instantaneamente GainNode, BiquadFilter, Reverb/Delay ou Panner em execução.',
      'Você também pode ativar/desativar sliders inline nas Configurações -> Editor & Sintaxe.',
    ],
    insertSnippet: `CONTROL CUTOFF-LIVE IS SLIDER 900 FROM 100 TO 4500.
CONTROL REV-LIVE IS SLIDER 35 FROM 0 TO 100.`,
    fullExample: `*> Capítulo 9 — Controles Ao Vivo estilo Strudel
HEADER DIVISION.
  PROGRAM-ID. LIVE-SLIDERS.
  TITLE IS "Sliders Ao Vivo".

CONFIG DIVISION.
  TEMPO IS 122 BPM.
  CONTROL VOL-DRUM IS SLIDER 80 FROM 0 TO 100.
  CONTROL CUTOFF-SYNTH IS SLIDER 850 FROM 120 TO 4500.
  CONTROL DELAY-MIX IS SLIDER 32 FROM 0 TO 100.

PLAY DIVISION.
  TRACK DRUMS.
    VOLUME IS VOL-DRUM.
    PLAY EUCLIDEAN KICK 4 IN 16 FOR 0.25 BEATS.
    PLAY EUCLIDEAN HIHAT 10 IN 16 FOR 0.25 BEATS.
  END-TRACK.

  TRACK LEAD-MODULAR.
    WAVE IS SAW.
    VOLUME IS 75.
    FILTER IS LOWPASS CUTOFF-SYNTH HZ Q 4.5.
    DELAY IS DELAY-MIX PERCENT TIME 0.25 SEC FEEDBACK 45 PERCENT.
    DETUNE IS 10 CENTS.
    REPEAT 2 TIMES
      ARPEGGIATE Am7 UP-DOWN FOR 0.25 BEATS.
      ARPEGGIATE Fmaj7 UP-DOWN FOR 0.25 BEATS.
    END-REPEAT.
  END-TRACK.
`,
  },
  {
    number: 10,
    title: 'Visualizador, .WAV & Projetos',
    subtitle: 'VISUALIZER, Exportação & Pastas',
    summary:
      'Finalize sua faixa escolhendo o painel visual favorito no código, exportando o áudio renderizado em alta qualidade .WAV estéreo, gerando links compartilháveis e organizando seus arquivos em pastas na Sidebar.',
    syntaxRules: [
      {
        pattern: 'VISUALIZER IS ALL | SCOPE | SPECTRUM | PIANOROLL | OFF.',
        explanation: 'Seleciona no próprio programa qual visualização aparece acima do editor.',
      },
      {
        pattern: 'PRINT "Mensagem".',
        explanation: 'Imprime logs musicais no Console do Debug Area durante a execução.',
      },
      {
        pattern: 'Botões .WAV, Share & Pastas na Sidebar',
        explanation: 'Renderize .WAV offline (OfflineAudioContext), copie a URL com seu código ou crie pastas à esquerda.',
      },
    ],
    proTip:
      'Use o botão Share no topo para enviar sua composição inteira em um único link compacto — quem abrir recebe seu código pronto para tocar!',
    lineNotes: [
      'VISUALIZER IS ALL exibe Osciloscópio + Espectro FFT + Piano Roll sincronizados ao vivo.',
      'A exportação .WAV renderiza todas as tracks, filtros, delay e reverb fora do tempo real sem chiados.',
    ],
    insertSnippet: `VISUALIZER IS ALL.
PRINT "Faixa pronta para exportar em .WAV!".`,
    fullExample: `*> Capítulo 10 — Showcase Final Pronto para .WAV
HEADER DIVISION.
  PROGRAM-ID. FINAL-SHOWCASE.
  TITLE IS "Final Sythm Studio".
  AUTHOR IS "Produtor Sythm".

CONFIG DIVISION.
  TEMPO IS 120 BPM.
  VISUALIZER IS ALL.
  CONTROL MASTER-FILTER IS SLIDER 1600 FROM 200 TO 5000.

PLAY DIVISION.
  TRACK DRUMS.
    PRINT "Mixagem final e visualizador ALL ativos!".
    PLAY EUCLIDEAN KICK 4 IN 16 FOR 0.25 BEATS.
    PLAY EUCLIDEAN SNARE 2 IN 8 FOR 0.5 BEATS.
  END-TRACK.

  TRACK CHORDS-FM.
    WAVE IS FM-KEYS.
    VOLUME IS 75.
    FILTER IS LOWPASS MASTER-FILTER HZ Q 2.
    REVERB IS 38 PERCENT.
    PLAY CHORDS Cmaj7 Am7 Fmaj7 G7 FOR 1 BEAT.
  END-TRACK.

  TRACK LEAD-BELL.
    WAVE IS PLUCK.
    VOLUME IS 68.
    DELAY IS 30 PERCENT TIME 0.25 SEC FEEDBACK 35 PERCENT.
    ARPEGGIATE Cmaj7 UP-DOWN FOR 0.25 BEATS.
    ARPEGGIATE Am7 UP FOR 0.25 BEATS.
  END-TRACK.
`,
  },
  {
    number: 11,
    title: 'Áudio Externo & Sampler',
    subtitle: 'Importar Áudio, PLAY SAMPLE & DSP',
    summary:
      'Carregue qualquer música ou stem (.mp3, .wav, .ogg, .m4a, .webm) pelo botão "Importar Áudio" no topo — ou crie um áudio instantâneo com "Gerar Demo Loop". Os arquivos ficam salvos localmente via IndexedDB e oferecem 3 modos: Áudio Base (PLAY SAMPLE), Converter em Código via Transcritor DSP ou Híbrido.',
    syntaxRules: [
      {
        pattern: 'Importar Áudio -> Escolher Arquivo | Gerar Demo Loop',
        explanation: 'Salva o .mp3/.wav no IndexedDB (ou gera "demo-rave-loop.wav" a 128 BPM) e analisa BPM, Escala, Bateria, Baixo e Melodia via DSP.',
      },
      {
        pattern: '3 Modos: Áudio Base | Converter em Código | Híbrido',
        explanation: 'Áudio Base reproduz o sample original; Converter em Código extrai 3 bandas de bateria + baixo + melodia para .sythm puro; Híbrido mixa os dois.',
      },
      {
        pattern: 'PLAY SAMPLE "<arquivo.mp3>" [RATE <N>] [OFFSET <S> SEC] FOR <B> BEATS.',
        explanation: 'Reproduz o áudio externo dentro de uma TRACK passando por VOLUME, FILTER, REVERB, DELAY, PAN e controles SLIDER ao vivo.',
      },
    ],
    proTip:
      'Para testar este capítulo sem subir nenhum arquivo do PC, clique em "Importar Áudio" na barra superior e aperte "Gerar Demo Loop" — ele salva "demo-rave-loop.wav" no IndexedDB!',
    lineNotes: [
      'O Transcritor DSP detecta BPM por picos de energia em sub-bandas, classifica hits em KICK/SNARE/HIHAT e extrai BAIXO/MELODIA via autocorrelação.',
      'Sliders CONTROL em VOLUME IS, FILTER IS e REVERB IS modulam o áudio externo em tempo real e também são renderizados na exportação .WAV!',
    ],
    insertSnippet: `TRACK AUDIO-BASE.
  VOLUME IS 85.
  FILTER IS LOWPASS 4200 HZ Q 1.6.
  REVERB IS 18 PERCENT.
  PLAY SAMPLE "demo-rave-loop.wav" RATE 1.0 OFFSET 0 SEC FOR 16 BEATS.
END-TRACK.`,
    fullExample: `*> Capítulo 11 — Sampler Externo + Mixagem com Código Sythm
*> Clique em "Importar Áudio" -> "Gerar Demo Loop" ou troque pelo nome do seu .mp3
HEADER DIVISION.
  PROGRAM-ID. SAMPLER-HYBRID-LAB.
  TITLE IS "Mixagem Audio Externo + Sythm".
  AUTHOR IS "Sythm Sampler Studio".

CONFIG DIVISION.
  TEMPO IS 128 BPM.
  SCALE IS A MINOR.
  VISUALIZER IS ALL.
  CONTROL VOL-SAMPLE IS SLIDER 82 FROM 0 TO 100.
  CONTROL FILTRO-SAMPLE IS SLIDER 4200 FROM 180 TO 8000.
  CONTROL REV-SAMPLE IS SLIDER 18 FROM 0 TO 100.
  CONTROL VOL-SYNTH IS SLIDER 72 FROM 0 TO 100.

PROCEDURES DIVISION.
  SECTION PADRAO-BAIXO.
    PLAY NOTES A1 A1 C2 G1 FOR 1 BEAT.
  END-SECTION.

PLAY DIVISION.
  TRACK AUDIO-ORIGINAL.
    VOLUME IS VOL-SAMPLE.
    FILTER IS LOWPASS FILTRO-SAMPLE HZ Q 1.8.
    REVERB IS REV-SAMPLE PERCENT.
    PRINT "Tocando sample externo com filtro, reverb e sliders ao vivo!".
    REPEAT 2 TIMES
      PLAY SAMPLE "demo-rave-loop.wav" RATE 1.0 OFFSET 0 SEC FOR 8 BEATS.
    END-REPEAT.
  END-TRACK.

  TRACK BATERIA-REFORCO.
    VOLUME IS VOL-SYNTH.
    REPEAT 4 TIMES
      PLAY EUCLIDEAN KICK 4 IN 16 FOR 0.25 BEATS.
    END-REPEAT.
  END-TRACK.

  TRACK BAIXO-ACIDO.
    WAVE IS ACID-BASS.
    VOLUME IS 64.
    FILTER IS LOWPASS 720 HZ Q 3.2.
    PERFORM PADRAO-BAIXO 4 TIMES.
  END-TRACK.
`,
  },
  {
    number: 12,
    title: 'DJ Remix, Speed-Up & Slicer',
    subtitle: 'RATE (Pitch), OFFSET SEC & Chopping',
    summary:
      'Transforme o Sythm em uma mesa de DJ / Hardtekk Remix! Use RATE para acelerar ou desacelerar o áudio (ex: RATE 1.15 sobe 128 BPM para 147 BPM) e OFFSET <S> SEC para pular intros, entrar direto no drop (ex: OFFSET 30 SEC em um .mp3 longo) ou fatiar trechos estilo Slicer / Stutter.',
    syntaxRules: [
      {
        pattern: 'RATE <0.25 a 4.0>',
        explanation: 'Muda velocidade e pitch do sample: RATE 1.15 acelera +15% (estilo Hardtekk / Nightcore); RATE 0.85 reduz para efeito Slowed.',
      },
      {
        pattern: 'OFFSET <Segundos> SEC',
        explanation: 'Define o segundo inicial dentro do áudio (ex: OFFSET 1.9 SEC para pegar o meio de um loop, ou OFFSET 30 SEC no refrão de uma faixa inteira).',
      },
      {
        pattern: 'Stutter Build-Up & Drop em SECTION',
        explanation: 'Encadeie fatias curtas subindo o RATE em degraus (1.10 -> 1.20 -> 1.30) antes de soltar o drop com PERFORM.',
      },
    ],
    proTip:
      'Para casar o BPM (beatmatch) ao usar RATE, multiplique o BPM original pelo fator: 128 BPM x 1.15 ≈ TEMPO IS 147 BPM (ou 135 x 1.15 = 155 BPM).',
    lineNotes: [
      'Se carregar uma música completa (ex: 3 minutos), aumente FOR <N> BEATS no PLAY SAMPLE e multiplique REPEAT/PERFORM nas tracks de bateria.',
      'Combine cortes curtos de OFFSET em sequência para repetir só o kick ou vocal criando um efeito Slicer antes do drop!',
    ],
    insertSnippet: `*> Stutter Build-Up acelerando o pitch antes do drop
PLAY SAMPLE "demo-rave-loop.wav" RATE 1.10 OFFSET 0.94 SEC FOR 1 BEAT.
PLAY SAMPLE "demo-rave-loop.wav" RATE 1.20 OFFSET 0.94 SEC FOR 1 BEAT.
PLAY SAMPLE "demo-rave-loop.wav" RATE 1.30 OFFSET 1.88 SEC FOR 2 BEATS.
PLAY SAMPLE "demo-rave-loop.wav" RATE 1.15 OFFSET 0 SEC FOR 8 BEATS.`,
    fullExample: `*> Capítulo 12 — DJ Remix Hardtekk: Speed-Up (RATE) + Slicer (OFFSET)
*> Gere "demo-rave-loop.wav" em Importar Áudio (ou ajuste o OFFSET para seu .mp3)
HEADER DIVISION.
  PROGRAM-ID. DJ-SLICER-HARDTEKK.
  TITLE IS "Speed-Up & Slicer Remix".
  AUTHOR IS "Sythm DJ Lab".

CONFIG DIVISION.
  TEMPO IS 147 BPM.
  SCALE IS A MINOR.
  VISUALIZER IS ALL.
  CONTROL VOL-DECK IS SLIDER 88 FROM 0 TO 100.
  CONTROL FILTRO-DJ IS SLIDER 4800 FROM 180 TO 9000.
  CONTROL VOL-KICK IS SLIDER 84 FROM 0 TO 100.

PROCEDURES DIVISION.
  SECTION DROP-HARDTEKK.
    PLAY EUCLIDEAN KICK 4 IN 16 FOR 0.25 BEATS.
  END-SECTION.

PLAY DIVISION.
  TRACK DECK-SLICER.
    VOLUME IS VOL-DECK.
    FILTER IS LOWPASS FILTRO-DJ HZ Q 2.0.
    PRINT "1) Intro + Fatiamento Slicer e Stutter Build-Up (RATE 1.10 -> 1.30)...".
    PLAY SAMPLE "demo-rave-loop.wav" RATE 1.15 OFFSET 0 SEC FOR 2 BEATS.
    PLAY SAMPLE "demo-rave-loop.wav" RATE 1.15 OFFSET 1.88 SEC FOR 2 BEATS.
    PLAY SAMPLE "demo-rave-loop.wav" RATE 1.10 OFFSET 0.94 SEC FOR 1 BEAT.
    PLAY SAMPLE "demo-rave-loop.wav" RATE 1.20 OFFSET 0.94 SEC FOR 1 BEAT.
    PLAY SAMPLE "demo-rave-loop.wav" RATE 1.30 OFFSET 2.81 SEC FOR 2 BEATS.
    PRINT "2) Drop Speed-Up a 147 BPM (128 x 1.15)!".
    PLAY SAMPLE "demo-rave-loop.wav" RATE 1.15 OFFSET 0 SEC FOR 8 BEATS.
  END-TRACK.

  TRACK HARDTEKK-KICK.
    VOLUME IS VOL-KICK.
    REVERB IS 10 PERCENT.
    PERFORM DROP-HARDTEKK 4 TIMES.
  END-TRACK.

  TRACK HIHAT-OFFBEAT.
    VOLUME IS 56.
    REPEAT 16 TIMES
      REST FOR 0.5 BEATS.
      PLAY DRUM HIHAT FOR 0.5 BEATS.
    END-REPEAT.
  END-TRACK.
`,
  },
];

export function SythmTutorialModal({
  isOpen,
  onInsertSnippet,
  onLoadFullExample,
  onClose,
}: SythmTutorialModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const [pageIndex, setPageIndex] = useState(0);
  const [insertedFeedback, setInsertedFeedback] = useState(false);

  const totalPages = TUTORIAL_CHAPTERS.length;
  const chapter = TUTORIAL_CHAPTERS[pageIndex] ?? TUTORIAL_CHAPTERS[0];

  const goPrev = useCallback(() => {
    setPageIndex((prev) => Math.max(0, prev - 1));
    setInsertedFeedback(false);
  }, []);

  const goNext = useCallback(() => {
    setPageIndex((prev) => Math.min(totalPages - 1, prev + 1));
    setInsertedFeedback(false);
  }, [totalPages]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goPrev, goNext]);

  const handleBackdropFallbackClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if ('closedBy' in HTMLDialogElement.prototype) return;
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const clickedInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!clickedInside) {
      dialog.close();
    }
  };

  const handleInsert = () => {
    onInsertSnippet(chapter.insertSnippet);
    setInsertedFeedback(true);
    window.setTimeout(() => setInsertedFeedback(false), 1800);
  };

  const handleLoadExample = () => {
    onLoadFullExample(chapter.fullExample, `Cap. ${chapter.number}: ${chapter.title}`);
    dialogRef.current?.close();
  };

  const progressPercent = ((pageIndex + 1) / totalPages) * 100;

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={handleBackdropFallbackClick}
      className="sythm-border sythm-bg-sidebar m-auto w-[min(1080px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border p-0 text-[var(--sythm-text-primary)] shadow-2xl"
    >
      <div className="flex h-[min(760px,88vh)] flex-col">
        {/* Book Cover / Header */}
        <header className="sythm-border sythm-bg-toolbar flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="sythm-border sythm-bg-lcd flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[var(--sythm-accent)] shadow-inner">
              <BookOpen className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id={titleId} className="truncate text-sm font-bold text-[var(--sythm-text-primary)]">
                  Sythm Tutorial — Manual Ilustrado da Linguagem
                </h2>
                <span className="sythm-border sythm-bg-lcd hidden sm:inline-flex rounded-full border px-2 py-0.5 font-mono-code text-[10px] font-semibold text-[var(--sythm-accent)]">
                  Cap. {String(chapter.number).padStart(2, '0')} / {totalPages}
                </span>
              </div>
              <p className="truncate text-xs text-[var(--sythm-text-secondary)]">
                Livro interativo paginado · Navegue pelas setas ← / → ou escolha um capítulo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar Sythm Tutorial"
            className="sythm-border sythm-bg-lcd inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-[var(--sythm-text-primary)] transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sythm-accent)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Fechar</span>
          </button>
        </header>

        {/* Progress Bar */}
        <div className="h-1 w-full shrink-0 bg-[var(--sythm-bg-lcd)]">
          <div
            className="h-full bg-[var(--sythm-accent)] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Main Book Body: Table of Contents + Two-Page Open Book Spread */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Chapter Index (Book Tabs) */}
          <aside
            aria-label="Índice dos capítulos"
            className="xcode-scroll sythm-border sythm-bg-window flex shrink-0 gap-1 overflow-x-auto border-b p-2.5 md:w-56 md:flex-col md:overflow-y-auto md:border-r md:border-b-0"
          >
            <div className="hidden px-2 py-1 text-[10px] font-bold tracking-wider text-[var(--sythm-text-secondary)] uppercase md:block">
              Sumário do Livro
            </div>
            {TUTORIAL_CHAPTERS.map((item, idx) => {
              const isCurrent = idx === pageIndex;
              return (
                <button
                  key={item.number}
                  type="button"
                  onClick={() => {
                    setPageIndex(idx);
                    setInsertedFeedback(false);
                  }}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition focus-visible:outline-2 focus-visible:outline-[var(--sythm-accent)] ${
                    isCurrent
                      ? 'border-[var(--sythm-accent)] bg-[var(--sythm-accent)]/15 font-semibold text-[var(--sythm-text-primary)]'
                      : 'border-transparent text-[var(--sythm-text-secondary)] hover:bg-[var(--sythm-bg-toolbar)]/60 hover:text-[var(--sythm-text-primary)]'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono-code text-[10px] font-bold ${
                      isCurrent
                        ? 'bg-[var(--sythm-accent)] text-white'
                        : 'sythm-border sythm-bg-lcd border text-[var(--sythm-text-secondary)]'
                    }`}
                  >
                    {String(item.number).padStart(2, '0')}
                  </span>
                  <span className="truncate">{item.title}</span>
                </button>
              );
            })}
          </aside>

          {/* Open Book Spread (Left Page = Concept & Syntax, Right Page = Live Code) */}
          <div className="xcode-scroll grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
            {/* LEFT BOOK PAGE */}
            <article className="xcode-scroll sythm-border flex flex-col justify-between gap-4 border-b bg-[var(--sythm-bg-sidebar)] p-5 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:shadow-[inset_-12px_0_24px_-18px_rgba(0,0,0,0.65)]">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--sythm-accent)]/40 bg-[var(--sythm-accent)]/12 px-2.5 py-0.5 font-mono-code text-[11px] font-semibold text-[var(--sythm-accent)]">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    <span>Capítulo {chapter.number}</span>
                  </span>
                  <span className="font-mono-code text-[11px] text-[var(--sythm-text-secondary)]">
                    {chapter.subtitle}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold tracking-tight text-[var(--sythm-text-primary)]">
                    {chapter.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--sythm-text-secondary)]">
                    {chapter.summary}
                  </p>
                </div>

                {/* Syntax Cards */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold tracking-wider text-[var(--sythm-text-secondary)] uppercase">
                    Comandos & Sintaxe
                  </h4>
                  {chapter.syntaxRules.map((rule) => (
                    <div
                      key={rule.pattern}
                      className="sythm-border rounded-lg border bg-[var(--sythm-bg-window)]/85 p-3"
                    >
                      <code className="block font-mono-code text-xs font-semibold text-[var(--sythm-syn-keyword)]">
                        {rule.pattern}
                      </code>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--sythm-text-secondary)]">
                        {rule.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro Tip Box */}
              <div className="rounded-xl border border-[#ffd60a]/30 bg-[#ffd60a]/8 p-3.5">
                <div className="flex items-start gap-2.5">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#ffd60a]" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-semibold text-[#ffd60a]">Dica de Produção</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--sythm-text-primary)] opacity-90">
                      {chapter.proTip}
                    </p>
                  </div>
                </div>
              </div>
            </article>

            {/* RIGHT BOOK PAGE */}
            <article className="xcode-scroll flex flex-col justify-between gap-4 bg-[var(--sythm-bg-window)] p-5 lg:overflow-y-auto lg:shadow-[inset_12px_0_24px_-18px_rgba(0,0,0,0.65)]">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-[var(--sythm-accent)]" aria-hidden="true" />
                    <h4 className="text-xs font-semibold tracking-wider text-[var(--sythm-text-secondary)] uppercase">
                      Exemplo Prático Comentado
                    </h4>
                  </div>
                  <span className="font-mono-code text-[11px] text-[var(--sythm-text-secondary)]">
                    Página {pageIndex + 1} · Prática
                  </span>
                </div>

                {/* Printed Code Sheet */}
                <pre className="xcode-scroll sythm-border sythm-bg-editor sythm-color-swatch max-h-72 overflow-auto rounded-xl border p-3.5 font-mono-code text-xs leading-5 text-[var(--sythm-text-primary)] shadow-inner">
                  <code>{chapter.fullExample.trimEnd()}</code>
                </pre>

                {/* Line Annotations */}
                <div className="sythm-border rounded-xl border bg-[var(--sythm-bg-sidebar)]/80 p-3.5">
                  <div className="mb-2 text-xs font-semibold text-[var(--sythm-text-primary)]">
                    O que acontece neste código:
                  </div>
                  <ul className="space-y-1.5 text-xs text-[var(--sythm-text-secondary)]">
                    {chapter.lineNotes.map((note) => (
                      <li key={note} className="flex items-start gap-2">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sythm-accent)]"
                          aria-hidden="true"
                        />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Practice Buttons */}
              <div className="sythm-border flex flex-wrap items-center gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={handleInsert}
                  className={`sythm-border inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    insertedFeedback
                      ? 'border-[#2f6f44] bg-[#1b2e22] text-[#7ae582]'
                      : 'sythm-bg-toolbar text-[var(--sythm-text-primary)] hover:opacity-90'
                  }`}
                >
                  {insertedFeedback ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-[var(--sythm-accent)]" aria-hidden="true" />
                  )}
                  <span>
                    {insertedFeedback ? 'Trecho inserido!' : 'Inserir Trecho no Editor'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadExample}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--sythm-accent)] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
                >
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span>Carregar Exemplo Completo e Testar</span>
                </button>
              </div>
            </article>
          </div>
        </div>

        {/* Book Pagination Footer */}
        <footer className="sythm-border sythm-bg-toolbar flex shrink-0 items-center justify-between gap-3 border-t px-5 py-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={pageIndex === 0}
            className="sythm-border sythm-bg-lcd inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-[var(--sythm-text-primary)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Página Anterior</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5" role="group" aria-label="Páginas do tutorial">
              {TUTORIAL_CHAPTERS.map((item, idx) => {
                const active = idx === pageIndex;
                return (
                  <button
                    key={item.number}
                    type="button"
                    onClick={() => {
                      setPageIndex(idx);
                      setInsertedFeedback(false);
                    }}
                    aria-label={`Ir para página ${idx + 1}: ${item.title}`}
                    aria-current={active ? 'page' : undefined}
                    className={`h-2.5 cursor-pointer rounded-full transition-all ${
                      active
                        ? 'w-7 bg-[var(--sythm-accent)]'
                        : 'w-2.5 bg-[var(--sythm-border)] hover:bg-[var(--sythm-text-secondary)]'
                    }`}
                  />
                );
              })}
            </div>
            <span className="font-mono-code text-xs font-semibold text-[var(--sythm-text-secondary)]">
              Página {pageIndex + 1} de {totalPages}
            </span>
          </div>

          {pageIndex < totalPages - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--sythm-accent)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
            >
              <span>Próxima Página</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#30d158] px-3.5 py-1.5 text-xs font-semibold text-[#0b1f10] transition hover:brightness-110"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Concluir Leitura</span>
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}
