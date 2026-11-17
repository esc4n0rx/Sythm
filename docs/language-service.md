# Serviço de linguagem (LSP no browser)

Código em `packages/core/src/language-service/`. É TypeScript puro, sem dependência de DOM/React, então roda no navegador, no backend e nos testes. O editor (`CodeEditor.tsx`) é só um cliente dele.

> Não é um servidor LSP via JSON-RPC: não há processo separado nem protocolo. As funções são chamadas diretamente, no mesmo processo do editor. Se um dia for preciso expor para VS Code/Neovim, dá para embrulhar estas mesmas funções num servidor LSP.

## Arquitetura

```
analyzer.ts      analyzeDocument(source) → DocumentModel  (tokens → símbolos → diagnósticos)
features.ts      getDefinition · getReferences · renameSymbol · getHover ·
                 getDocumentSymbols · getCodeActions · mergeDiagnostics · getDeclaredNames
keywordDocs.ts   documentação de ~50 palavras-chave (hover)
```

O `DocumentModel` é construído a partir dos **tokens do lexer**, não da AST. Por isso continua funcionando enquanto o usuário digita código incompleto ou com erro de sintaxe (o parser aborta no primeiro erro, o lexer não). O último resultado fica em cache por texto (`analyzeDocument` é chamado a cada tecla).

Posições: o serviço trabalha com **offsets** de caractere (`TextRange { start, end }`, `end` exclusivo); `line`/`column` são 1-based, como nos diagnósticos do compilador. `positionAt`/`offsetAt` convertem.

## Símbolos reconhecidos

| Tipo | Declaração | Referências |
| --- | --- | --- |
| `section` | `SECTION NOME.` ou `NOME SECTION.` | `PERFORM NOME` |
| `control` | `CONTROL NOME IS SLIDER ...` (também `DEFINE`/`SLIDER`) | qualquer identificador com esse nome (`VOLUME IS NOME.`, `FILTER ... NOME HZ`) |
| `track` | `TRACK NOME.` | – |

Nomes são comparados sem diferenciar maiúsculas e podem vir entre aspas (`SECTION "Refrão".`).

## Funcionalidades

| Recurso | Atalho no editor | API |
| --- | --- | --- |
| Autocomplete de `PERFORM`/controles pelo código real | `Ctrl+Space` | `getDeclaredNames` |
| Hover: símbolos (declaração, nº de usos, faixa do slider), notas (Hz/MIDI), acordes (notas), ~50 palavras-chave | passar o mouse | `getHover` |
| Ir para a definição | `F12`, `Ctrl+Clique` | `getDefinition` |
| Ver referências | `Shift+F12` | `getReferences` |
| Renomear SECTION/CONTROL em todo o arquivo | `F2` | `prepareRename`, `renameSymbol` |
| Quick-fixes | banner, `Ctrl+.` aplica o primeiro | `getCodeActions` |
| Diagnósticos semânticos | marcações de erro/gutter | `analyzeDocument().diagnostics`, `mergeDiagnostics` |
| Outline (SECTIONs, CONTROLs, TRACKs) | – (API pronta, sem UI ainda) | `getDocumentSymbols` |

### Diagnósticos semânticos

| Código | Severidade | Quando |
| --- | --- | --- |
| `undefined-section` | erro | `PERFORM X` sem `SECTION X` (traz sugestões "quis dizer") |
| `undefined-control` | erro | identificador não declarado em `VOLUME/TEMPO/REVERB/DELAY/DETUNE/PAN IS ...` e `FILTER IS <tipo> ...` |
| `duplicate-section` / `duplicate-control` | aviso | declaração repetida |

São calculados mesmo quando há erro de sintaxe em outro ponto. `mergeDiagnostics` remove os diagnósticos equivalentes do planner (mesma linha) para não aparecerem em dobro.

### Quick-fixes

- Seção/controle inexistente: **trocar por um nome parecido** (distância de edição) · **criar a SECTION** antes da `PLAY DIVISION` (cria `PROCEDURES DIVISION` se faltar) · **declarar o CONTROL** na `CONFIG DIVISION`.
- Duplicado: renomear com sufixo `-2`.
- Sintaxe: **adicionar `.`** após o último token do comando e **adicionar `END-TRACK.`/`END-REPEAT.`/`END-SECTION.`** no ponto onde o fecho era esperado.
- Se o diagnóstico do compilador estiver desatualizado em relação ao texto (o token na posição indicada mudou), nenhuma correção é oferecida, para não editar o lugar errado.

### Regras de rename

Aceita `[A-Za-z][A-Za-z0-9_-]*` que o lexer reconheça como identificador comum. Rejeita palavras reservadas (`BEAT`, `TEMPO`...), notas (`C4`), acordes (`Cmaj7`) e nomes já usados por outra SECTION/CONTROL. Nomes entre aspas mantêm as aspas. Mudar só a caixa do próprio nome é permitido.

## Mudanças em relação ao editor anterior

- `extractDeclaredSections`/`extractDeclaredControls` (regex) → símbolos do analisador.
- `HOVER_DOCS` (13 entradas, no frontend) → `KEYWORD_DOCS` (~50, no core).
- O quick-fix de "ponto final" **nunca funcionava** para o erro real: o parser aponta o *próximo* token (ex.: `END-TRACK.`), e o código antigo tentava corrigir essa linha, que já termina em ponto. O novo usa os tokens.
- O quick-fix antigo só oferecia uma correção; agora há até 3 por diagnóstico.

## Limitações conhecidas

- A deteção de `undefined-control` cobre só os parâmetros listados acima; um controle não declarado em outros lugares ainda é pego apenas pelo planner.
- Rename e referências não alcançam trechos que o lexer não tokeniza (comentários, conteúdo de strings).
- Sem completion para valores de `PATTERN`, `PLAY SAMPLE` além do que já existia.
- O outline (`getDocumentSymbols`) ainda não tem painel na UI.
- As interações do editor (F12, F2, Shift+F12, Ctrl+., Ctrl+Clique) têm typecheck, lint e build verificados, mas **não foram exercitadas em um navegador**; o serviço em si tem 28 testes.
