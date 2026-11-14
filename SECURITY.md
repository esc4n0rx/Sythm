# Política de Segurança

## Versões Suportadas

| Versão | Suporte de Segurança |
| --- | --- |
| `0.1.x` | Ativo |

---

## Como Reportar uma Vulnerabilidade

Se você identificar uma vulnerabilidade de segurança no compilador `@sythm/core`, na API `@sythm/backend` ou na IDE `@sythm/frontend`:

1. **Não** abra uma issue pública com detalhes de exploração.
2. Utilize a aba **Security Advisories** do repositório no GitHub (*Report a vulnerability*) ou entre em contato diretamente comigo.
3. Inclua passos para reproduzir, código `.sythm` ou payload HTTP mínimo (se aplicável) e impacto observado.

---

## Salvaguardas Embutidas na Arquitetura

O Sythm adota proteções defensivas por padrão durante compilação e execução musical:
- **Limite de Eventos e Recursão (`TimelineExecutionPlanner.ts`)**:
  - `MAX_EVENTS = 2000` impede travamentos ou consumo excessivo de memória causados por loops `REPEAT` / `PERFORM` extensos.
  - `MAX_PERFORM_DEPTH = 16` protege contra recursão infinita em chamadas entre blocos `SECTION` / `PERFORM`.
- **Execução Sem `eval`**: O compilador transforma o código `.sythm` via Lexer -> Parser -> AST -> `ExecutionPlan` tipado em JSON; nenhum trecho `.sythm` é avaliado como JavaScript arbitrário.
- **Armazenamento e Áudio 100% Locais no Cliente**:
  - Arquivos `.sythm`, pastas, configurações e temas ficam apenas no `localStorage` do navegador.
  - Áudios externos (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.webm`) são decodificados via `AudioContext` / `OfflineAudioContext` e persistidos apenas localmente no `IndexedDB` do usuário, sem upload automático para servidores externos.
- **Limites de Compartilhamento e `.WAV`**:
  - Links compartilháveis serializam somente texto de código `.sythm` (não enviam binários).
  - Exportação `.WAV` renderiza áudio offline localmente no navegador.
