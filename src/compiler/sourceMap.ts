// Source maps de la salida h()/text() del compilador .bel.
//
// Construimos la salida sobre un MagicString cuyo `original` es el source
// .bel completo: los nodos de template lowered se re-emiten con overwrite en
// su propio rango, los passthrough (TypeScript 1:1) se dejan intactos, y el
// header de imports / inyección de selectors se aplican sobre el mismo
// MagicString. Así `generateMap({ hires: true })` produce un mapa correcto
// output → source sin solapar rangos.

import MagicString from "magic-string";
import type { LoweredTopLevelNode } from "./templateLowering";
import { emitNodeCode } from "./codegen";
import { toKebabCase } from "../component/metadata";

export type { MagicString };

/**
 * Construye el MagicString final de la salida, listo para `generateMap`.
 *
 * `loweredBody` ya debe estar lowered (ver `lowerTemplate`); `header` es el
 * prólogo de imports que se antepone (desplazando todo, lo cual magic-string
 * refleja en el mapa). `source` es el .bel original.
 */
export function buildOutputMagicString(
  source: string,
  loweredBody: LoweredTopLevelNode[],
  header: string,
): MagicString {
  const ms = new MagicString(source);

  for (const node of loweredBody) {
    if (node.type === "Passthrough") continue;
    const code = emitNodeCode(node);
    if (code.length === 0) continue;
    ms.overwrite(node.start, node.end, code);
  }

  applySelectors(ms);
  if (header) ms.prepend(header);
  return ms;
}

// Reemplaza `@Component()` / `@UI()` por `@Component({ selector: ... })`
// sobre el MagicString, preservando el mapeo (el selector inyectado queda sin
// origen, como debe).
function applySelectors(ms: MagicString): void {
  const original = ms.original || "";
  const re = /@(Component|UI)\(\)(?=\s*(?:export\s+|declare\s+|abstract\s+)*class\s+([A-Za-z_$][\w$]*))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(original)) !== null) {
    const decorator = m[1];
    const className = m[2];
    const start = m.index;
    const end = start + m[0].length;
    ms.overwrite(
      start,
      end,
      `@${decorator}({ selector: ${JSON.stringify(toKebabCase(className))} })`,
    );
  }
}