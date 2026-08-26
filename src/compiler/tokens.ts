// Definiciones de tokens para el tokenizer del compiler .bel.
//
// El tokenizer convierte el source en una secuencia de tokens.
// Los tokens representan las unidades léxicas mínimas: código TypeScript
// passthrough, elementos JSX, atributos, directivas, etc.

// ============================================================
// TIPOS DE TOKEN
// ============================================================

export type TokenType =
  // Código TypeScript que pasa sin modificar (fuera del render/template).
  | "CODE"

  // JSX: apertura y cierre de elementos.
  | "JSX_OPEN"        // <
  | "JSX_CLOSE"       // >
  | "JSX_SELF_CLOSE"  // /> (self-closing)
  | "JSX_SLASH"       // / (dentro de closing tag: </div>)

  // Identificadores JSX: nombre de tag (div, UserCard, Fragment, etc.)
  | "JSX_IDENT"

  // Texto literal entre tags JSX (no interpolado).
  | "JSX_TEXT"

  // Interpolación: { expresión }
  | "EXPR_OPEN"       // {
  | "EXPR_CLOSE"      // }

  // Atributos.
  | "ATTR_NAME"       // onClick, className, etc.
  | "ATTR_EQUALS"     // =

  // Strings literales (valor de atributo o expresión).
  | "STRING"          // "valor" o 'valor' (incluye las comillas)

  // Directivas de plantilla reconocidas por el compilador.
  | "DIRECTIVE"       // @if, @else, @for, @switch, @case, @default

  // Directivas custom: cualquier @NombrePascalCase o @kebab-case
  // que no sea una directiva de plantilla.
  | "CUSTOM_DIRECTIVE" // @clickable, @Card, @my-directive, etc.

  // Agrupadores (paréntesis).
  | "PAREN_OPEN"      // (
  | "PAREN_CLOSE"     // )

  // Agrupadores (llaves).
  | "BRACE_OPEN"      // {
  | "BRACE_CLOSE"     // }

  // Fin de archivo.
  | "EOF";

// ============================================================
// TOKEN
// ============================================================

export interface Token {
  type: TokenType;
  value: string;
  start: number;  // offset del primer carácter en source
  end: number;    // offset del carácter siguiente al último
}

// ============================================================
// CONJUNTOS DE UTILIDAD
// ============================================================

/** Directivas de plantilla que el compilador reconoce como keywords. */
export const TEMPLATE_DIRECTIVES = new Set([
  "if",
  "else",
  "for",
  "switch",
  "case",
  "default",
]);

/** Caracteres que inician un nombre JSX válido (tag). */
export const JSX_IDENT_START = /[A-Za-z_$]/;
export const JSX_IDENT_BODY = /[A-Za-z0-9._$-]/;

/** Caracteres que inician un nombre de atributo válido. */
export const ATTR_NAME_CHARS = /[A-Za-z0-9_$-]/;

/** Crea un token con start/end calculados. */
export function token(
  type: TokenType,
  value: string,
  start: number,
  end: number,
): Token {
  return { type, value, start, end };
}
