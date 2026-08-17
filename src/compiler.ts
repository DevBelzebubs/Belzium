// Compilador .bel → TypeScript.
//
// Implementa un lexer de un solo pase y cero dependencias que
// transforma la sintaxis de Belzium en llamadas al runtime:
//
//   <div> -> h("div", null, [])
//   {expr} -> text(String(expr))
//   @if/@else -> ...(cond ? [...] : [...])
//   @for (item of items; key) -> ...items.map((item) => h(..., { key }, [...]))
//   @switch/@case/@default -> IIFE con switch
//   @custom (props) { children } -> h(PascalCase, { props }, [...])
//
// El resto del código TypeScript pasa sin modificar.

import { toKebabCase } from "./component/metadata";

export interface CompileOptions {
  // Ruta del módulo del runtime para el import generado.
  importPath?: string;
}

const KEYWORD_PRECEDE_EXPRESSION = new Set([
  "return",
  "throw",
  "case",
  "typeof",
  "instanceof",
  "in",
  "of",
  "yield",
  "do",
  "else",
  "new",
  "delete",
  "void",
]);

export const RUNTIME_APIS = [
  "h",
  "text",
  "ref",
  "isRef",
  "reactive",
  "computed",
  "effect",
  "watch",
  "watchEffect",
  "input",
  "output",
  "onMounted",
  "onUnmounted",
  "onUpdated",
  "Store",
  "useStore",
  "resetStores",
  "Hook",
  "useHook",
  "Directive",
  "Component",
  "UI",
  "Service",
  "Configuration",
  "Bean",
  "createApp",
  "provide",
  "inject",
  "useSlots",
  "isComponent",
  "toReactive",
  "toRaw",
];

