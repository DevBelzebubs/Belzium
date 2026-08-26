// Transforma .bel → TSX válido para el soporte de edición (IDE).
//
// A diferencia de src/compiler.ts (que genera llamadas h()/text()), este
// transform produce un documento TSX que el servicio de TypeScript puede
// analizar. Copia el cuerpo de las directivas verbatim para preservar las
// posiciones (mapeo fuente ↔ virtual) y solo traduce los marcadores @... a
// sintaxis TSX válida:
//
//   @Component()               -> // @Component()        (comentado)
//   @if (c) { ... }            -> { (c) ? (<> ... </>) : null }
//   @for (x of xs; key) { ... }-> { xs.map((x) => (<> ... </>)) }
//   @switch (e) { @case ... }  -> { (() => { switch (e) { ... } })() }
//   @clickable (enabled) { ... }-> { <Clickable enabled={enabled}> ... </Clickable> }

import {
  RUNTIME_APIS,
  splitTopLevel,
  toPascalCase,
} from "./compiler";

// Punto de anclaje de una región generada (directiva o decorador): en source
// `s` es el offset del '@'; en el documento virtual `v` es el offset donde
// comienza el texto generado de ese marcador.
export type MarkerKind = "directive" | "decorator" | "custom";

export interface Marker {
  s: number;
  v: number;
  kind: MarkerKind;
}

// Pliegue de una directiva de plantilla: rango en el source desde su '@'
// hasta la llave de cierre del cuerpo.
export interface FoldingRange {
  start: number;
  end: number;
}

export interface BelTsxResult {
  // Documento TSX completo (incluye el import del runtime si hace falta).
  code: string;

  // Posición de source → posición del documento virtual (offset por caracteres).
  toVirtual(offset: number): number;

  // Posición del documento virtual → posición del source (o null si cae en
  // el import generado o en regiones sin equivalente).
  toSource(offset: number): number | null;

  // Marcadores de las regiones generadas, ordenados por `s` (y por `v`).
  markers: readonly Marker[];

  // Regiones plegables de directivas @ (rango en el source).
  folding: readonly FoldingRange[];
}

// Directivas de plantilla reconocidas por el compilador.
const TEMPLATE_DIRECTIVES = new Set([
  "if",
  "else",
  "for",
  "switch",
  "case",
  "default",
]);

// Nombres de tags XML de directivas que se transforman en TSX válido.
const XML_DIRECTIVES = new Set([
  "if",
  "else-if",
  "else",
  "for",
  "switch",
  "case",
  "default",
]);

// Decoradores de Belzium: se comentan en el documento virtual porque los
// decoradores no son válidos en archivos .tsx (TS1206).
const DECORATORS = new Set([
  "Component",
  "UI",
  "Store",
  "Hook",
  "Directive",
  "Service",
  "Configuration",
  "Bean",
]);

// Palabras que pueden seguir a un decorador de declaración.
const DECLARATION_KEYWORDS = new Set([
  "class",
  "abstract",
  "export",
  "declare",
  "function",
  "const",
  "let",
  "var",
  "interface",
  "type",
  "enum",
]);

// Marco de directiva abierta: cuando la llave de su cuerpo se cierra,
// se emite `close` para balancear el TSX generado.
interface Frame {
  kind: "if" | "else" | "for" | "switch" | "case" | "custom";
  start: number;
  depth: number;
  close: string;
  /** True if this frame was opened by an XML tag (`<if>`) instead of `@if`. */
  xml?: boolean;
  /** Tag name for XML frames (e.g. "if", "else-if", "for"). */
  xmlTag?: string;
}

// Rango verbatim: [s, e) en el source corresponde a [v, v + (e - s)) en el
// documento virtual.
interface Segment {
  s: number;
  e: number;
  v: number;
}

// Expresión leída de un grupo `(...)`: el texto (recortado) y su rango real en
// el source. Se copia verbatim al documento virtual para que completions,
// hover, definición y diagnósticos mapeen a la posición exacta.
interface Cond {
  text: string;
  start: number;
  end: number;
}

