// Errores del compilador .bel.
//
// CompileError extiende Error: conserva el mensaje legible (sobre el que los
// consumidores hacen match) y añade información estructurada de localización
// (línea/columna) más un snippet (la línea con un caret bajo la columna del
// fallo) para que los mensajes sean accionables.

export interface SourcePosition {
  line: number;
  column: number;
}

// Convierte un offset de byte en el source a (línea, columna) 1-indexed.
// Se recorre una sola vez desde el inicio; suficiente para errores puntuales.
export function offsetToLineColumn(source: string, offset: number): SourcePosition {
  if (offset < 0) offset = 0;
  if (offset > source.length) offset = source.length;
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    if (source[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

// Devuelve la línea completa que contiene `offset` (sin el salto de línea).
function lineAt(source: string, offset: number): string {
  if (offset < 0) offset = 0;
  if (offset > source.length) offset = source.length;
  let start = offset;
  let end = offset;
  while (start > 0 && source[start - 1] !== "\n") start--;
  while (end < source.length && source[end] !== "\n" && source[end] !== "\r") end++;
  return source.slice(start, end);
}

// Crea un snippet: la línea del error con un caret bajo la columna del fallo.
// Las tabs se expanden a un espacio para que el caret quede alineado.
export function formatSnippet(source: string, offset: number): string {
  const { column } = offsetToLineColumn(source, offset);
  const lineText = lineAt(source, offset);
  const caretPad = " ".repeat(column - 1);
  return `${lineText}\n${caretPad}^`;
}

// Origen del fallo: el template XML (.bel), una expresión TypeScript
// interpolada, o un error interno del propio compilador.
export type CompileErrorKind = "template" | "expression" | "internal";

export class CompileError extends Error {
  readonly source: string;
  readonly offset: number;
  readonly line: number;
  readonly column: number;
  readonly snippet: string;
  readonly errorKind: CompileErrorKind;

  constructor(message: string, source: string, offset: number,
    errorKind: CompileErrorKind = "internal") {
    const pos = offsetToLineColumn(source, offset);
    const snippet = formatSnippet(source, offset);
    super(`${message}\n  at line ${pos.line}, column ${pos.column}\n${snippet}`);
    this.name = "CompileError";
    this.source = source;
    this.offset = offset;
    this.line = pos.line;
    this.column = pos.column;
    this.snippet = snippet;
    this.errorKind = errorKind;
  }
}
