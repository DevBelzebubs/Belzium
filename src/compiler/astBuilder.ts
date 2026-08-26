import type {
  ProgramNode,
  TopLevelNode,
  PassthroughNode,
  TemplateNode,
  ElementNode,
  FragmentNode,
  TextNode,
  ExpressionNode,
  IfDirectiveNode,
  ForDirectiveNode,
  SwitchDirectiveNode,
  SwitchCaseNode,
  CustomDirectiveNode,
  AttributeNode,
  NormalAttributeNode,
  SpreadAttributeNode,
  AttributeValueNode,
  StringValueNode,
  ExpressionValueNode,
} from "./nodes";

const KEYWORD_PRECEDE_EXPRESSION = new Set([
  "return", "throw", "case", "typeof", "instanceof",
  "in", "of", "yield", "do", "else", "new", "delete", "void",
]);

export class ASTBuilder {
  private i = 0;
  private lastSig = "";
  private prev2 = "";
  private lastWord = "";
  private wordBuffer = "";

  constructor(private src: string) {}

  build(): ProgramNode {
    const body: TopLevelNode[] = [];
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (ch === "<" && this.canStartJsx()) {
        body.push(this.parseTree());
      } else {
        body.push(this.parsePassthrough());
      }
    }
    return { type: "Program", body, start: 0, end: this.src.length };
  }

  private feed(ch: string): void {
    if (/\s/.test(ch)) return;
    if (/[A-Za-z0-9_$]/.test(ch)) {
      this.wordBuffer += ch;
    } else {
      if (this.wordBuffer) { this.lastWord = this.wordBuffer; this.wordBuffer = ""; }
    }
    this.prev2 = this.lastSig;
    this.lastSig = ch;
  }

  private canStartJsx(): boolean {
    const next = this.src[this.i + 1];
    if (!next) return false;
    if (next === "/") return false;
    if (!/[A-Za-z_$>]/.test(next)) return false;
    if (this.prev2 === "=" && this.lastSig === ">") return true;
    if (this.lastSig === ">") return false;
    if (this.lastSig === "<") {
      if (!/[A-Za-z_$]/.test(this.lastWord) || !KEYWORD_PRECEDE_EXPRESSION.has(this.lastWord)) return false;
    }
    if (this.lastSig === "") return true;
    if (/[)\]}"'0-9]/.test(this.lastSig)) return false;
    if (/[A-Za-z_$]/.test(this.lastSig)) {
      const word = this.wordBuffer || this.lastWord;
      return KEYWORD_PRECEDE_EXPRESSION.has(word);
    }
    return true;
  }

  private parsePassthrough(): PassthroughNode {
    const start = this.i;
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (ch === "<" && this.canStartJsx()) break;
      this.feed(ch);
      this.i++;
    }
    return { type: "Passthrough", code: this.src.slice(start, this.i), start, end: this.i };
  }

  // ── Template parsing ────────────────────────────────────────

  private parseTree(): TemplateNode {
    if (this.src[this.i + 1] === ">") {
      this.i += 2;
      const children = this.parseChildren();
      this.consumeClosingTag("");
      return { type: "Fragment", children, start: this.i - 2, end: this.i };
    }
    return this.parseElement();
  }

  private parseElement(): ElementNode {
    const start = this.i;
    this.i++;
    const tag = this.readTagName();
    const isComponent = /^[A-Z]/.test(tag) || tag.includes(".");
    const attributes = this.parseAttributes();

    if (this.src[this.i] === "/" && this.src[this.i + 1] === ">") {
      this.i += 2;
      return { type: "Element", tag, isComponent, attributes, children: [], start, end: this.i };
    }

    this.i++;
    const children = this.parseChildren();
    this.consumeClosingTag(tag);
    return { type: "Element", tag, isComponent, attributes, children, start, end: this.i };
  }

  private parseAttributes(): AttributeNode[] {
    const attrs: AttributeNode[] = [];
    while (this.i < this.src.length) {
      this.skipWs();
      const ch = this.src[this.i];
      if (ch === ">") break;
      if (ch === "/" && this.src[this.i + 1] === ">") break;
      if (ch === "{") {
        const inner = this.readBraced();
        if (inner.startsWith("...")) {
          attrs.push({ type: "SpreadAttribute", expression: inner.slice(3).trim(), start: this.i - inner.length - 2, end: this.i } as SpreadAttributeNode);
        }
        continue;
      }
      const name = this.readAttrName();
      this.skipWs();
      let value: AttributeValueNode | null = null;
      if (this.src[this.i] === "=") {
        this.i++;
        this.skipWs();
        value = this.readAttrValue();
      }
      attrs.push({ type: "Attribute", name, value, start: this.i - name.length, end: this.i } as NormalAttributeNode);
    }
    return attrs;
  }

  private readAttrValue(): AttributeValueNode {
    const start = this.i;
    const v = this.src[this.i];
    if (v === '"' || v === "'") {
      const val = this.readQuoted();
      return { type: "StringValue", value: val.slice(1, -1), start, end: this.i };
    }
    if (v === "{") {
      const val = this.readBraced();
      return { type: "ExpressionValue", expression: val, start, end: this.i };
    }
    const val = this.readBareAttrValue();
    return { type: "StringValue", value: val, start, end: this.i };
  }

  // ── Children: reads until closing tag or `}` at depth 0 ────

  private parseChildren(): TemplateNode[] {
    const items: TemplateNode[] = [];
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
        items.push(this.parseTree());
        continue;
      }

      if (ch === "{") {
        const inner = this.readBraced();
        items.push({ type: "Expression", expression: inner, start: this.i - inner.length - 2, end: this.i });
        continue;
      }

      if (ch === "@") {
        items.push(...this.parseDirective());
        continue;
      }

      if (ch === "}") break;

      items.push(this.readRawText());
    }
    return items;
  }

  // ── Braced children for directives: reads `{`, children, `}` ──

  private parseBracedChildren(): TemplateNode[] {
    this.skipWs();
    if (this.src[this.i] !== "{") throw new Error(`Expected "{" at position ${this.i}`);
    this.i++;
    const children = this.parseChildren();
    this.skipWs();
    if (this.src[this.i] !== "}") throw new Error(`Expected "}" at position ${this.i}`);
    this.i++;
    return children;
  }

  // ── Directives ──────────────────────────────────────────────

  private parseDirective(): TemplateNode[] {
    const save = this.i;
    this.i++;
    const name = this.readDirectiveName();
    switch (name) {
      case "if": return [this.parseIfChain()];
      case "for": return [this.parseFor()];
      case "switch": return [this.parseSwitch()];
      case "else": case "case": case "default":
        this.i = save;
        return [this.readRawText()];
      default: return [this.parseCustomDirective(name)];
    }
  }

  private parseIfChain(): IfDirectiveNode {
    const start = this.i - 3;
    this.skipWs();
    const condition = this.readGroup("(", ")");
    const consequent = this.parseBracedChildren();

    let alternate: TemplateNode[] | IfDirectiveNode | null = null;

    while (true) {
      const save = this.i;
      this.skipWs();
      if (this.src[this.i] !== "@") { this.i = save; break; }
      this.i++;
      const name = this.readDirectiveName();
      if (name !== "else") { this.i = save; break; }
      this.skipWs();
      if (this.src.startsWith("if", this.i) && !/[A-Za-z0-9_$]/.test(this.src[this.i + 2] ?? "")) {
        this.i += 2;
        alternate = this.parseIfChain();
        return { type: "IfDirective", condition, consequent, alternate, start, end: this.i };
      }
      const elseBody = this.parseBracedChildren();
      alternate = elseBody;
      return { type: "IfDirective", condition, consequent, alternate, start, end: this.i };
    }

    return { type: "IfDirective", condition, consequent, alternate: null, start, end: this.i };
  }

  private parseFor(): ForDirectiveNode {
    const start = this.i - 3;
    this.skipWs();
    const group = this.readGroup("(", ")");
    const parts = splitTopLevel(group, ";");
    const loopPart = (parts[0] ?? "").trim();
    const keyPart = parts[1]?.trim() ?? null;
    const match = loopPart.match(/^([A-Za-z_$][\w$]*)\s+of\s+(.+)$/);
    if (!match) throw new Error(`Invalid @for syntax: expected "item of items"`);

    this.skipWs();
    if (this.src[this.i] === "{") this.i++;

    this.skipWs();
    const element = this.parseElement();

    this.skipWs();
    if (this.src[this.i] !== "}") throw new Error(`Expected "}" to close @for body`);
    this.i++;

    return {
      type: "ForDirective", variable: match[1], iterable: match[2].trim(),
      key: keyPart, children: [element], start, end: this.i,
    };
  }

  private parseSwitch(): SwitchDirectiveNode {
    const start = this.i - 6;
    this.skipWs();
    const discriminant = this.readGroup("(", ")");
    this.skipWs();
    if (this.src[this.i] !== "{") throw new Error(`Expected "{" to open @switch body`);
    this.i++;

    const cases: SwitchCaseNode[] = [];
    let defaultCase: TemplateNode[] | null = null;

    while (true) {
      this.skipWs();
      if (this.src[this.i] === "}") { this.i++; break; }
      if (this.src[this.i] !== "@") throw new Error(`Expected @case or @default inside @switch`);
      this.i++;
      const name = this.readDirectiveName();
      if (name === "case") {
        this.skipWs();
        const test = this.readGroup("(", ")");
        const body = this.parseBracedChildren();
        cases.push({ type: "SwitchCase", test, consequent: body, start: this.i, end: this.i });
      } else if (name === "default") {
        defaultCase = this.parseBracedChildren();
      } else {
        throw new Error(`Unexpected @${name} inside @switch`);
      }
    }

    return { type: "SwitchDirective", discriminant, cases, defaultCase, start, end: this.i };
  }

  private parseCustomDirective(name: string): CustomDirectiveNode {
    const start = this.i - name.length - 1;
    let props: string | null = null;
    this.skipWs();
    if (this.src[this.i] === "(") {
      const inner = this.readGroup("(", ")");
      const propNames = inner.split(",").map(p => p.trim()).filter(Boolean);
      props = propNames.length ? propNames.join(", ") : null;
    }
    const children = this.parseBracedChildren();
    return {
      type: "CustomDirective", name, pascalName: toPascalCase(name),
      props, children, start, end: this.i,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────

  private readGroup(open: string, close: string): string {
    if (this.src[this.i] !== open) throw new Error(`Expected "${open}" at position ${this.i}`);
    let inString: string | null = null;
    let depth = 1;
    const start = this.i + 1;
    this.i++;
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (inString) {
        if (ch === "\\") this.i++;
        else if (ch === inString) inString = null;
      } else if (ch === '"' || ch === "'" || ch === "`") { inString = ch; }
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) { const code = this.src.slice(start, this.i).trim(); this.i++; return code; }
      }
      this.i++;
    }
    throw new Error(`Unbalanced "${open}${close}" in source`);
  }

  private readBraced(): string { return this.readGroup("{", "}"); }

  private readQuoted(): string {
    const quote = this.src[this.i];
    let j = this.i + 1;
    while (j < this.src.length) {
      if (this.src[j] === "\\") j += 2;
      else if (this.src[j] === quote) { const v = this.src.slice(this.i, j + 1); this.i = j + 1; return v; }
      else j++;
    }
    throw new Error(`Unterminated string literal`);
  }

  private readRawText(): TextNode {
    const start = this.i;
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (ch === "<" || ch === "{" || ch === "}" || ch === "@") break;
      this.i++;
    }
    return { type: "Text", raw: this.src.slice(start, this.i), value: cleanText(this.src.slice(start, this.i)), start, end: this.i };
  }

  private readTagName(): string {
    let j = this.i;
    while (j < this.src.length && /[A-Za-z0-9._$-]/.test(this.src[j])) j++;
    const name = this.src.slice(this.i, j); this.i = j; return name;
  }

  private readAttrName(): string {
    let j = this.i;
    while (j < this.src.length && !/[\s=/>{}]/.test(this.src[j])) j++;
    const name = this.src.slice(this.i, j); this.i = j; return name;
  }

  private readDirectiveName(): string {
    let j = this.i;
    while (j < this.src.length && /[A-Za-z0-9-]/.test(this.src[j])) j++;
    const name = this.src.slice(this.i, j); this.i = j; return name;
  }

  private readBareAttrValue(): string {
    let j = this.i;
    while (j < this.src.length && !/[\s>]/.test(this.src[j])) j++;
    const value = this.src.slice(this.i, j); this.i = j; return value;
  }

  private skipWs(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++;
  }

  private consumeClosingTag(tag: string): void {
    if (this.src[this.i] !== "<" || this.src[this.i + 1] !== "/") {
      throw new Error(`Expected closing tag </${tag}> at position ${this.i}`);
    }
    this.i += 2;
    if (tag) {
      if (!this.src.startsWith(tag, this.i)) throw new Error(`Expected closing tag </${tag}>`);
      this.i += tag.length;
    }
    this.skipWs();
    if (this.src[this.i] !== ">") throw new Error(`Malformed closing tag </${tag}>`);
    this.i++;
  }
}

function toPascalCase(name: string): string {
  return name.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

function cleanText(raw: string): string {
  if (!raw.trim()) return "";
  return raw.replace(/\s*\n\s*/g, " ").replace(/^\s+/, "");
}

function splitTopLevel(source: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0, inString: string | null = null;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) { if (ch === "\\") i++; else if (ch === inString) inString = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") inString = ch;
    else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === separator && depth === 0) { parts.push(source.slice(start, i)); start = i + 1; }
  }
  parts.push(source.slice(start));
  return parts;
}
