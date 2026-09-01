# Arquitectura del compilador `.bel`

`src/compiler.ts` transforma archivos `.bel` (TypeScript + JSX + directivas de
Belzium) en TypeScript puro con render functions. Es un **lexer de un solo
pase y cero dependencias** que construye un AST de template y luego lo baja
(a "lowering") a llamadas al runtime (`h()`/`text()`).

## Flujo general

```
source .bel  ──ASTBuilder──▶  template-AST  ──generate()──▶  string JS
                              (nodes.ts)      (codegen.ts)    h()/text()
```

`compile(source, options)` hace cuatro pasos:

1. **Parseo** (`new ASTBuilder(source).build()`): recorre el archivo y produce
   un AST de template (`ProgramNode`). El código TypeScript que no es template
   pasa sin modificar como `PassthroughNode`.
2. **Lowering** (`generate(ast)`): convierte el AST en render functions usando
   `h(...)`/`text(...)`.
3. **Selectores** (`injectSelectors`): `@Component()`/`@UI()` sin selector se
   convierten en `@Component({ selector: "kebab-name" })` (regex sobre el nombre
   de clase; un selector explícito se respeta).
4. **Imports**: detecta los nombres del runtime usados en el archivo
   (`RUNTIME_APIS`) y antepone `import { ... } from <importPath>`.

## La capa de expression

Cualquier fragmento JS interpolado dentro de `{}` se modela con un único tipo
`ExpressionNode`:

- `type: "Expression"` (discriminador).
- `role`: para qué se usa el fragmento (ver abajo).
- `source`: el texto JS crudo ya balanceado (sin las llaves).

El **parser clasifica el rol una sola vez** (porque es quien conoce el nombre
del atributo o el tag de directiva). El **lowering consume el slot
semántico** (`role` + `source`) y no necesita conocer la sintaxis del source.

Roles:

| Role | Uso | Emisión |
| --- | --- | --- |
| `text` | `{expr}` interpolación de texto | `text(String(expr))` |
| `attrValue` | `x={expr}` atributo no-evento | `x: expr` |
| `eventHandler` | `onX={expr}` (nombre empieza por `on`) | `onX: expr` |
| `spread` | `{...expr}` spread de props | `...expr` |
| `condition` | `<if condition={expr}>` | `(expr) ? ...` |
| `iterable` | `<for each={x of expr}>` | `expr.map((x) => ...)` |
| `key` | `<for key={expr}>` | `key: expr` |
| `discriminant` | `<switch value={expr}>` | `switch (expr)` |
| `caseTest` | `<case test={expr}>` | `case expr:` |

Nota: la distinción `Expression` (texto) vs `ExpressionAttribute` vs
`EventHandler` se resuelve con el campo `role` sobre un único nodo, en vez de
tener tres tipos de nodo separados.

## Mecánica del parser

`ASTBuilder.build()` itera carácter a carácter:

- Si encuentra `<` y `canStartJsx()` es verdadero, parsea un árbol JSX.
- Si no, copia el código tal cual como `PassthroughNode` y actualiza el estado
  con `feed()`.

`feed()` mantiene el **último carácter significativo** (`lastSig`), el anterior
(`prev2`) y la última palabra (`lastWord`, con la palabra en curso pendiente en
`wordBuffer`), para distinguir el `<` de comparación del `<` de JSX.

### Heurística `canStartJsx()`

- `<` seguido de `/` nunca es JSX (cierre); `<` seguido de un carácter no
  alfabético/`$`/`_`/`>` tampoco.
- Después de una flecha `=>` (`prev2` = `=`, `lastSig` = `>`) siempre es JSX.
- `a < b` es comparación: si `lastSig` es `>` o un identificador que NO es una
  palabra clave, no es JSX.
- `<` solo inicia JSX tras una palabra clave que espera una expresión
  (`return`, `throw`, `case`, `new`, `of`, `else`, `typeof`, ...).
- Tras un identificador, solo es JSX si ese identificador está en
  `KEYWORD_PRECEDE_EXPRESSION`.
- Gotcha: tras `return`, `lastSig` es la letra final `"n"`; la palabra en curso
  está en `wordBuffer`, así que el check usa `this.wordBuffer || this.lastWord`.

## Parseo de JSX

`parseElement()` lee: nombre de tag, atributos, cierre `>` o `/>`, hijos y tag
de cierre.

