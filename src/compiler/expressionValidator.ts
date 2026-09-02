// Validación sintáctica de las expresiones TypeScript interpoladas en .bel.
//
// El propósito es detectar errores de SINTAXIS en el texto de cada expresión
// ({expr}, onX={expr}, condition={expr}, ...) antes de que llegue al bundler.
// No valida tipos (para eso ya está tsc del proyecto): solo garantiza que la
// expresión sea una construcción TypeScript bien formada.
//
// Se apoya en el parser de TypeScript (ts.createSourceFile) para no reinventar
// el lenguaje, envolviendo cada expresión en un "probe" sintáctico y filtrando
// los diagnósticos sintácticos que caen dentro del rango de la expresión.

import ts from "typescript";
import { CompileError } from "./errors";
import type { ExpressionRole } from "./nodes";

// Zonas de error amigables por rol, para dar mensajes accionables según el
// contexto en el que apareció la expresión.
const ROLE_LABELS: Record<ExpressionRole, string> = {
  text: "interpolación de texto",
  attrValue: "valor de atributo",
  eventHandler: "handler de evento",
  spread: "spread de props",
  condition: "condición de <if>",
  iterable: "iterable de <for>",
  key: "key de <for>",
  discriminant: "expresión de <switch>",
  caseTest: "test de <case>",
};

// Prefijo del probe: fuerza que el contenido sea una expresión.
const PROBE_PREFIX = "const __probe = (";
const PROBE_SUFFIX = ");";

/**
 * Valida que `source` sea una expresión TypeScript sintácticamente válida.
 *
 * Si no lo es, lanza un {@link CompileError} con la posición (offset) dada
 * y un mensaje específico del rol. `offset` es la posición absoluta de la
 * expresión en el archivo .bel original (para el mensaje de línea/columna),
 * y `fileSource` el contenido completo del .bel para producir el snippet.
 */
export function validateExpression(
  source: string,
  role: ExpressionRole,
  offset: number,
  fileSource: string,
): void {
  // Envuelve la expresión en un probe `(expr)`, de modo que el parser exige
  // que el contenido sea una expresión y no una lista de statements suelta.
  const probeDoc = `${PROBE_PREFIX}${source}${PROBE_SUFFIX}`;
  const sf = ts.createSourceFile(
    "probe.ts",
    probeDoc,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );

  // La expresión ocupa [contentStart, contentStart + source.length). Un
  // diagnóstico propio de la expresión cae en ese rango, incluido un error en
  // su último carácter (p. ej. `this.count.` reporta en el "." final) o un
  // paréntesis desbalanceado (que TS reporta sobre el ")" de cierre del probe,
  // por eso el rango se extiende un carácter más allá).
  const contentStart = PROBE_PREFIX.length;
  const contentLast = contentStart + source.length + 1;

  const parseDiags: ReadonlyArray<ts.Diagnostic> = (sf as unknown as {
    parseDiagnostics: ReadonlyArray<ts.Diagnostic>;
  }).parseDiagnostics;

  const offending = parseDiags.find(
    (d) =>
      d.category === ts.DiagnosticCategory.Error &&
      d.start !== undefined &&
      d.start >= contentStart &&
      d.start <= contentLast,
  );

  if (offending) {
    const shown = source.trim().length > 60
      ? `${source.trim().slice(0, 60)}…`
      : source.trim();
    const rel = Math.max(0, (offending.start ?? contentStart) - contentStart);
    throw new CompileError(
      `Expresión ${ROLE_LABELS[role]} inválida: ${shown}`,
      fileSource,
      offset + Math.min(rel, source.length),
      "expression",
    );
  }
}