// Convierte .bel → TSX con un mapa de posiciones.
export function belToTsx(source: string): BelTsxResult {
  const body = new TsxTransform(source).run();
  const header = buildImportHeader(source);
  const code = header + body.code;
  const segments = body.segments;
  const markers = body.markers;
  const folding = body.folding;

  return {
    code,
    markers,
    folding,

    toVirtual(offset: number): number {
      if (offset < 0) return header.length;
      const idx = lastSegmentAtOrBefore(segments, offset, "s");
      if (idx >= 0) {
        const seg = segments[idx];
        const vEnd = seg.v + (seg.e - seg.s);
        if (offset <= seg.e) return header.length + seg.v + (offset - seg.s);
        // Región generada tras el segmento → su marcador.
        const mIdx = lastMarkerAtOrBefore(markers, offset, "s");
        if (mIdx >= 0) return header.length + markers[mIdx].v;
        // Defensivo: clamp al final del último segmento.
        return header.length + vEnd;
      }
      // Antes del primer segmento: región generada (o inicio del documento).
      const mIdx = lastMarkerAtOrBefore(markers, offset, "s");
      if (mIdx >= 0) return header.length + markers[mIdx].v;
      return header.length;
    },

    toSource(offset: number): number | null {
      if (offset < header.length || offset >= code.length) return null;
      const vOff = offset - header.length;
      const idx = lastSegmentAtOrBefore(segments, vOff, "v");
      if (idx >= 0) {
        const seg = segments[idx];
        const vEnd = seg.v + (seg.e - seg.s);
        if (vOff <= vEnd) return seg.s + (vOff - seg.v);
        // Región generada tras el segmento → su marcador.
        const mIdx = lastMarkerAtOrBefore(markers, vOff, "v");
        if (mIdx >= 0) return markers[mIdx].s;
        return null;
      }
      // Antes del primer segmento: región generada → su marcador.
      const mIdx = lastMarkerAtOrBefore(markers, vOff, "v");
      if (mIdx >= 0) return markers[mIdx].s;
      return null;
    },
  };
}

// Encuentra el último segmento cuyo campo `key` (s o v) es <= `value`.
function lastSegmentAtOrBefore(
  segments: Segment[],
  value: number,
  key: "s" | "v",
): number {
  let lo = 0;
  let hi = segments.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid][key] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

