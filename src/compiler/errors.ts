// Tipos de error del compiler .bel.
//
// CompilerError incluye información de línea y columna para
// mensajes de error útiles. Se calcula el offset del source
// a línea/columna en el momento de lanzar el error.

// ============================================================
// CompilerError
// ============================================================

export class CompilerError extends Error {
  /** Línea 1-indexed. */
  readonly line: number;
  /** Columna 1-indexed. */
  readonly column: number;
  /** Offset de byte en el source original (0-indexed). */
  readonly offset: number;

  constructor(message: string, source: string, offset: number) {
    const pos = offsetToLineColumn(source, offset);
    const loc = `:${pos.line}:${pos.column}`;
    super(`${message} at ${loc}`);
    this.name = "CompilerError";
    this.line = pos.line;
    this.column = pos.column;
    this.offset = offset;
  }
}

// ============================================================
// UTILIDADES
// ============================================================

/**
 * Convierte un offset de byte (0-indexed) a línea y columna (1-indexed).
 *
 * Ejemplo:
 *   source = "abc\ndef\nghi"
 *   offsetToLineColumn(source, 5) → { line: 2, column: 2 }  // la "e" de "def"
 */
export function offsetToLineColumn(
  source: string,
  offset: number,
): { line: number; column: number } {
  let line = 1;
  let column = 1;

  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { line, column };
}

/**
 * Formatea un contexto de error: muestra la línea del source
 * con un indicador de la columna.
 *
 * Ejemplo:
 *   3 |   return <div>
 *     |           ^
 */
export function formatErrorContext(
  source: string,
  offset: number,
  contextLines: number = 2,
): string {
  const pos = offsetToLineColumn(source, offset);
  const lines = source.split("\n");

  const start = Math.max(0, pos.line - 1 - contextLines);
  const end = Math.min(lines.length, pos.line + contextLines);

  const digits = String(end).length;
  const result: string[] = [];

  for (let i = start; i < end; i++) {
    const lineNum = String(i + 1).padStart(digits);
    const marker = i === pos.line - 1 ? " >" : "  ";
    result.push(`${lineNum}${marker} ${lines[i]}`);

    if (i === pos.line - 1) {
      const spaces = " ".repeat(digits + 2 + pos.column - 1);
      result.push(`${spaces}^`);
    }
  }

  return result.join("\n");
}
