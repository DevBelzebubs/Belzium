import type {
  ProgramNode,
  TopLevelNode,
  PassthroughNode,
  TemplateNode,
  ElementNode,
  FragmentNode,
  TextNode,
  ExpressionNode,
  ExpressionRole,
  IfDirectiveNode,
  ForDirectiveNode,
  SwitchDirectiveNode,
  SwitchCaseNode,
  AttributeNode,
  NormalAttributeNode,
  SpreadAttributeNode,
  AttributeValueNode,
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

  private parseElement(): TemplateNode {
    const start = this.i;
    this.i++;
    const tag = this.readTagName();

    if (tag === "if") return this.parseIfElement(start);
    if (tag === "for") return this.parseForElement(start);
    if (tag === "switch") return this.parseSwitchElement(start);
    if (tag === "else-if" || tag === "else") {
      throw new Error(`<${tag}> must follow <if> or <else-if>`);
    }

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
          attrs.push({
            type: "SpreadAttribute",
            spread: this.makeExpr("spread", inner.slice(3).trim()),
            start: this.i - inner.length - 2,
            end: this.i,
          } as SpreadAttributeNode);
        }
        continue;
      }
      const name = this.readAttrName();
      this.skipWs();
      let value: AttributeValueNode | null = null;
      if (this.src[this.i] === "=") {
        this.i++;
        this.skipWs();
        value = this.readAttrValue(name);
      }
      attrs.push({ type: "Attribute", name, value, start: this.i - name.length, end: this.i } as NormalAttributeNode);
    }
    return attrs;
  }

  private readAttrValue(name: string): AttributeValueNode {
    const start = this.i;
    const v = this.src[this.i];
    if (v === '"' || v === "'") {
      const val = this.readQuoted();
      return { type: "StringValue", value: val.slice(1, -1), start, end: this.i };
    }
    if (v === "{") {
      const val = this.readBraced();
      const role: ExpressionRole = /^on[A-Z]/.test(name) ? "eventHandler" : "attrValue";
      return this.makeExpr(role, val, start, this.i);
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
        const node = this.parseTree();
        if (node.type === "IfDirective") {
          this.attachElseChain(node);
        }
        items.push(node);
        continue;
      }

      if (ch === "{") {
        const inner = this.readBraced();
        items.push(this.makeExpr("text", inner, this.i - inner.length - 2, this.i));
        continue;
      }

      items.push(this.readRawText());
    }
    return items;
  }

  // ── Reserved directive tags ────────────────────────────────

  private parseIfElement(start: number): IfDirectiveNode {
    const condition = this.readDirectiveAttr("condition", start, "condition");
    this.i++;
    const consequent = this.parseChildren();
    this.consumeClosingTag("if");
    return { type: "IfDirective", condition, consequent, alternate: null, start, end: this.i };
  }

  private parseElseIfElement(): IfDirectiveNode {
    const start = this.i;
    this.i += 8;
    const condition = this.readDirectiveAttr("condition", start, "condition");
    this.i++;
    const consequent = this.parseChildren();
    this.consumeClosingTag("else-if");
    return { type: "IfDirective", condition, consequent, alternate: null, start, end: this.i };
  }

  private attachElseChain(ifNode: IfDirectiveNode): void {
    let current = ifNode;
    while (true) {
      this.skipWs();
      if (this.src[this.i] !== "<") return;

      if (this.src.startsWith("<else-if", this.i)) {
        const elseIf = this.parseElseIfElement();
        current.alternate = elseIf;
        current = elseIf;
        continue;
      }

      if (this.src.startsWith("<else>", this.i)) {
        this.i += 6;
        const children = this.parseChildren();
        this.consumeClosingTag("else");
        current.alternate = children;
        return;
      }

      return;
    }
  }

  private parseForElement(start: number): ForDirectiveNode {
    const attributes = this.parseAttributes();
    const eachAttr = attributes.find(a => a.type === "Attribute" && a.name === "each") as NormalAttributeNode | undefined;
    if (!eachAttr || !eachAttr.value) {
      throw new Error(`<for> requires an each attribute`);
    }
    if (eachAttr.value.type !== "Expression") {
      throw new Error(`<for each> expects an expression {...}, e.g. each={item of items}`);
    }
    const eachValue = eachAttr.value.source;
    const match = eachValue.match(/^([A-Za-z_$][\w$]*)\s+of\s+(.+)$/);
    if (!match) {
      throw new Error(`Invalid <for> each syntax: expected "item of items"`);
    }

    const keyAttr = attributes.find(a => a.type === "Attribute" && a.name === "key") as NormalAttributeNode | undefined;
    const key = keyAttr?.value && keyAttr.value.type === "Expression"
      ? { type: "Expression", role: "key", source: keyAttr.value.source, start: 0, end: 0 } as ExpressionNode
      : null;

    this.i++;
    const children = this.parseChildren();
    this.consumeClosingTag("for");
    return {
      type: "ForDirective",
      variable: match[1],
      iterable: { type: "Expression", role: "iterable", source: match[2].trim(), start: 0, end: 0 } as ExpressionNode,
      key,
      children,
      start,
      end: this.i,
    };
  }

  private parseSwitchElement(start: number): SwitchDirectiveNode {
    const discriminant = this.readDirectiveAttr("value", start, "discriminant");
    this.i++;
    const rawChildren = this.parseChildren();
    this.consumeClosingTag("switch");

    const cases: SwitchCaseNode[] = [];
    let defaultCase: TemplateNode[] | null = null;

    for (const child of rawChildren) {
      if (child.type === "Element" && child.tag === "case") {
        const testAttr = child.attributes.find(a => a.type === "Attribute" && a.name === "test") as NormalAttributeNode | undefined;
        if (!testAttr || !testAttr.value) {
          throw new Error(`<case> requires a test attribute`);
        }
        cases.push({
          type: "SwitchCase",
          test: this.exprFromAttrValue(testAttr.value, "caseTest"),
          consequent: child.children,
          start: child.start,
          end: child.end,
        });
      } else if (child.type === "Element" && child.tag === "default") {
        defaultCase = child.children;
      } else if (child.type === "Text" && !child.value) {
        // skip empty text
      } else {
        throw new Error(`Only <case> and <default> allowed inside <switch>`);
      }
    }

    return { type: "SwitchDirective", discriminant, cases, defaultCase, start, end: this.i };
  }

  private readDirectiveAttr(name: string, start: number, role: ExpressionRole): ExpressionNode {
    const attributes = this.parseAttributes();
    const attr = attributes.find(a => a.type === "Attribute" && a.name === name) as NormalAttributeNode | undefined;
    if (!attr || !attr.value) {
      throw new Error(`<...> requires a ${name} attribute`);
    }
    return this.exprFromAttrValue(attr.value, role);
  }

  private exprFromAttrValue(value: AttributeValueNode, role: ExpressionRole): ExpressionNode {
    if (value.type === "Expression") {
      return { type: "Expression", role, source: value.source, start: 0, end: 0 } as ExpressionNode;
    }
    // Soporta literales: <switch value="a"> y <case test="b"> compilan a
    // switch ("a") y case "b": con un StringValue se emite un literal.
    return { type: "Expression", role, source: JSON.stringify(value.value), start: 0, end: 0 } as ExpressionNode;
  }

  private makeExpr(role: ExpressionRole, source: string, start = 0, end = 0): ExpressionNode {
    return { type: "Expression", role, source, start, end };
  }

  // ── Helpers ─────────────────────────────────────────────────

  private readGroup(open: string, close: string): string {
    if (this.src[this.i] !== open) throw new Error(`Expected "${open}"`);
    let inString: string | null = null;
    let depth = 1;
    const start = this.i + 1;
    this.i++;
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (inString) {
        if (ch === "\\") this.i += 2;
        else if (ch === inString) inString = null;
        this.i++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") { inString = ch; this.i++; continue; }
      if (ch === "/" && this.src[this.i + 1] === "/") {
        while (this.i < this.src.length && this.src[this.i] !== "\n") this.i++;
        continue;
      }
      if (ch === "/" && this.src[this.i + 1] === "*") {
        this.i += 2;
        while (this.i < this.src.length - 1 && !(this.src[this.i] === "*" && this.src[this.i + 1] === "/")) this.i++;
        this.i += 2;
        continue;
      }
      if (ch === open) {
        depth++;
      } else if (ch === close) {
        depth--;
        if (depth === 0) {
          this.i++;
          const code = this.src.slice(start, this.i - 1).trim();
          return code;
        }
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
      if (ch === "<" || ch === "{") break;
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
      throw new Error(`Expected closing tag </${tag}>`);
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

function cleanText(raw: string): string {
  if (!raw.trim()) return "";
  return raw.replace(/\s*\n\s*/g, " ").replace(/^\s+/, "");
}
