# Arquitectura del compilador `.bel`

`src/compiler.ts` transforma archivos `.bel` (TypeScript + JSX + directivas de
Belzium) en TypeScript puro. Es un **lexer de un solo pase y cero dependencias**:
no construye un AST y copia el resto del código TS sin modificar.

## Flujo general

`compile(source, options)` hace cuatro pasos:

1. **Transformación** (`new Compiler(source).run()`): recorre el código y
   convierte JSX y directivas en llamadas al runtime.
2. **Selectores** (`injectSelectors`): `@Component()`/`@UI()` sin selector se
   convierten en `@Component({ selector: "kebab-name" })` (regex sobre el nombre
   de clase; un selector explícito se respeta).
3. **Renombrado**: `template(...) { ... }` → `render(...) { ... }`.
4. **Imports**: detecta los nombres del runtime usados en el archivo
   (`RUNTIME_APIS`) y antepone `import { ... } from <importPath>` (por defecto
   `belzium`).

## Mecánica de un solo pase

`Compiler.run()` itera carácter a carácter:

- Si encuentra `<` y `canStartJsx()` es verdadero, parsea un árbol JSX.
- Si no, copia el carácter tal cual y actualiza el estado con `feed()`.

`feed()` mantiene el **último carácter significativo** (`lastSig`), el anterior
(`prev2`) y la última palabra (`lastWord`, con la palabra en curso pendiente en
`wordBuffer`). Esta información es lo que permite distinguir `<` de comparación
de `<` de JSX.

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
- Gotcha clave: tras `return`, `lastSig` es la letra final `"n"`, no la palabra;
  la palabra en curso todavía vive en `wordBuffer`, así que el check usa
  `this.wordBuffer || this.lastWord`.

## Parseo de JSX

`parseElement()` lee: nombre de tag, atributos, cierre `>` o `/>`, hijos y tag
de cierre.

- **Tipo**: nombre en PascalCase o que contiene `.` → componente (`h(PascalCase, ...)`);
  minúscula → elemento (`h("div", ...)`).
- **Atributos** (`parseElement`):
  - `onClick={expr}` / `{expr}` → se emite el valor tal cual (`onClick: expr`).
  - `attr="text"` / `attr='text'` → se conserva el string.
  - `attr` sin valor → `true`.
  - `{...this.props}` → spread (`...this.props`).
  - `className` → `class`; `htmlFor` → `for`.
  - Props sin valor ni `=`: se leen hasta whitespace/`>`/`/`.
- **Hijos** (`parseChildren()`), en orden:
  - Elemento hijo → `parseElement()`.
  - Fragmento `<>...</>` → se aplana en el array de hijos.
  - `{expr}` → `text(String(expr))`.
  - `@directiva` → `parseDirective()`.
  - Texto crudo → `cleanText` → `text("...")`.

### `cleanText`

Colapsa los saltos de línea y su indentación a un solo espacio, pero conserva
los espacios intencionales de una misma línea (p. ej. el espacio final de
`Count: {x}`). El texto compuesto solo de espacios se ignora.

## Directivas

`parseElement()` detecta tag names reservados (`if`, `for`, `switch`) y despacha:

| Sintaxis | Codegen |
| --- | --- |
| `<if condition={c}>...</if>` | `...((c) ? [...] : [...])` (soporta `<else-if>`) |
| `<for each={x of xs} key={k}>...</for>` | `...xs.map((x) => h("li", { key }, [...]))` |
| `<switch value={e}><case test={"v"}>...</case><default>...</default></switch>` | `...(() => { switch (e) { case "v": return [...]; default: return [...]; } })()` |
| `<Clickable enabled={enabled}>...</Clickable>` | `h(Clickable, { enabled: enabled }, [...])` |

Detalles:

- `attachElseChain()` usa look-ahead para encadenar `<else-if>`/`<else>` como
  hermanos después de `</if>`, mutando `alternate` del nodo padre.
- `parseForElement()` parsea `each={item of iterable}` con regex, extrae `key={}` opcional.
- `parseSwitchElement()` reutiliza `parseElement()` para `<case>` y `<default>`
  como nodos hijos Element; extrae `test={}` de cada `<case>`.
- Componentes custom (PascalCase) se parsean como elementos JSX estándar;
  `emitElement` genera `h(PascalName, props, children)` directamente.
- `<else-if>` o `<else>` fuera de contexto lanzan error explícito.

## Helpers de lectura

- `readGroup(open, close)` / `readBraced()`: leen un grupo balanceado respetando
  strings y escapado, devolviendo su contenido sin las llaves/parens.
- `readQuoted()`: lee un literal de string completo.
- `readRawText()`: texto hasta `<`, `{`, `}` o `@`.
- `readTagName` / `readAttrName` / `readDirectiveName` / `readBareAttrValue`:
  lecturas por rangos de caracteres válidos.
- `skipWs()` / `consumeClosingTag(tag)`: whitespace y cierre `</tag>`.
- `splitTopLevel(source, sep)`: divide por un separador en profundidad 0.

## Notas de integración

- El resultado se usa en el test de integración escribiendo el archivo
  compilado en `tests/compiler/.cache/` e importándolo con `pathToFileURL`
  (la ruta de import se construye con `dirname(fileURLToPath(import.meta.url))`
  + `join`, y se normaliza a forward slashes porque Vite transforma
  `new URL(<literal>, import.meta.url)` como un asset).
- El compilador no valida semántica (p. ej. que una directiva custom tenga su
  `@Directive()`); eso es responsabilidad del runtime.
