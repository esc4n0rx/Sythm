# `COPY`: reaproveitar código entre arquivos

Inspirado no `COPY` do COBOL: inclui o conteúdo de outro arquivo do projeto no ponto onde a instrução aparece. Serve para bibliotecas de bateria, progressões, controles e presets de timbre.

## Sintaxe

```cobol
COPY "bateria.sythm".      *> com aspas (aceita espaços no nome)
COPY bateria.              *> sem aspas: só letras, números, "_" e "-"
COPY "Biblioteca/bateria". *> restringe à pasta "Biblioteca"
```

- A instrução deve estar **sozinha na linha** (um comentário `*>` no final é aceito). `COPY "x". REST FOR 1 BEAT.` na mesma linha **não** é reconhecido.
- O nome é resolvido entre os **arquivos do projeto** (`ProjectStorage`): com ou sem `.sythm`, sem diferenciar maiúsculas.
- Havendo arquivos com o mesmo nome em pastas diferentes, vale o da **pasta do arquivo aberto**; `Pasta/arquivo` força uma pasta.
- Um arquivo não pode incluir a si mesmo.

## Semântica

É uma **inclusão textual**: o conteúdo substitui a linha do `COPY` antes de o compilador rodar. Portanto o arquivo incluído pode ser:

- um fragmento sem divisão, para usar dentro de `CONFIG DIVISION` ou de uma `TRACK`;
- ou um trecho com sua própria `PROCEDURES DIVISION.` (o parser aceita divisões repetidas).

Exemplo:

```cobol
*> bateria.sythm
PROCEDURES DIVISION.
  GROOVE SECTION.
    PLAY DRUMS KICK SNARE FOR 0.5 BEATS.
  END-SECTION.
```

```cobol
*> musica.sythm
CONFIG DIVISION.
  TEMPO IS 120 BPM.
  COPY "controles.sythm".   *> CONTROL VOL-DRUMS IS SLIDER ...

COPY "bateria.sythm".

PLAY DIVISION.
  TRACK DRUMS.
    VOLUME IS VOL-DRUMS.
    PERFORM GROOVE 2 TIMES.
  END-TRACK.
```

`COPY` pode ser aninhado (profundidade máxima **8**) e o total expandido é limitado a **20.000 linhas**.

## Erros e numeração de linhas

Os diagnósticos e o playhead sempre usam as **linhas do arquivo aberto**:

| Situação | O que aparece |
| --- | --- |
| Arquivo não encontrado | erro na linha do `COPY` |
| `COPY` circular (inclusive o arquivo incluindo a si mesmo) | erro na linha do `COPY`, com a cadeia `a → b → a` |
| Erro de sintaxe/semântica dentro do arquivo incluído | erro na linha do `COPY`, mensagem prefixada com `[arquivo.sythm:linha]` |
| Eventos tocando (playhead) e sliders declarados no arquivo incluído | aparecem na linha do `COPY` |
| Qualquer `COPY` com erro | a compilação falha e não gera plano |

Controles declarados em arquivo incluído mostram o slider ao vivo na linha do `COPY`, mas o valor **não é reescrito no código** (o `ControlDescriptor.sourceFile` impede a edição). Para mudar o padrão, edite o arquivo da biblioteca.

## Editor

| Recurso | Comportamento |
| --- | --- |
| `F12` / `Ctrl+Clique` no nome do `COPY` | abre o arquivo incluído |
| `F12` em `PERFORM` ou controle declarado num arquivo incluído | abre o arquivo na linha da declaração |
| `Shift+F12` | lista usos locais e a declaração (no outro arquivo, como `arquivo:linha`) |
| Hover no `COPY` | mostra quantas linhas inclui e quais SECTION/CONTROL declara |
| Autocomplete | `COPY ` sugere os arquivos do projeto; `PERFORM` e controles incluem os símbolos das bibliotecas |
| Diagnóstico `unresolved-copy` | sugere o arquivo com nome parecido (quick-fix "Trocar por ...") |
| Aviso de duplicado | quando o arquivo redeclara uma SECTION/CONTROL que já vem de um `COPY` |
| `F2` (renomear) | **não** renomeia símbolos declarados em outro arquivo |

Se algum `COPY` não for resolvido (ou não houver projeto), os erros "seção/controle não encontrado" são **suprimidos**: o editor não consegue afirmar que o nome é indefinido.

## Como funciona

1. `expandCopies(source, resolveCopy, rootName)` (`packages/core/.../CopyPreprocessor.ts`) substitui cada `COPY` e registra a origem (arquivo, linha) de cada linha resultante.
2. O compilador roda sobre o texto expandido.
3. `remapCompilationResult` traduz as linhas de diagnósticos, eventos, logs e controles de volta para o arquivo aberto.
4. `compileSythmCode(source, { resolveCopy, rootName })` faz tudo isso; sem `COPY` no texto, o caminho é idêntico ao anterior.
5. No frontend, `createProjectCopyContext` (`copyResolver.ts`) monta o `resolveCopy` a partir dos arquivos do workspace. A expansão acontece **no cliente**, antes de chamar `/api/compile`, porque só o navegador conhece os arquivos; o backend recebe o texto já expandido.
6. O serviço de linguagem (`analyzeDocument(source, context)`) analisa os arquivos incluídos para conhecer seus símbolos.

## Limitações

- O backend, sozinho (`POST /api/compile` com um `COPY` no código), não resolve nada: o `COPY` vira erro. A expansão é responsabilidade do cliente.
- **Compartilhar por URL** envia só o arquivo aberto; quem abrir o link verá erro de `COPY`. O workspace na nuvem leva todos os arquivos, então funciona.
- Os painéis de **tokens e AST** (Debug) mostram posições do texto expandido.
- Não há `COPY ... REPLACING` (parametrização) nem importação seletiva de símbolos.
- Sem verificação de colisões entre bibliotecas além do aviso de SECTION/CONTROL duplicados.
- A interação do editor (F12 entre arquivos, autocomplete) foi verificada por testes de unidade e build, **não** exercitada manualmente num navegador.