// Compila un archivo .bel a TypeScript válido para el runtime.
export function compile(
  source: string,
  options: CompileOptions = {},
): string {
  const importPath = options.importPath ?? "belzium";

  const transformed = new Compiler(source).run();
  const injected = injectSelectors(transformed);
  const output = injected.replace(
    /\btemplate(\s*\([^)]*\)\s*\{)/g,
    "render$1",
  );

  const used = new Set<string>();
  for (const api of RUNTIME_APIS) {
    if (new RegExp(`\\b${api}\\b`).test(source)) {
      used.add(api);
    }
  }
  if (/\bh\(/.test(output)) used.add("h");
  if (/\btext\(/.test(output)) used.add("text");

  const imports = [...used].sort((a, b) =>
    a.toLowerCase() < b.toLowerCase()
      ? -1
      : a.toLowerCase() > b.toLowerCase()
        ? 1
        : 0,
  );

  const header =
    imports.length > 0
      ? `import { ${imports.join(", ")} } from ${JSON.stringify(importPath)};\n\n`
      : "";

  return header + output;
}

// Convierte @Component()/@UI() sin selector en @Component({ selector: "kebab-name" }).
function injectSelectors(code: string): string {
  return code.replace(
    /@(Component|UI)\(\)(?=\s*(?:export\s+|declare\s+|abstract\s+)*class\s+([A-Za-z_$][\w$]*))/g,
    (_match, decorator: string, className: string) =>
      `@${decorator}({ selector: ${JSON.stringify(toKebabCase(className))} })`,
  );
}

// Convierte un nombre kebab-case en PascalCase.
export function toPascalCase(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

// Limpia un fragmento de texto JSX.
// Los saltos de línea y su indentación se colapsan a un solo espacio,
// pero se conservan los espacios intencionales de una misma línea
// (p. ej. el espacio final de "Count: " antes de una interpolación).
function cleanText(raw: string): string {
  // Texto compuesto solo de espacios: se ignora.
  if (!raw.trim()) return "";

  // Colapsa las secuencias de espacios que contienen saltos
  // de línea a un solo espacio.
  const collapsed = raw.replace(/\s*\n\s*/g, " ");

  // Elimina únicamente la indentación inicial.
  return collapsed.replace(/^\s+/, "");
}

// Normaliza nombres de atributos JSX al estilo HTML.
function normalizePropName(name: string): string {
  if (name === "className") return "class";
  if (name === "htmlFor") return "for";
  return name;
}

interface ParsedElement {
  type: string;
  typeCode: string;
  propsCode: string | null;
  childrenCode: string;
  code: string;
  isComponent: boolean;
}

class Compiler {
  private i = 0;
  private lastSig = "";
  private prev2 = "";
  private lastWord = "";
  private wordBuffer = "";

  constructor(private src: string) {}

  run(): string {
    let out = "";
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (ch === "<" && this.canStartJsx()) {
        out += this.parseTree();
      } else {
        out += ch;
        this.feed(ch);
        this.i++;
      }
    }
    return out;
  }

  // Mantiene el estado del último carácter/token significativo
  // para distinguir `<` de comparación de `<` de JSX.
  private feed(ch: string): void {
    if (/\s/.test(ch)) return;

    if (/[A-Za-z0-9_$]/.test(ch)) {
      this.wordBuffer += ch;
    } else {
      if (this.wordBuffer) {
        this.lastWord = this.wordBuffer;
        this.wordBuffer = "";
      }
    }

    this.prev2 = this.lastSig;
    this.lastSig = ch;
  }

  private canStartJsx(): boolean {
    const next = this.src[this.i + 1];
    if (!next) return false;
    if (next === "/") return false;
    if (!/[A-Za-z_$>]/.test(next)) return false;

    // Después de una flecha `=>` siempre es JSX.
    if (this.prev2 === "=" && this.lastSig === ">") return true;

    if (this.lastSig === ">") return false;

    // `a < b` es una comparación, pero `return <div>` inicia JSX:
    // el `<` solo inicia JSX tras una palabra clave que espera
    // una expresión (return, throw, case, ...).
    if (this.lastSig === "<") {
      if (
        !/[A-Za-z_$]/.test(this.lastWord) ||
        !KEYWORD_PRECEDE_EXPRESSION.has(this.lastWord)
      ) {
        return false;
      }
    }
    if (this.lastSig === "") return true;
    if (/[)\]}"'0-9]/.test(this.lastSig)) return false;

    // Tras un identificador, solo es JSX si el identificador
    // es una palabra clave que precede a una expresión.
    //
    // `lastSig` es el último CARÁCTER significativo: tras `return`
    // es la letra final "n", y la palabra en curso todavía está
    // pendiente en `wordBuffer` (aún no flusheada a `lastWord`).
    if (/[A-Za-z_$]/.test(this.lastSig)) {
      const word = this.wordBuffer || this.lastWord;
      return KEYWORD_PRECEDE_EXPRESSION.has(word);
    }

    return true;
  }

  private parseTree(): string {
    if (this.src[this.i + 1] === ">") {
      // Fragmento raíz: se envuelve en un div.
      this.i += 2;
      const items = this.parseChildren();
      this.consumeClosingTag("");
      return `h("div", null, [${items.join(", ")}])`;
    }
    return this.parseElement().code;
  }

  private parseElement(): ParsedElement {
    if (this.src[this.i] !== "<") {
      throw new Error(`Expected "<" at position ${this.i}`);
    }
    this.i++;
    const type = this.readTagName();
    const isComponent = /^[A-Z]/.test(type) || type.includes(".");
    const typeCode = isComponent ? type : JSON.stringify(type);

    const entries: string[] = [];
    const spreads: string[] = [];
    let selfClosing = false;
    let openingDone = false;

    while (!openingDone) {
      this.skipWs();
      const ch = this.src[this.i];

      if (ch === ">") {
        this.i++;
        openingDone = true;
        break;
      }
      if (ch === "/" && this.src[this.i + 1] === ">") {
        this.i += 2;
        selfClosing = true;
        openingDone = true;
        break;
      }
      if (ch === "{") {
        const inner = this.readBraced();
        if (!inner.startsWith("...")) {
          throw new Error(`Expected spread props {...} in element`);
        }
        spreads.push(inner.slice(3).trim());
        continue;
      }

      const name = this.readAttrName();
      this.skipWs();

      let value = "true";
      if (this.src[this.i] === "=") {
        this.i++;
        this.skipWs();
        const v = this.src[this.i];
        if (v === '"' || v === "'") {
          value = this.readQuoted();
        } else if (v === "{") {
          value = this.readBraced();
        } else {
          value = this.readBareAttrValue();
        }
      }
      entries.push(`${normalizePropName(name)}: ${value}`);
    }

    const propsCode =
      spreads.length || entries.length
        ? `{ ${[...spreads.map((s) => `...${s}`), ...entries].join(", ")} }`
        : null;

    let childrenCode = "[]";
    if (!selfClosing) {
      childrenCode = `[${this.parseChildren().join(", ")}]`;
      this.consumeClosingTag(type);
    }

    const code = `h(${typeCode}, ${propsCode ?? "null"}, ${childrenCode})`;

    return {
      type,
      typeCode,
      propsCode,
      childrenCode,
      code,
      isComponent,
    };
  }

  private parseChildren(): string[] {
    const items: string[] = [];
    while (this.i < this.src.length) {
      const ch = this.src[this.i];

      if (ch === "<") {
        if (this.src[this.i + 1] === "/") break;

        if (this.src[this.i + 1] === ">") {
          this.i += 2;
          const inner = this.parseChildren();
          this.consumeClosingTag("");
          items.push(...inner);
          continue;
        }

        items.push(this.parseElement().code);
        continue;
      }

      if (ch === "{") {
        const inner = this.readBraced();
        items.push(`text(String(${inner}))`);
        continue;
      }

      if (ch === "@") {
        items.push(...this.parseDirective());
        continue;
      }

      if (ch === "}") break;

      const raw = this.readRawText();
      const cleaned = cleanText(raw);
      if (cleaned) {
        items.push(`text(${JSON.stringify(cleaned)})`);
      }
    }
    return items;
  }

  // Lee el cuerpo de una directiva: `{ children }`.
  // Devuelve el código de los hijos compilados como array.
  private parseBracedChildren(): string {
    this.skipWs();
    if (this.src[this.i] !== "{") {
      throw new Error(`Expected "{" at position ${this.i}`);
    }
    this.i++;
    const items = this.parseChildren();
    this.skipWs();
    if (this.src[this.i] !== "}") {
      throw new Error(`Expected "}" at position ${this.i}`);
    }
    this.i++;
    return `[${items.join(", ")}]`;
  }

  private parseDirective(): string[] {
    this.i++; // consume '@'
    const name = this.readDirectiveName();

    switch (name) {
      case "if":
        return [this.parseIfChain()];
      case "for":
        return [this.parseFor()];
      case "switch":
        return [this.parseSwitch()];
      case "else":
      case "case":
      case "default":
        throw new Error(`Unexpected @${name} without its parent`);
      default:
        return [this.parseCustomDirective(name)];
    }
  }

  private parseIfChain(): string {
    this.skipWs();
    const cond = this.readGroup("(", ")");
    const body = this.parseBracedChildren();

    const branches: Array<{ cond: string | null; body: string }> = [
      { cond, body },
    ];
    let hasElse = false;

    while (true) {
      const save = this.i;
      this.skipWs();

      if (this.src[this.i] !== "@") {
        this.i = save;
        break;
      }

      this.i++;
      const name = this.readDirectiveName();

      if (name !== "else") {
        this.i = save;
        break;
      }

      this.skipWs();
      if (
        this.src.startsWith("if", this.i) &&
        !/[A-Za-z0-9_$]/.test(this.src[this.i + 2] ?? "")
      ) {
        this.i += 2;
        const elseIfCond = this.readGroup("(", ")");
        const elseIfBody = this.parseBracedChildren();
        branches.push({ cond: elseIfCond, body: elseIfBody });
        continue;
      }

      const elseBody = this.parseBracedChildren();
      branches.push({ cond: null, body: elseBody });
      hasElse = true;
      break;
    }

    let expr = "";
    for (const branch of branches) {
      expr +=
        branch.cond === null
          ? branch.body
          : `(${branch.cond}) ? ${branch.body} : `;
    }
    if (!hasElse) expr += "[]";

    return `...(${expr})`;
  }

  private parseFor(): string {
    this.skipWs();
    const group = this.readGroup("(", ")");
    const parts = splitTopLevel(group, ";");
    const loopPart = (parts[0] ?? "").trim();
    const keyPart = parts[1]?.trim() ?? null;

    const match = loopPart.match(/^([A-Za-z_$][\w$]*)\s+of\s+(.+)$/);
    if (!match) {
      throw new Error(`Invalid @for syntax: expected "item of items"`);
    }
    const item = match[1];
    const iterable = match[2].trim();

    // Consume el `{` opcional que abre el cuerpo de la directiva.
    this.skipWs();
    if (this.src[this.i] === "{") this.i++;

    this.skipWs();
    const element = this.parseElement();

    this.skipWs();
    if (this.src[this.i] !== "}") {
      throw new Error(`Expected "}" to close @for body`);
    }
    this.i++;
    let props: string;
    if (keyPart) {
      const inner = element.propsCode
        ? element.propsCode.slice(1, -1).trim()
        : "";
      props = `{ ${inner ? `key: ${keyPart}, ${inner}` : `key: ${keyPart}`} }`;
    } else {
      props = element.propsCode ?? "null";
    }

    return `...${iterable}.map((${item}) => h(${element.typeCode}, ${props}, ${element.childrenCode}))`;
  }

  private parseSwitch(): string {
    this.skipWs();
    const expr = this.readGroup("(", ")");

    this.skipWs();
    if (this.src[this.i] !== "{") {
      throw new Error(`Expected "{" to open @switch body`);
    }
    this.i++;

    const cases: string[] = [];
    let defaultBody: string | null = null;

    while (true) {
      this.skipWs();
      if (this.src[this.i] === "}") {
        this.i++;
        break;
      }
      if (this.src[this.i] !== "@") {
        throw new Error(`Expected @case or @default inside @switch`);
      }

      this.i++;
      const name = this.readDirectiveName();

      if (name === "case") {
        this.skipWs();
        const value = this.readGroup("(", ")");
        const body = this.parseBracedChildren();
        cases.push(`case ${value}: return ${body};`);
      } else if (name === "default") {
        defaultBody = this.parseBracedChildren();
      } else {
        throw new Error(`Unexpected @${name} inside @switch`);
      }
    }

    const defaultCase = defaultBody
      ? `default: return ${defaultBody};`
      : "default: return [];";

    return `...(() => { switch (${expr}) { ${cases.join(" ")} ${defaultCase} } })()`;
  }

  private parseCustomDirective(name: string): string {
    let props: string | null = null;

    this.skipWs();
    if (this.src[this.i] === "(") {
      const inner = this.readGroup("(", ")");
      const propNames = inner
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      props = propNames.length ? `{ ${propNames.join(", ")} }` : null;
    }

    const children = this.parseBracedChildren();
    return `h(${toPascalCase(name)}, ${props ?? "null"}, ${children})`;
  }

  // Lee el contenido de un grupo balanceado (p. ej. paréntesis o llaves).
  private readGroup(open: string, close: string): string {
    if (this.src[this.i] !== open) {
      throw new Error(`Expected "${open}" at position ${this.i}`);
    }

    let inString: string | null = null;
    let depth = 1;
    const start = this.i + 1;
    this.i++;

    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (inString) {
        if (ch === "\\") this.i++;
        else if (ch === inString) inString = null;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
      } else if (ch === open) {
        depth++;
      } else if (ch === close) {
        depth--;
        if (depth === 0) {
          const code = this.src.slice(start, this.i).trim();
          this.i++;
          return code;
        }
      }
      this.i++;
    }

    throw new Error(`Unbalanced "${open}${close}" in source`);
  }

  private readBraced(): string {
    return this.readGroup("{", "}");
  }

  private readQuoted(): string {
    const quote = this.src[this.i];
    let j = this.i + 1;
    while (j < this.src.length) {
      if (this.src[j] === "\\") j += 2;
      else if (this.src[j] === quote) {
        const value = this.src.slice(this.i, j + 1);
        this.i = j + 1;
        return value;
      } else {
        j++;
      }
    }
    throw new Error(`Unterminated string literal`);
  }

  private readRawText(): string {
    const start = this.i;
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (ch === "<" || ch === "{" || ch === "}" || ch === "@") break;
      this.i++;
    }
    return this.src.slice(start, this.i);
  }

  private readTagName(): string {
    let j = this.i;
    while (j < this.src.length && /[A-Za-z0-9._$-]/.test(this.src[j])) {
      j++;
    }
    const name = this.src.slice(this.i, j);
    this.i = j;
    return name;
  }

  private readAttrName(): string {
    let j = this.i;
    while (j < this.src.length && !/[\s=/>{}]/.test(this.src[j])) {
      j++;
    }
    const name = this.src.slice(this.i, j);
    this.i = j;
    return name;
  }

  private readDirectiveName(): string {
    let j = this.i;
    while (j < this.src.length && /[A-Za-z0-9-]/.test(this.src[j])) {
      j++;
    }
    const name = this.src.slice(this.i, j);
    this.i = j;
    return name;
  }

  private readBareAttrValue(): string {
    let j = this.i;
    while (j < this.src.length && !/[\s>]/.test(this.src[j])) {
      j++;
    }
    const value = this.src.slice(this.i, j);
    this.i = j;
    return value;
  }

  private skipWs(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) {
      this.i++;
    }
  }

  private consumeClosingTag(tag: string): void {
    if (this.src[this.i] !== "<" || this.src[this.i + 1] !== "/") {
      throw new Error(`Expected closing tag </${tag}> at position ${this.i}`);
    }
    this.i += 2;
    if (tag) {
      if (!this.src.startsWith(tag, this.i)) {
        throw new Error(`Expected closing tag </${tag}>`);
      }
      this.i += tag.length;
    }
    this.skipWs();
    if (this.src[this.i] !== ">") {
      throw new Error(`Malformed closing tag </${tag}>`);
    }
    this.i++;
  }
}

// Divide una cadena por un separador en nivel 0 de profundidad,
// respetando strings y agrupadores.
export function splitTopLevel(source: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let inString: string | null = null;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
    } else if (ch === separator && depth === 0) {
      parts.push(source.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}