// Igual que lastSegmentAtOrBefore pero para los marcadores.
function lastMarkerAtOrBefore(
  markers: readonly Marker[],
  value: number,
  key: "s" | "v",
): number {
  let lo = 0;
  let hi = markers.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (markers[mid][key] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

// Declaración global mínima de JSX: evita que el documento virtual necesite
// tipos de React para poder analizar JSX (IntrinsicElements/attrs abiertos).
const JSX_GLOBALS = `declare global {
  namespace JSX {
    interface Element {}
    interface ElementClass {}
    interface ElementAttributesProperty {}
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicAttributes { [key: string]: any; }
    interface IntrinsicElements { [name: string]: any; }
  }
}

`;

// Antepone el import del runtime con las APIs detectadas en el source.
// Se omite si el source ya contiene un import (la app maneja el suyo).
function buildImportHeader(source: string): string {
  if (/\bimport\b/.test(source)) return "";

  const used = new Set<string>();
  for (const api of RUNTIME_APIS) {
    if (new RegExp(`\\b${api}\\b`).test(source)) {
      used.add(api);
    }
  }

  const imports = [...used].sort((a, b) =>
    a.toLowerCase() < b.toLowerCase()
      ? -1
      : a.toLowerCase() > b.toLowerCase()
        ? 1
        : 0,
  );

  if (imports.length === 0) return JSX_GLOBALS;
  return `import { ${imports.join(", ")} } from "belzium";\n\n${JSX_GLOBALS}`;
}

// Escáner de un solo pase que copia el source y traduce las directivas.
class TsxTransform {
  private i = 0;
  private out = "";
  private runStart = 0;
  private runVStart = -1;
  private depth = 0;
  private frames: Frame[] = [];
  private readonly segments: Segment[] = [];
  private readonly markers: Marker[] = [];
  private readonly folding: FoldingRange[] = [];

  constructor(private src: string) {}

  run(): {
    code: string;
    segments: Segment[];
    markers: Marker[];
    folding: FoldingRange[];
  } {
    while (this.i < this.src.length) {
      const ch = this.src[this.i];

      if (ch === '"' || ch === "'") {
        this.copyString(ch);
        continue;
      }
      if (ch === "`") {
        this.copyTemplate();
        continue;
      }
      if (ch === "/" && this.src[this.i + 1] === "/") {
        this.copyLineComment();
        continue;
      }
      if (ch === "/" && this.src[this.i + 1] === "*") {
        this.copyBlockComment();
        continue;
      }
      if (ch === "@") {
        this.handleAt();
        continue;
      }
      if (ch === "<") {
        if (this.handleXmlTag()) continue;
      }
      if (ch === "{") {
        if (this.frames.length > 0) this.depth++;
        this.copyChar(ch);
        continue;
      }
      if (ch === "}") {
        const top = this.frames[this.frames.length - 1];
        if (top && this.depth === top.depth && !top.xml) {
          this.closeTopFrame();
        } else {
          if (this.frames.length > 0 && !(top?.xml)) this.depth--;
          this.copyChar(ch);
        }
        continue;
      }

      this.copyChar(ch);
    }

    this.flushRun();
    return {
      code: this.out,
      segments: this.segments,
      markers: this.markers,
      folding: this.folding,
    };
  }

  // ------------------------------------------------------------------
  // Copia verbatim
  // ------------------------------------------------------------------

  private copyChar(ch: string): void {
    if (this.runVStart < 0) {
      this.runStart = this.i;
      this.runVStart = this.out.length;
    }
    this.out += ch;
    this.i++;
  }

  private copyRaw(start: number, end: number): void {
    this.i = start;
    while (this.i < end) {
      this.copyChar(this.src[this.i]);
    }
  }

  private flushRun(): void {
    if (this.runVStart >= 0) {
      this.segments.push({ s: this.runStart, e: this.i, v: this.runVStart });
      this.runVStart = -1;
    }
  }

  private copyString(quote: string): void {
    this.copyChar(this.src[this.i]);
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      this.copyChar(ch);
      if (ch === "\\") {
        if (this.i < this.src.length) this.copyChar(this.src[this.i]);
        continue;
      }
      if (ch === quote) return;
    }
  }

  private copyTemplate(): void {
    this.copyChar("`");
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      this.copyChar(ch);
      if (ch === "\\") {
        if (this.i < this.src.length) this.copyChar(this.src[this.i]);
        continue;
      }
      if (ch === "`") return;
    }
  }

  private copyLineComment(): void {
    this.copyChar("/");
    this.copyChar("/");
    while (this.i < this.src.length && this.src[this.i] !== "\n") {
      this.copyChar(this.src[this.i]);
    }
  }

  private copyBlockComment(): void {
    this.copyChar("/");
    this.copyChar("*");
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      this.copyChar(ch);
      if (ch === "*" && this.src[this.i] === "/") {
        this.copyChar("/");
        return;
      }
    }
  }

  // ------------------------------------------------------------------
  // Marcadores @
  // ------------------------------------------------------------------

  private handleAt(): void {
    // El run verbatim termina justo antes del '@' (este carácter nunca se
    // copia verbatim). Flushear aquí registra el segmento con su rango real;
    // antes se flusheaba tarde (en openFrame) y el segmento estiraba su `e`
    // más allá de lo copiado, desplazando el mapeo de posiciones.
    this.flushRun();
    const start = this.i;
    this.i++; // consume '@'
    const name = this.readName();

    if (name === "") {
      this.copyRaw(start, this.i);
      return;
    }

    if (TEMPLATE_DIRECTIVES.has(name)) {
      this.handleTemplateDirective(name, start);
      return;
    }

    // Directiva custom o decorador: se distingue por el cuerpo `{ ... }`.
    this.skipWs();
    const endOfName = this.i;
    let groupInner: string | null = null;
    let endOfGroup = endOfName;
    if (this.src[this.i] === "(") {
      groupInner = this.readGroup("(", ")").text;
      endOfGroup = this.i;
    }
    this.skipWs();

    if (this.src[this.i] === "{") {
      this.handleCustomDirective(name, groupInner, start);
      return;
    }

    // Decorador: se comenta para evitar TS1206 (decorators in .tsx).
    const end = groupInner !== null ? endOfGroup : endOfName;
    const isKnownDecorator = DECORATORS.has(name);
    const looksLikeDeclaration =
      groupInner !== null && this.isDeclaration();
    if (isKnownDecorator || looksLikeDeclaration) {
      this.commentOut(start, end);
    } else {
      // Email, texto o decorador desconocido: se conserva verbatim.
      this.copyRaw(start, end);
    }
  }

  private isDeclaration(): boolean {
    const word = /^[A-Za-z_$][\w$]*/.exec(this.src.slice(this.i));
    return word !== null && DECLARATION_KEYWORDS.has(word[0]);
  }

  // Convierte un decorador en comentario de bloque para no tragar el resto
  // de la línea (p. ej. `@Component() export class Counter {`) ni romper el
  // TSX. Soporta decoradores multilínea.
  private commentOut(start: number, end: number): void {
    this.flushRun();
    this.markers.push({ s: start, v: this.out.length, kind: "decorator" });
    const raw = this.src.slice(start, end);
    const commented = raw
      .split("\n")
      .map((line) => `/* ${line} */`)
      .join("\n");
    this.out += commented;
    this.i = end;
  }

  // ------------------------------------------------------------------
  // Directivas de plantilla
  // ------------------------------------------------------------------

  private handleTemplateDirective(name: string, start: number): void {
    // El marcador ancla la región generada de esta directiva a su '@'.
    this.markers.push({ s: start, v: this.out.length, kind: "directive" });
    switch (name) {
      case "if": {
        this.skipWs();
        const cond = this.readGroup("(", ")");
        this.openFrame("if", start, "{ (", cond, ") ? (<>", `</>) : null }`);
        return;
      }
      case "for": {
        this.skipWs();
        const group = this.readGroup("(", ")");
        const parts = splitTopLevel(group.text, ";");
        const match = parts[0]
          ?.trim()
          .match(/^([A-Za-z_$][\w$]*)\s+of\s+(.+)$/);
        if (!match) {
          throw new Error(`Invalid @for syntax: expected "item of items"`);
        }
        const item = match[1];
        const iterable = match[2].trim();
        const iterableStart = group.start + group.text.indexOf(iterable);
        const iterableCond: Cond = {
          text: iterable,
          start: iterableStart,
          end: iterableStart + iterable.length,
        };
        this.openFrame(
          "for",
          start,
          "{ ",
          iterableCond,
          `.map((${item}) => (<>`,
          `</>)) }`,
        );
        return;
      }
      case "switch": {
        this.skipWs();
        const expr = this.readGroup("(", ")");
        this.openFrame(
          "switch",
          start,
          "{ (() => { switch (",
          expr,
          ") {",
          `} })() }`,
        );
        return;
      }
      case "case": {
        this.skipWs();
        const value = this.readGroup("(", ")");
        this.openFrame("case", start, "case (", value, "): return (<>", `</>);`);
        return;
      }
      case "default": {
        this.openFrame("case", start, "default: return (<>", null, "", `</>);`);
        return;
      }
      case "else": {
        // @else suelto (sin @if): se copia verbatim, sin marcador.
        this.markers.pop();
        this.copyRaw(start, this.i);
        return;
      }
    }
  }

  // Abre una directiva: consume `{`, empuja el marco y emite el apertura.
  private openFrame(
    kind: Frame["kind"],
    start: number,
    prefix: string,
    cond: Cond | null,
    suffix: string,
    close: string,
  ): void {
    this.skipWs();
    if (this.src[this.i] !== "{") {
      throw new Error(`Expected "{" at position ${this.i}`);
    }
    this.i++;
    this.depth++;
    this.frames.push({ kind, start, depth: this.depth, close });
    this.flushRun();
    this.emitOpen(prefix, cond, suffix);
  }

  // Emite el texto de apertura de una directiva; si hay condición, su texto
  // se copia verbatim (segmento) para preservar el mapeo de posiciones.
  private emitOpen(prefix: string, cond: Cond | null, suffix: string): void {
    this.out += prefix;
    if (cond) this.appendCond(cond);
    this.out += suffix;
  }

  private appendCond(cond: Cond): void {
    this.segments.push({ s: cond.start, e: cond.end, v: this.out.length });
    this.out += cond.text;
  }

  private handleCustomDirective(
    name: string,
    groupInner: string | null,
    start: number,
  ): void {
    this.markers.push({ s: start, v: this.out.length, kind: "custom" });
    const tag = toPascalCase(name);
    const props = groupInner
      ? groupInner
          .split(",")
          .map((prop) => prop.trim())
          .filter((prop) => prop !== "")
      : [];
    const attrs = props.map((prop) => `${prop}={${prop}}`).join(" ");
    this.openFrame(
      "custom",
      start,
      `{ <${tag}${attrs ? ` ${attrs}` : ""}>`,
      null,
      "",
      `</${tag}> }`,
    );
  }

  // ------------------------------------------------------------------
  // Directivas XML (<if>, <for>, <switch>, etc.)
  // ------------------------------------------------------------------

  private handleXmlTag(): boolean {
    const start = this.i;

    // ── Closing tag: </tagname> ──
    if (this.src[this.i + 1] === "/") {
      const nameStart = this.i + 2;
      const save = this.i;
      this.i = nameStart;
      const name = this.readName();
      this.skipWs();

      if (XML_DIRECTIVES.has(name) && this.src[this.i] === ">") {
        const top = this.frames[this.frames.length - 1];
        if (top?.xml && top.xmlTag === name) {
          this.flushRun();
          this.markers.push({
            s: start,
            v: this.out.length,
            kind: "directive",
          });
          this.folding.push({ start: top.start, end: this.i });
          this.i++; // consume '>'
          this.depth--;

          // Encadenar else / else-if tras </if> o </else>
          if (top.kind === "if" || top.kind === "else") {
            const elseInfo = this.peekXmlElse();
            if (elseInfo) {
              this.flushRun();
              this.markers.push({
                s: elseInfo.at,
                v: this.out.length,
                kind: "directive",
              });
              this.out += elseInfo.prefix;
              if (elseInfo.cond) this.appendCond(elseInfo.cond);
              this.out += elseInfo.suffix;
              this.i = elseInfo.bodyOpen;
              this.frames[this.frames.length - 1] = {
                kind: elseInfo.kind,
                start: elseInfo.at,
                depth: this.depth,
                close: elseInfo.close,
                xml: true,
                xmlTag: elseInfo.xmlTag,
              };
              return true;
            }
          }

          this.out += top.close;
          this.frames.pop();
          return true;
        }
      }

      this.i = save;
      return false;
    }

    // ── Opening tag: <tagname ...> ──
    const save = this.i;
    this.i++; // skip '<'
    const name = this.readName();

    if (!XML_DIRECTIVES.has(name)) {
      this.i = save;
      return false;
    }

    this.flushRun();
    this.markers.push({ s: start, v: this.out.length, kind: "directive" });

    switch (name) {
      case "if": {
        const cond = this.readXmlAttr("condition");
        this.skipWs();
        if (this.src[this.i] !== ">") { this.i = save; return false; }
        this.i++; // skip '>'
        this.openXmlFrame("if", start, "{ (", cond, ") ? (<>", `</>) : null }`, "if");
        return true;
      }
      case "else-if": {
        const cond = this.readXmlAttr("condition");
        this.skipWs();
        if (this.src[this.i] !== ">") { this.i = save; return false; }
        this.i++; // skip '>'
        this.openXmlFrame(
          "if",
          start,
          `</>) : (`,
          cond,
          `) ? (<>`,
          `</>) : null }`,
          "else-if",
        );
        return true;
      }
      case "else": {
        this.skipWs();
        if (this.src[this.i] !== ">") { this.i = save; return false; }
        this.i++; // skip '>'
        this.openXmlFrame("else", start, `</>) : (<>`, null, "", `</>) }`, "else");
        return true;
      }
      case "for": {
        const eachCond = this.readXmlAttr("each");
        const match = eachCond.text.match(
          /^([A-Za-z_$][\w$]*)\s+of\s+(.+)$/,
        );
        if (!match) { this.i = save; return false; }
        const item = match[1];
        const iterable = match[2].trim();
        const iterableCond: Cond = {
          text: iterable,
          start: eachCond.start + eachCond.text.indexOf(iterable),
          end:
            eachCond.start + eachCond.text.indexOf(iterable) + iterable.length,
        };
        // skip key={...} if present
        this.skipWs();
        if (this.src.startsWith("key=", this.i)) {
          this.i += 4;
          this.readGroup("{", "}");
        }
        this.skipWs();
        if (this.src[this.i] !== ">") { this.i = save; return false; }
        this.i++; // skip '>'
        this.openXmlFrame(
          "for",
          start,
          "{ ",
          iterableCond,
          `.map((${item}) => (<>`,
          `</>)) }`,
          "for",
        );
        return true;
      }
      case "switch": {
        const expr = this.readXmlAttr("value");
        this.openXmlFrame(
          "switch",
          start,
          `{ (() => { switch (`,
          expr,
          `) {`,
          `} })() }`,
          "switch",
        );
        return true;
      }
      case "case": {
        const val = this.readXmlAttr("test");
        this.openXmlFrame(
          "case",
          start,
          "case (",
          val,
          "): return (<>",
          `</>);`,
          "case",
        );
        return true;
      }
      case "default": {
        this.skipWs();
        if (this.src[this.i] !== ">") { this.i = save; return false; }
        this.i++; // skip '>'
        this.openXmlFrame(
          "case",
          start,
          "default: return (<>",
          null,
          "",
          `</>);`,
          "default",
        );
        return true;
      }
    }

    this.i = save;
    return false;
  }

  private readXmlAttr(attrName: string): Cond {
    this.skipWs();
    if (!this.src.startsWith(attrName + "=", this.i)) {
      throw new Error(`Expected attribute "${attrName}"`);
    }
    this.i += attrName.length + 1; // skip attrName=
    if (this.src[this.i] !== "{") {
      throw new Error(`Expected "{" for attribute "${attrName}"`);
    }
    return this.readGroup("{", "}");
  }

  private openXmlFrame(
    kind: Frame["kind"],
    start: number,
    prefix: string,
    cond: Cond | null,
    suffix: string,
    close: string,
    xmlTag: string,
  ): void {
    this.depth++;
    this.frames.push({
      kind,
      start,
      depth: this.depth,
      close,
      xml: true,
      xmlTag,
    });
    this.flushRun();
    this.emitOpen(prefix, cond, suffix);
  }

  private peekXmlElse(): {
    prefix: string;
    cond: Cond | null;
    suffix: string;
    bodyOpen: number;
    at: number;
    kind: "if" | "else";
    close: string;
    xmlTag: string;
  } | null {
    const save = this.i;
    try {
      this.skipWs();
      if (this.src[this.i] !== "<") throw new Error("no xml else");
      if (this.src[this.i + 1] === "/") throw new Error("no xml else");
      const at = this.i;
      this.i++; // skip '<'
      const name = this.readName();
      if (name !== "else" && name !== "else-if") throw new Error("no xml else");

      if (name === "else-if") {
        const cond = this.readXmlAttr("condition");
        this.skipWs();
        if (this.src[this.i] !== ">") throw new Error("no >");
        this.i++; // skip '>'
        return {
          prefix: `</>) : (`,
          cond,
          suffix: `) ? (<>`,
          bodyOpen: this.i,
          at,
          kind: "if",
          close: `</>) : null }`,
          xmlTag: "else-if",
        };
      }

      // <else>
      this.skipWs();
      if (this.src[this.i] !== ">") throw new Error("no >");
      this.i++; // skip '>'
      return {
        prefix: `</>) : (<>`,
        cond: null,
        suffix: "",
        bodyOpen: this.i,
        at,
        kind: "else",
        close: `</>) }`,
        xmlTag: "else",
      };
    } catch {
      this.i = save;
      return null;
    }
  }

  private closeTopFrame(): void {
    const top = this.frames[this.frames.length - 1];

    // Registra el pliegue de la directiva: desde su '@' hasta la llave de
    // cierre del cuerpo (this.i aún apunta a la llave).
    this.folding.push({ start: top.start, end: this.i });

    // Consume la llave de cierre del cuerpo y decrementa la profundidad.
    // peekElse() mira a partir de aquí.
    this.i++;
    this.depth--;

    // Un @if/@else puede continuar con @else / @else if.
    if (top.kind === "if" || top.kind === "else") {
      const elseInfo = this.peekElse();
      if (elseInfo) {
        this.flushRun();
        this.markers.push({ s: elseInfo.at, v: this.out.length, kind: "directive" });
        this.out += elseInfo.prefix;
        if (elseInfo.cond) this.appendCond(elseInfo.cond);
        this.out += elseInfo.suffix;
        this.i = elseInfo.bodyOpen;
        this.i++; // consume '{' del cuerpo del @else
        this.depth++;
        // El cierre del @else termina la expresión: sin ": null" extra,
        // porque el body del @else ya es la rama else del ternario.
        this.frames[this.frames.length - 1] = {
          kind: "else",
          start: elseInfo.at,
          depth: this.depth,
          close: `</>) }`,
        };
        return;
      }
    }

    this.flushRun();
    this.out += top.close;
    this.frames.pop();
  }

  // Comprueba si tras el cierre del @if actual viene un @else / @else if.
  // Devuelve null si no; en éxito deja `this.i` apuntando al '{' del cuerpo
  // y `at` es el offset del '@' del @else en el source.
  private peekElse(): {
    prefix: string;
    cond: Cond | null;
    suffix: string;
    bodyOpen: number;
    at: number;
  } | null {
    const save = this.i;
    try {
      this.skipWs();
      if (this.src[this.i] !== "@") throw new Error("no else");
      const at = this.i;
      this.i++;
      if (this.readName() !== "else") throw new Error("no else");
      this.skipWs();

      if (
        this.src.startsWith("if", this.i) &&
        !/[A-Za-z0-9_$]/.test(this.src[this.i + 2] ?? "")
      ) {
        this.i += 2;
        this.skipWs();
        const cond = this.readGroup("(", ")");
        this.skipWs();
        if (this.src[this.i] !== "{") throw new Error("no body");
        return { prefix: `</>) : (`, cond, suffix: `) ? (<>`, bodyOpen: this.i, at };
      }

      if (this.src[this.i] !== "{") throw new Error("no body");
      return { prefix: `</>) : (<>`, cond: null, suffix: "", bodyOpen: this.i, at };
    } catch {
      this.i = save;
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Lectura de tokens
  // ------------------------------------------------------------------

  private readName(): string {
    if (!/[A-Za-z_$]/.test(this.src[this.i] ?? "")) return "";
    let j = this.i;
    while (j < this.src.length && /[A-Za-z0-9$-]/.test(this.src[j])) {
      j++;
    }
    const name = this.src.slice(this.i, j);
    this.i = j;
    return name;
  }

  private readGroup(open: string, close: string): Cond {
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
          const end = this.i;
          this.i++;
          return this.trimCond(start, end);
        }
      }
      this.i++;
    }

    throw new Error(`Unbalanced "${open}${close}" in source`);
  }

  private trimCond(start: number, end: number): Cond {
    let s = start;
    let e = end;
    while (s < e && /\s/.test(this.src[s])) s++;
    while (e > s && /\s/.test(this.src[e - 1])) e--;
    return { text: this.src.slice(s, e), start: s, end: e };
  }

  private skipWs(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) {
      this.i++;
    }
  }
}