- **Tipo**: nombre en PascalCase o que contiene `.` → componente (`h(PascalCase, ...)`);
  minúscula → elemento (`h("div", ...)`).
- **Atributos** (`parseAttributes`):
  - `onX={expr}` → `Expression { role:"eventHandler" }` (nombre empieza por `on`).
  - `x={expr}` → `Expression { role:"attrValue" }`.
  - `x="text"` → `StringValueNode`.
  - `x` sin valor → `true`.
  - `{...this.props}` → `SpreadAttribute` con `Expression { role:"spread" }`.
  - `className` → `class`; `htmlFor` → `for`.
- **Hijos** (`parseChildren`), en orden:
  - Elemento hijo → `parseElement()`.
  - Fragmento `<>...</>` → se aplana en el array de hijos.
  - `{expr}` → `Expression { role:"text" }`.
  - Texto crudo → `cleanText` → `StringValueNode` de texto (se emite `text("...")`).

### `cleanText`

Colapsa los saltos de línea y su indentación a un solo espacio, pero conserva
los espacios intencionales de una misma línea. El texto compuesto solo de
espacios se ignora.

## Directivas

`parseElement()` detecta tag names reservados (`if`, `for`, `switch`) y despacha:

| Sintaxis | Codegen |
| --- | --- |
| `<if condition={c}>...</if>` | `...((c) ? [...] : [...])` (soporta `<else-if>`) |
| `<for each={x of xs} key={k}>...</for>` | `...xs.map((x) => h("li", { key: k }, [...]))` |
| `<switch value={e}><case test={"v"}>...</case><default>...</default></switch>` | `...(() => { switch (e) { case "v": return [...]; default: return [...]; } })()` |
| `<Clickable enabled={enabled}>...</Clickable>` | `h(Clickable, { enabled: enabled }, [...])` |

Detalles:

- `attachElseChain()` usa look-ahead para encadenar `<else-if>`/`<else>` como
  hermanos después de `</if>`, mutando `alternate` del nodo padre.
- `parseForElement()` parsea `each={item of iterable}` con regex y extrae
  `variable`/`iterable`/`key` como campos estructurados de `ForDirectiveNode`.
  Esta es la única regla sintáctica de `item of items`; vive en el parser, no en
  el lowering. Con múltiples hijos, el lowering los envuelve en un `div`.
- `parseSwitchElement()` reutiliza `parseElement()` para `<case>` y `<default>`
  y extrae `test={}` de cada `<case>` como `Expression { role:"caseTest" }`.
- Componentes custom (PascalCase) se parsean como elementos JSX estándar.

## Lowering (codegen)

El codegen consume el AST por slots semánticos y **no reconstruye nodos AST**:

- `emitElement`/`emitElementParts`: emiten `h(type, props, [children])`. El
  mismo helper lo usa `emitFor` para el cuerpo del `.map()`, sin fabricar
  `ElementNode`/`AttributeNode` falsos.
- `emitFor` lee `variable`, `iterable.source` y `key.source` directamente.
- `emitSwitch` arma el IIFE+switch leyendo `discriminant.source` y
  `caseTest.source`. La elección de la estrategia de emisión es del lowering;
  el conocimiento sintáctico de las expressions ya no.
- `emitProps`/`emitPropsWithKey` levantan props por rol
  (`eventHandler`/`attrValue`/`spread`/`key`) desde `ExpressionNode.source`.

## Helpers de lectura

- `readGroup(open, close)` / `readBraced()`: leen un grupo balanceado
  respetando strings, escapado **y comentarios** (`//` y `/* */`), devolviendo
  su contenido sin las llaves/parens.
- `readQuoted()`: lee un literal de string completo.
- `readRawText()`: texto hasta `<` o `{`.
- `readTagName` / `readAttrName` / `readBareAttrValue`: lecturas por rangos de
  caracteres válidos.
- `skipWs()` / `consumeClosingTag(tag)`: whitespace y cierre `</tag>`.

## Notas de integración

- El compilador no valida semántica (p. ej. que una directiva custom tenga su
  `@Directive()`); eso es responsabilidad del runtime.
- El AST interno solo lo consume `src/compiler.ts`. El transform del IDE
  (`src/tsxTransform.ts`) es un parser independiente que produce TSX para el
  análisis de TypeScript y mantiene sus propios mapeos de posición.
