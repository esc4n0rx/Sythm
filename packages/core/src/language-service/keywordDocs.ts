export interface KeywordDoc {
  readonly title: string;
  readonly syntax: string;
  readonly description: string;
}

/** Documentação de hover por palavra-chave (chave em MAIÚSCULAS). */
export const KEYWORD_DOCS: Readonly<Record<string, KeywordDoc>> = {
  // --- Estrutura ---
  HEADER: {
    title: 'HEADER DIVISION',
    syntax: 'HEADER DIVISION.\n  PROGRAM-ID. <NOME>.\n  TITLE. "<texto>".\n  AUTHOR. "<texto>".',
    description: 'Metadados do programa.',
  },
  CONFIG: {
    title: 'CONFIG DIVISION',
    syntax: 'CONFIG DIVISION.\n  TEMPO IS <BPM> BPM.\n  WAVE IS <FORMA>.\n  SCALE IS <RAIZ> <MODO>.',
    description: 'Configurações globais: andamento, timbre padrão, escala, visualizador e CONTROLs.',
  },
  PROCEDURES: {
    title: 'PROCEDURES DIVISION',
    syntax: 'PROCEDURES DIVISION.\n  <NOME> SECTION.\n    ...\n  END-SECTION.',
    description: 'Declara sub-rotinas reutilizáveis (SECTION) chamadas com PERFORM.',
  },
  PLAY: {
    title: 'PLAY',
    syntax: 'PLAY NOTE|NOTES|CHORD|CHORDS|DRUM|DRUMS|SAMPLE|EUCLIDEAN ... FOR <N> BEATS.',
    description: 'Toca notas, acordes, tambores ou samples. Também nomeia a PLAY DIVISION, onde ficam as TRACKs.',
  },
  TRACK: {
    title: 'TRACK',
    syntax: 'TRACK <NOME>.\n  ...\nEND-TRACK.',
    description: 'Faixa independente. Todas as TRACKs de uma PLAY DIVISION tocam em paralelo.',
  },
  SECTION: {
    title: 'SECTION',
    syntax: '<NOME> SECTION.\n  ...\nEND-SECTION.',
    description: 'Sub-rotina reutilizável na PROCEDURES DIVISION. Chame com PERFORM.',
  },
  PERFORM: {
    title: 'PERFORM',
    syntax: 'PERFORM <SECTION> [<N> TIMES].',
    description: 'Executa uma SECTION declarada na PROCEDURES DIVISION.',
  },
  COPY: {
    title: 'COPY',
    syntax: 'COPY "arquivo.sythm".',
    description: 'Inclui o conteúdo de outro arquivo do projeto neste ponto (como o COPY do COBOL). Deve ficar sozinho na linha. Útil para bibliotecas de bateria, progressões e presets.',
  },
  REPEAT: {
    title: 'REPEAT',
    syntax: 'REPEAT <N> TIMES.\n  ...\nEND-REPEAT.',
    description: 'Repete o bloco N vezes.',
  },

  // --- Notas e ritmo ---
  NOTE: {
    title: 'PLAY NOTE',
    syntax: 'PLAY NOTE <NOTA> FOR <N> BEATS.',
    description: 'Toca uma nota (ex.: C4, F#5, Eb2) pela duração indicada.',
  },
  NOTES: {
    title: 'PLAY NOTES',
    syntax: 'PLAY NOTES <N1> <N2> ... FOR <N> BEATS.',
    description: 'Toca uma sequência de notas, cada uma com a duração indicada.',
  },
  CHORD: {
    title: 'PLAY CHORD',
    syntax: 'PLAY CHORD <CIFRA> FOR <N> BEATS.',
    description: 'Toca um acorde a partir da cifra (Cmaj7, F#m7, Bb...).',
  },
  CHORDS: {
    title: 'PLAY CHORDS',
    syntax: 'PLAY CHORDS <C1> <C2> ... FOR <N> BEATS.',
    description: 'Toca uma sequência de acordes.',
  },
  DRUM: {
    title: 'PLAY DRUM',
    syntax: 'PLAY DRUM <KICK|SNARE|HIHAT|...> FOR <N> BEATS.',
    description: 'Toca uma peça da bateria sintetizada.',
  },
  DRUMS: {
    title: 'PLAY DRUMS',
    syntax: 'PLAY DRUMS <D1> <D2> ... FOR <N> BEATS.',
    description: 'Toca uma sequência de peças da bateria.',
  },
  REST: {
    title: 'REST',
    syntax: 'REST FOR <N> BEATS.',
    description: 'Pausa pela duração indicada.',
  },
  PAUSE: {
    title: 'PAUSE',
    syntax: 'PAUSE FOR <N> BEATS.',
    description: 'Sinônimo de REST.',
  },
  EUCLIDEAN: {
    title: 'PLAY EUCLIDEAN',
    syntax: 'PLAY EUCLIDEAN <DRUM|NOTA> <PULSOS> IN <PASSOS> FOR <N> BEATS.',
    description: 'Gera ritmo euclidiano (algoritmo de Bjorklund), distribuindo os pulsos uniformemente.',
  },
  ARPEGGIATE: {
    title: 'ARPEGGIATE',
    syntax: 'ARPEGGIATE <ACORDE> UP | DOWN | UP-DOWN | RANDOM FOR <N> BEATS.',
    description: 'Quebra um acorde em sequência arpejada.',
  },
  SAMPLE: {
    title: 'PLAY SAMPLE',
    syntax: 'PLAY SAMPLE "<arquivo>" [RATE <N>] [OFFSET <S> SEC] FOR <N> BEATS.',
    description: 'Toca um áudio importado (IndexedDB), sincronizado com os efeitos da track.',
  },
  PATTERN: {
    title: 'PATTERN',
    syntax: 'PATTERN <DRUM|NOTA> IS "x..x..x." [STEP <N> BEATS | FOR <N> BEATS].',
    description: 'Step sequencer inline: x = normal, X/* = acento, o = ghost, ./- = pausa.',
  },

  // --- Configuração musical ---
  TEMPO: {
    title: 'TEMPO',
    syntax: 'TEMPO IS <20..400> BPM.',
    description: 'Define o andamento. Aceita um CONTROL ou SLIDER inline.',
  },
  BPM: {
    title: 'BPM',
    syntax: 'TEMPO IS <N> BPM.',
    description: 'Batidas por minuto (20 a 400).',
  },
  SCALE: {
    title: 'SCALE',
    syntax: 'SCALE IS <RAIZ> MAJOR | MINOR | DORIAN | PHRYGIAN | PENTATONIC | BLUES ...',
    description: 'Trava as notas tocadas na escala escolhida.',
  },
  TRANSPOSE: {
    title: 'TRANSPOSE',
    syntax: 'TRANSPOSE <N> SEMITONES.',
    description: 'Transpõe as notas seguintes pelo número de semitons.',
  },
  VISUALIZER: {
    title: 'VISUALIZER',
    syntax: 'VISUALIZER IS ALL | SCOPE | SPECTRUM | PIANOROLL | OFF.',
    description: 'Escolhe o visualizador em tempo real.',
  },

  // --- Timbre e efeitos ---
  WAVE: {
    title: 'WAVE',
    syntax: 'WAVE IS SINE | TRIANGLE | SQUARE | SAW.',
    description: 'Forma de onda do oscilador.',
  },
  INSTRUMENT: {
    title: 'INSTRUMENT',
    syntax: 'INSTRUMENT IS FM-KEYS | ACID-BASS | SUB-808 | PLUCK | PAD-WARM.',
    description: 'Instrumento sintetizado composto.',
  },
  VOLUME: {
    title: 'VOLUME',
    syntax: 'VOLUME IS <0..100> | <CONTROL>.',
    description: 'Volume da track (0..1 ou 0..100).',
  },
  FILTER: {
    title: 'FILTER',
    syntax: 'FILTER IS LOWPASS | HIGHPASS | BANDPASS <HZ> HZ [Q <N>].',
    description: 'Filtro da track (20 a 20000 Hz).',
  },
  SWEEP: {
    title: 'SWEEP',
    syntax: 'SWEEP FROM <HZ> TO <HZ> OVER <N> BEATS.',
    description: 'Varre a frequência de corte do filtro ao longo do tempo.',
  },
  LFO: {
    title: 'LFO',
    syntax: 'LFO IS ON RATE <HZ> DEPTH <HZ>.',
    description: 'Oscilador de baixa frequência modulando o filtro.',
  },
  ENVELOPE: {
    title: 'ENVELOPE',
    syntax: 'ENVELOPE ATTACK <S> SEC DECAY <S> SEC SUSTAIN <%> PERCENT RELEASE <S> SEC.',
    description: 'Envelope ADSR do amplificador.',
  },
  DELAY: {
    title: 'DELAY',
    syntax: 'DELAY IS <%> PERCENT TIME <S> SEC FEEDBACK <%> PERCENT. | DELAY IS OFF.',
    description: 'Eco com tempo e realimentação.',
  },
  REVERB: {
    title: 'REVERB',
    syntax: 'REVERB IS <%> PERCENT. | REVERB IS OFF.',
    description: 'Reverberação (0 a 100%).',
  },
  DETUNE: {
    title: 'DETUNE',
    syntax: 'DETUNE IS <0..100> CENTS. | DETUNE IS OFF.',
    description: 'Desafina osciladores em unison para dar espessura.',
  },
  PAN: {
    title: 'PAN',
    syntax: 'PAN IS LEFT|RIGHT <%> PERCENT. | PAN IS CENTER.',
    description: 'Posição estéreo da track.',
  },

  // --- Controles ---
  CONTROL: {
    title: 'CONTROL (Slider)',
    syntax: 'CONTROL <NOME> IS SLIDER <PADRÃO> FROM <MIN> TO <MAX>.',
    description: 'Declara um slider em tempo real, no editor e no Track Mixer. Use o NOME em VOLUME, FILTER, REVERB etc.',
  },
  SLIDER: {
    title: 'SLIDER',
    syntax: '... IS SLIDER <PADRÃO> FROM <MIN> TO <MAX>.',
    description: 'Slider inline direto no parâmetro, ou parte da declaração de um CONTROL.',
  },

  // --- Geração e automação ---
  MAYBE: {
    title: 'MAYBE',
    syntax: 'MAYBE <0..100> PERCENT <COMANDO>.',
    description: 'Executa o comando de forma probabilística a cada ciclo.',
  },
  CHOOSE: {
    title: 'CHOOSE ONE OF',
    syntax: 'PLAY CHOOSE ONE OF (C4, E4, G4) FOR <N> BEATS.',
    description: 'Escolhe aleatoriamente uma nota ou tambor da lista a cada ciclo.',
  },
  RAMP: {
    title: 'RAMP / AUTOMATE',
    syntax: 'RAMP <FILTER|VOLUME|PAN|REVERB|DELAY|TEMPO> FROM <A> TO <B> OVER <N> BEATS.',
    description: 'Automatiza um parâmetro continuamente ao longo de N beats.',
  },
  AUTOMATE: {
    title: 'AUTOMATE / RAMP',
    syntax: 'AUTOMATE <PARAM> FROM <A> TO <B> OVER <N> BEATS.',
    description: 'Alias de RAMP.',
  },
  HUMANIZE: {
    title: 'HUMANIZE',
    syntax: 'HUMANIZE <N> MS [VELOCITY <%> PERCENT]. | HUMANIZE OFF.',
    description: 'Micro-variações orgânicas de tempo e volume.',
  },
  SWING: {
    title: 'SWING',
    syntax: 'SWING IS <0..100> PERCENT. | SWING OFF.',
    description: 'Atrasa os contratempos para criar groove.',
  },

  // --- Saída ---
  PRINT: {
    title: 'PRINT',
    syntax: 'PRINT "<mensagem>".',
    description: 'Escreve uma mensagem no console musical, sincronizada ao beat.',
  },
  DISPLAY: {
    title: 'DISPLAY',
    syntax: 'DISPLAY "<mensagem>".',
    description: 'Sinônimo de PRINT.',
  },
};

export function getKeywordDoc(word: string): KeywordDoc | null {
  const key = word.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(KEYWORD_DOCS, key) ? KEYWORD_DOCS[key]! : null;
}
