// Tokenizer: convierte source .bel en una secuencia de Token[].
//
// Máquina de estados con 5 modos:
//   code     → código TypeScript passthrough
//   open     → después de <, leyendo nombre de tag
//   tag      → dentro de opening tag, leyendo atributos
//   children → dentro de elementos, leyendo hijos
//   closing  → dentro de </tag>, leyendo nombre de cierre
//
// Heurística canStartJsx() replicada del compiler original para
// distinguir `<` de comparación vs `<` de inicio de JSX.

import {
  Token,
  TokenType,
  token,
  TEMPLATE_DIRECTIVES,
  JSX_IDENT_BODY,
  ATTR_NAME_CHARS,
} from "./tokens";

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

type Mode = "code" | "open" | "tag" | "children" | "closing";
type BlockKind = "element" | "directive";

export class Tokenizer {
  private src: string;
  private i = 0;
  private tokens: Token[] = [];
  private mode: Mode = "code";

  // Estado de la heurística canStartJsx (solo se actualiza en modo code).
  private lastSig = "";
  private prev2 = "";
  private lastWord = "";
  private wordBuffer = "";

  // Pila de bloques JSX anidados.
  private blockStack: BlockKind[] = [];

  // Buffer de código acumulado.
  private codeStart = -1;
  private codeBuf = "";

  // Offset base para sub-tokenización de cuerpos de directiva.
  private baseOffset: number;

  constructor(src: string, baseOffset = 0) {
    this.src = src;
    this.baseOffset = baseOffset;
  }

  // ================================================================
  // API pública
  // ================================================================

  tokenize(): Token[] {
    this.tokens = [];
    this.i = 0;
    this.mode = "code";
    this.lastSig = "";
    this.prev2 = "";
    this.lastWord = "";
    this.wordBuffer = "";
    this.blockStack = [];
    this.codeBuf = "";
    this.codeStart = -1;

    while (this.i < this.src.length) {
      switch (this.mode) {
        case "code":
          this.stepCode();
          break;
        case "open":
          this.stepOpen();
          break;
        case "tag":
          this.stepTag();
          break;
        case "children":
          this.stepChildren();
          break;
        case "closing":
          this.stepClosing();
          break;
      }
    }

    this.flushCode();
    this.emit("EOF", "", this.i, this.i);
    return this.tokens;
  }

  // ================================================================
  // Emisión de tokens
  // ================================================================

  private emit(type: TokenType, value: string, start: number, end: number): void {
    this.tokens.push(
      token(type, value, this.baseOffset + start, this.baseOffset + end),
    );
  }

  private pushCode(ch: string): void {
    if (this.codeStart < 0) this.codeStart = this.i;
    this.codeBuf += ch;
  }

  private flushCode(): void {
    if (this.codeBuf.length > 0) {
      this.emit(
        "CODE",
        this.codeBuf,
        this.codeStart,
        this.codeStart + this.codeBuf.length,
      );
      this.codeBuf = "";
      this.codeStart = -1;
    }
  }

  private enterMode(newMode: Mode): void {
    this.flushCode();
    this.mode = newMode;
  }

  // ================================================================
  // Helpers
  // ================================================================

  private peek(offset = 0): string {
    return this.src[this.i + offset] ?? "";
  }

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
    const next = this.peek(1);
    if (!next) return false;
    if (next === "/") return false;
    if (!/[A-Za-z_$>]/.test(next)) return false;

    if (this.prev2 === "=" && this.lastSig === ">") return true;
    if (this.lastSig === ">") return false;

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

    if (/[A-Za-z_$]/.test(this.lastSig)) {
      const word = this.wordBuffer || this.lastWord;
      return KEYWORD_PRECEDE_EXPRESSION.has(word);
    }

