# Contribuindo com o Sythm

Obrigado pelo interesse em contribuir com o **Sythm**! Seja reportando bugs, sugerindo novos comandos musicais, criando novos presets ou enviando Pull Requests no compilador e no motor Web Audio, toda ajuda é bem-vinda.

---

## Pré-requisitos

- **Node.js** `>= 20.0.0`
- **pnpm** `>= 9.0.0`

---

## Configurando o Ambiente Local

```bash
# 1. Instale as dependências do monorepo
pnpm install

# 2. Compile o núcleo e inicie backend (:3001) + frontend (:5173) em paralelo
pnpm dev
```

### Scripts Principais

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Compila `@sythm/core` e inicia `@sythm/backend` e `@sythm/frontend` em modo watch |
| `pnpm test` | Executa a suíte de testes unitários do `@sythm/core` via Vitest |
| `pnpm typecheck` | Executa `tsc --noEmit` em todos os pacotes do workspace |
| `pnpm build` | Compila `@sythm/core`, `@sythm/backend` e gera o bundle de produção do `@sythm/frontend` |
| `pnpm check` | Executa a pipeline completa de validação (`typecheck` + `test` + `build`) |

Antes de abrir um Pull Request, garanta que **`pnpm check`** passa sem erros nem warnings de tipo.

---

## Arquitetura do Projeto

O monorepo segue **Clean Architecture** no núcleo compilador (`packages/core`):

```text
packages/core/src/
├── domain/          # Entidades puras (Token, AST, ExecutionPlan) e Value Objects (NoteFrequency, ChordParser)
├── application/     # Portas (ILexer, IParser, IExecutionPlanner) e Casos de Uso (CompileSythmCodeUseCase)
└── infrastructure/  # CobolStyleLexer, CobolStyleParser, TimelineExecutionPlanner e DefaultPresets
```

- **Regra de dependência**: `domain` não importa `application` nem `infrastructure`; `application` depende apenas de `domain`; `infrastructure` implementa as portas definidas em `application`.
- **`apps/backend`**: API Fastify (`:3001`) que expõe `/api/health`, `/api/presets` e `/api/compile` reutilizando `@sythm/core`.
- **`apps/frontend`**: IDE React 19 + Tailwind CSS v4 + motor Web Audio (`WebAudioEngine.ts`, `SythmSynthGraph.ts`, `WavExporter.ts`, `AudioSampleStore.ts`, `AudioToSythmTranscriber.ts`).

---

## Como Adicionar Novos Recursos

### 1. Novo Comando ou Palavra-Chave na Linguagem `.sythm`
1. Declare o `TokenType` em `packages/core/src/domain/entities/Token.ts` e registre a palavra-chave em `packages/core/src/infrastructure/compiler/CobolStyleLexer.ts`.
2. Adicione o nó da AST em `packages/core/src/domain/entities/Ast.ts` (e tipos de evento em `ExecutionPlan.ts`, se aplicável).
3. Implemente o parsing em `packages/core/src/infrastructure/compiler/CobolStyleParser.ts`.
4. Processe a execução no timeline em `packages/core/src/infrastructure/compiler/TimelineExecutionPlanner.ts`.
5. Escreva testes unitários em `packages/core/tests/compiler.test.ts`.
6. Atualize o highlight/autocomplete em `apps/frontend/src/presentation/components/sythmEditorLanguage.ts` e, se relevante, os capítulos do `SythmTutorialModal.tsx`.

### 2. Novo Instrumento ou Efeito de Áudio
1. Adicione o timbre ou parâmetro no roteamento compartilhado em `apps/frontend/src/infrastructure/audio/SythmSynthGraph.ts`.
2. Garanta paridade entre reprodução em tempo real (`WebAudioEngine.ts`) e renderização offline (`WavExporter.ts`).

---

## Padrão de Commits e Pull Requests

Adote preferencialmente **Conventional Commits**:

- `feat:` nova funcionalidade (ex.: `feat(core): add glide/portamento statement`)
- `fix:` correção de bug (ex.: `fix(audio): prevent negative filter frequency ramp`)
- `docs:` documentação e tutoriais
- `refactor:` refatoração sem mudança de comportamento
- `test:` adição ou ajuste de testes

Ao abrir um PR:
- Preencha o template de Pull Request descrevendo motivação, alterações e testes executados.
- Inclua trechos `.sythm` de exemplo caso adicione nova sintaxe.
- Confirme que `pnpm check` passou localmente.
