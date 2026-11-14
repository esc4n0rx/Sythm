# Changelog

Todas as mudanças notáveis do projeto **Sythm** serão documentadas neste arquivo.

O formato segue o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e adota [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [0.1.0] - 2026-11-14

### Adicionado
- **Compilador Declarativo `@sythm/core`** com inspiração em COBOL e arquitetura limpa:
  - Divisões `HEADER DIVISION.`, `CONFIG DIVISION.`, `PROCEDURES DIVISION.` e `PLAY DIVISION.`
  - Comandos musicais `PLAY NOTE`, `PLAY NOTES`, `PLAY CHORD`, `PLAY CHORDS`, `ARPEGGIATE` (`UP`, `DOWN`, `UP-DOWN`, `RANDOM`), `PLAY DRUM`, `PLAY DRUMS`, `PLAY EUCLIDEAN`, `REST` e `PAUSE`
  - Teoria musical integrada (`ChordParser`, `NoteFrequency`, `SCALE IS <ROOT> <MODE>`)
  - Blocos estruturais `TRACK ... END-TRACK.`, `SECTION ... END-SECTION.`, `PERFORM ... N TIMES.` e `REPEAT ... TIMES ... END-REPEAT.`
  - Efeitos e modulação por track: `FILTER` (`LOWPASS`, `HIGHPASS`, `BANDPASS` com `Q`), `SWEEP`, `LFO`, `ENVELOPE` (ADSR), `DELAY`, `REVERB`, `DETUNE` e `PAN`
  - Controles interativos em tempo real estilo Strudel: `CONTROL <NOME> IS SLIDER <Init> FROM <Min> TO <Max>.` e `SLIDER` inline
  - Suporte a áudio externo com `PLAY SAMPLE "<arquivo>" [RATE <N>] [OFFSET <S> SEC] FOR <B> BEATS.`
  - Proteções `MAX_EVENTS = 2000` e `MAX_PERFORM_DEPTH = 16` + 7 presets iniciais em `DefaultPresets`
- **Motor Web Audio Studio & IDE Web (`@sythm/frontend`)**:
  - 4 formas de onda clássicas (`SINE`, `TRIANGLE`, `SQUARE`, `SAW`) + 5 sintetizadores compostos (`FM-KEYS`, `ACID-BASS`, `SUB-808`, `PLUCK`, `PAD-WARM`)
  - Drum Machine sintetizada de 10 peças (`KICK`, `SNARE`, `HIHAT`, `OPEN-HIHAT`, `CLAP`, `TOM`, `RIM`, `COWBELL`, `CRASH`, `PERC`)
  - Track Mixer ao vivo com Mute/Solo por pista e modulação em tempo real sem reiniciar a reprodução
  - Visualizador triplo em tempo real (`SCOPE` osciloscópio, `SPECTRUM` FFT e `PIANOROLL` interativo)
  - Importador de Áudio Externo (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.webm`) com persistência local em `IndexedDB`, botão **Gerar Demo Loop** (`demo-rave-loop.wav`) e **Transcritor DSP** (`AudioToSythmTranscriber`) nos modos **Áudio Base**, **Converter em Código** e **Híbrido**
  - Exportação offline em `.WAV` estéreo via `OfflineAudioContext` (`WavExporter`)
  - Organização de arquivos e pastas virtuais na Sidebar + compartilhamento compacto por URL
  - Configurações avançadas com 7 temas pré-definidos (incluindo *Xcode Dark* e *VS Code Dark+*) e editor de tema personalizado
  - **Sythm Tutorial** em formato de livro interativo paginado com 12 capítulos e carregamento direto de exemplos no editor
- **API HTTP (`@sythm/backend`)**:
  - Servidor Fastify 5 com rotas `GET /api/health`, `GET /api/presets` e `POST /api/compile`