    return true;
  }

  private skipWs(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) {
      this.i++;
    }
  }

  // ================================================================
  // Estado: code
  // ================================================================

  private stepCode(): void {
    const ch = this.src[this.i];

    if (ch === "<" && this.canStartJsx()) {
      this.enterMode("open");
      return;
    }

    this.pushCode(ch);
    this.feed(ch);
    this.i++;
  }

  // ================================================================
  // Estado: open (después de <, leyendo nombre de tag)
  // ================================================================

  private stepOpen(): void {
    this.flushCode();
    const start = this.i;

    // Fragmento: <>
    if (this.peek() === ">") {
      this.emit("JSX_OPEN", "<", start, start + 1);
      this.emit("JSX_IDENT", "", start + 1, start + 1);
      this.i++;
      this.emit("JSX_CLOSE", ">", this.i - 1, this.i);
      this.blockStack.push("element");
      this.mode = "children";
      return;
    }

    // Consumir <
    this.emit("JSX_OPEN", "<", start, start + 1);
    this.i++;

    // Nombre del tag
    const nameStart = this.i;
    while (this.i < this.src.length && JSX_IDENT_BODY.test(this.src[this.i])) {
      this.i++;
    }
    this.emit("JSX_IDENT", this.src.slice(nameStart, this.i), nameStart, this.i);

    this.mode = "tag";
  }

  // ================================================================
  // Estado: tag (dentro de opening tag, leyendo atributos)
  // ================================================================

  private stepTag(): void {
    this.skipWs();

    if (this.i >= this.src.length) {
      this.flushCode();
      return;
    }

    const ch = this.src[this.i];

    // >
    if (ch === ">") {
      this.flushCode();
      this.emit("JSX_CLOSE", ">", this.i, this.i + 1);
      this.i++;
      this.blockStack.push("element");
      this.mode = "children";
      return;
    }

    // />
    if (ch === "/" && this.peek(1) === ">") {
      this.flushCode();
      this.emit("JSX_SELF_CLOSE", "/>", this.i, this.i + 2);
      this.i += 2;
      this.mode = "code";
      return;
    }

    // Spread: {...}
    if (ch === "{") {
      this.flushCode();
      this.emit("EXPR_OPEN", "{", this.i, this.i + 1);
      this.i++;
      const inner = this.readBalanced();
      this.emit("CODE", inner, this.i, this.i + inner.length);
      this.i += inner.length;
      this.emit("EXPR_CLOSE", "}", this.i, this.i + 1);
      this.i++;
      return;
    }

    // Nombre de atributo
    if (ATTR_NAME_CHARS.test(ch)) {
      this.flushCode();
      const nameStart = this.i;
      while (this.i < this.src.length && !/[\s=/>{}]/.test(this.src[this.i])) {
        this.i++;
      }
      this.emit(
        "ATTR_NAME",
        this.src.slice(nameStart, this.i),
        nameStart,
        this.i,
      );

      this.skipWs();

      // =
      if (this.src[this.i] === "=") {
        this.emit("ATTR_EQUALS", "=", this.i, this.i + 1);
        this.i++;
        this.skipWs();

        const v = this.src[this.i];
        if (v === '"' || v === "'") {
          const val = this.readQuoted();
          this.emit("STRING", val, this.i - val.length, this.i);
        } else if (v === "{") {
          this.emit("EXPR_OPEN", "{", this.i, this.i + 1);
          this.i++;
          const inner = this.readBalanced();
          this.emit("CODE", inner, this.i, this.i + inner.length);
          this.i += inner.length;
          this.emit("EXPR_CLOSE", "}", this.i, this.i + 1);
          this.i++;
        }
      }
      return;
    }

    // Caracter desconocido en tag — skip
    this.i++;
  }

  // ================================================================
  // Estado: children (dentro de elementos, leyendo hijos)
  // ================================================================

  private stepChildren(): void {
    const ch = this.src[this.i];

    // Closing tag: </
    if (ch === "<" && this.peek(1) === "/") {
      this.flushCode();
      this.emit("JSX_SLASH", "</", this.i, this.i + 2);
      this.i += 2;
      this.mode = "closing";
      return;
    }

    // Opening tag: <name
    if (ch === "<" && /[A-Za-z_$]/.test(this.peek(1))) {
      this.flushCode();
      this.mode = "open";
      return;
    }

    // Fragment: <>
    if (ch === "<" && this.peek(1) === ">") {
      this.flushCode();
      this.mode = "open";
      return;
    }

    // Expresión o bloque: { ... }
    if (ch === "{") {
      this.flushCode();
      this.handleBrace();
      return;
    }

    // Directiva: @name
    if (ch === "@") {
      this.flushCode();
      this.handleDirective();
      return;
    }

    // Fin de bloque de directiva: }
    if (ch === "}") {
      this.flushCode();
      this.emit("BRACE_CLOSE", "}", this.i, this.i + 1);
      this.i++;
      this.blockStack.pop();
      this.mode = this.blockStack.length > 0 ? "children" : "code";
      return;
    }

    // Texto
    this.pushText();
  }

  // ================================================================
  // Estado: closing (dentro de </tag>)
  // ================================================================

  private stepClosing(): void {
    this.flushCode();

    // Fragment closing: </>
    if (this.src[this.i] === ">") {
      this.emit("JSX_IDENT", "", this.i, this.i);
      this.emit("JSX_CLOSE", ">", this.i, this.i + 1);
      this.i++;
      this.blockStack.pop();
      this.mode = this.blockStack.length > 0 ? "children" : "code";
      return;
    }

    // Nombre del tag de cierre
    const nameStart = this.i;
    while (this.i < this.src.length && JSX_IDENT_BODY.test(this.src[this.i])) {
      this.i++;
    }
    this.emit("JSX_IDENT", this.src.slice(nameStart, this.i), nameStart, this.i);

    // >
    if (this.src[this.i] === ">") {
      this.emit("JSX_CLOSE", ">", this.i, this.i + 1);
      this.i++;
    }

    this.blockStack.pop();
    this.mode = this.blockStack.length > 0 ? "children" : "code";
  }

  // ================================================================
  // Manejo de directivas
  // ================================================================

  private handleDirective(): void {
    const start = this.i;
    this.i++; // consume @

    // Leer nombre
    const nameStart = this.i;
    while (this.i < this.src.length && /[A-Za-z0-9-]/.test(this.src[this.i])) {
      this.i++;
    }
    let name = this.src.slice(nameStart, this.i);

    // @else if → combinar en un solo token
    if (name === "else") {
      const savedI = this.i;
      this.skipWs();
      if (
        this.src.startsWith("if", this.i) &&
        !/[A-Za-z0-9_$]/.test(this.src[this.i + 2] ?? "")
      ) {
        name = "else if";
        this.i += 2;
      } else {
        this.i = savedI;
      }
    }

    const isTemplate = TEMPLATE_DIRECTIVES.has(name);
    this.emit(
      isTemplate ? "DIRECTIVE" : "CUSTOM_DIRECTIVE",
      name,
      start,
      this.i,
    );

    // Args: ( ...) — todos menos @else y @default
    if (name !== "else" && name !== "default") {
      this.skipWs();
      if (this.src[this.i] === "(") {
        this.emit("PAREN_OPEN", "(", this.i, this.i + 1);
        this.i++;
        const inner = this.readBalanced();
        this.emit("CODE", inner, this.i, this.i + inner.length);
        this.i += inner.length;
        this.emit("PAREN_CLOSE", ")", this.i, this.i + 1);
        this.i++;
      }
    }

    // Body: { ... } — todos los directivas
    this.skipWs();
    if (this.src[this.i] === "{") {
      this.readDirectiveBody();
    }
  }

  // ================================================================
  // Manejo de { ... }
  // ================================================================

  private handleBrace(): void {
    const braceStart = this.i;
    this.i++; // consume {

    // Leer contenido balanceado
    const contentStart = this.i;
    const content = this.readBalanced();
    const contentEnd = this.i;
    const braceEnd = this.i;
    this.i++; // consume }

    // ¿Contiene JSX o directivas? → bloque de directiva
    // ¿Es solo una expresión? → interpolación
    const isComplex = /[<@]/.test(content);

    if (isComplex) {
      this.emit("BRACE_OPEN", "{", braceStart, braceStart + 1);
      this.blockStack.push("directive");

      const sub = new Tokenizer(content, this.baseOffset + contentStart);
      const subTokens = sub.tokenize();
      for (const t of subTokens) {
        if (t.type !== "EOF") this.tokens.push(t);
      }

      this.emit("BRACE_CLOSE", "}", braceEnd, braceEnd + 1);
      this.blockStack.pop();
    } else {
      this.emit("EXPR_OPEN", "{", braceStart, braceStart + 1);
      this.emit("CODE", content, contentStart, contentEnd);
      this.emit("EXPR_CLOSE", "}", braceEnd, braceEnd + 1);
    }
  }

  // ================================================================
  // Cuerpo de directiva: { ... } — siempre recursivo
  // ================================================================

  private readDirectiveBody(): void {
    this.emit("BRACE_OPEN", "{", this.i, this.i + 1);
    this.i++; // consume {
    this.blockStack.push("directive");

    const contentStart = this.i;
    const content = this.readBalanced();
    const contentEnd = this.i;
    this.i++; // consume }

    const sub = new Tokenizer(content, this.baseOffset + contentStart);
    const subTokens = sub.tokenize();
    for (const t of subTokens) {
      if (t.type !== "EOF") this.tokens.push(t);
    }

    this.emit("BRACE_CLOSE", "}", contentEnd, contentEnd + 1);
    this.blockStack.pop();
  }

  // ================================================================
  // Texto
  // ================================================================

  private pushText(): void {
    const start = this.i;
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (ch === "<" || ch === "{" || ch === "}" || ch === "@") break;
      this.i++;
    }
    if (this.i > start) {
      this.emit("JSX_TEXT", this.src.slice(start, this.i), start, this.i);
    }
  }

  // ================================================================
  // Helpers de lectura
  // ================================================================

  /** Lee contenido balanceado entre { y }. this.i empieza después de { y termina en }. */
  private readBalanced(): string {
    let depth = 1;
    let inString: string | null = null;
    const start = this.i;

    while (this.i < this.src.length && depth > 0) {
      const ch = this.src[this.i];
      if (inString) {
        if (ch === "\\") {
          this.i++;
        } else if (ch === inString) {
          inString = null;
        }
      } else if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
      this.i++;
    }

    return this.src.slice(start, this.i);
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
    return this.src.slice(this.i);
  }
}
