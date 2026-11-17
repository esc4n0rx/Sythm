# Changelog

Todas as mudanças notáveis do projeto **Sythm** serão documentadas neste arquivo.

O formato segue o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e adota [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Não lançado]

### Segurança
- `SYTHM_AUTH_SECRET` (>= 32 caracteres) e `DATABASE_URL` agora são **obrigatórios em produção**; o backend se recusa a iniciar sem eles. Em desenvolvimento, usa-se um segredo efêmero (antes havia um segredo padrão fixo e público no código).
- Rate limiting global (`@fastify/rate-limit`) e limite mais estrito em `/api/auth/login` e `/api/auth/register`.
- Limites de entrada: `bodyLimit` de 1 MB (5 MB em `PUT /api/workspace`) e código `.sythm` limitado a 200.000 caracteres em `compile`/`share`.
- CORS por allowlist (`CORS_ORIGINS`); em produção, sem a variável, bloqueia cross-origin. Adicionado `@fastify/helmet`.
- Tokens: expiração padrão de 7 dias (antes 30), renovação via `POST /api/auth/refresh` e revogação via `POST /api/auth/logout-all` (campo `token_version`).
- Senhas: mínimo de 8 e máximo de 128 caracteres; hash `scrypt` assíncrono (não bloqueia mais o event loop); resposta de login com tempo constante quando o usuário não existe.
- `POST /api/friends/share` agora só permite compartilhar com amigos.

### Corrigido
- Sugestões "quis dizer" do serviço de linguagem não casavam nomes em minúsculas com nomes em maiúsculas.
- Quick-fix de "ponto final" ausente nunca era oferecido para o erro real (o parser aponta o token seguinte); agora usa os tokens e também corrige `END-TRACK`/`END-REPEAT`/`END-SECTION` no ponto certo.

### Alterado
- Autocomplete de `PERFORM` e de controles usa os símbolos do analisador em vez de regex.
- **Persistência migrada de arquivo JSON para PostgreSQL** (driver `pg`, migrations versionadas em `apps/backend/src/infrastructure/db/migrations.ts`). Importador do banco legado: `pnpm --filter @sythm/backend import:json`.
- Validação de requisições com `zod`; erros de domínio retornam status HTTP corretos (409 duplicado, 403, 404...).
- Frontend: sessão renovada ao abrir o app; falhas de rede não deslogam mais o usuário (só resposta 401).

### Adicionado
- **`COPY "arquivo.sythm".`**: inclui outro arquivo do projeto (`ProjectStorage`) no ponto da instrução, com `COPY` aninhado (máx. 8), detecção de ciclos e arquivo inexistente. Diagnósticos, playhead e sliders continuam nas linhas do arquivo aberto. `F12`/`Ctrl+Clique` abre o arquivo incluído, e o editor reconhece SECTION/CONTROL declarados nas bibliotecas (autocomplete, hover, sem falsos erros). Veja `docs/copy.md`.
- Vitest no frontend (primeiros testes da app) e `ControlDescriptor.sourceFile`.
- **Serviço de linguagem no `@sythm/core`** (`analyzeDocument`, `getHover`, `getDefinition`, `getReferences`, `renameSymbol`, `getCodeActions`, `mergeDiagnostics`...) e integração no editor: `F12`/`Ctrl+Clique` ir para a definição, `Shift+F12` referências, `F2` renomear SECTION/CONTROL, `Ctrl+.` quick-fix, hover com ~50 palavras-chave, notas e acordes, e diagnósticos semânticos (`PERFORM` de seção inexistente, controle não declarado, duplicados) com sugestões "quis dizer" e criação automática de SECTION/CONTROL. Veja `docs/language-service.md`.
- Testes do backend (`@sythm/backend`): configuração, tokens, rotas HTTP e integração com Postgres (`TEST_DATABASE_URL`).
- ESLint (flat config) e Prettier; CI agora roda lint e testes do backend com serviço Postgres.
- `docker-compose.yml` com Postgres local e `apps/backend/.env.example`.
- Pasta `docs/` com documentação do backend e registro de decisões.

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
