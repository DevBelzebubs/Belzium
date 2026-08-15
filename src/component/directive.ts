// Directive: template decorator definido por el usuario.
//
// @Directive() marca una clase que el compilador .bel utiliza como
// directiva personalizada: @nombre (props) { children } compila a
// h(NombrePascal, { props }, [ children ]).
//
// A nivel de runtime una directiva ES un componente: comparte
// props, slots y ciclo de vida.

import { defineMetadata, getMetadata } from "../di/metadata";
import {
  defineComponentMetadata,
  toKebabCase,
} from "./metadata";

// Metadata que identifica una Directiva.
export const DIRECTIVE_METADATA = Symbol("belzium:directive");

export interface DirectiveMetadata {
  isDirective: true;
}

export function getDirectiveMetadata(
  target: object,
): DirectiveMetadata | undefined {
  return getMetadata<DirectiveMetadata>(DIRECTIVE_METADATA, target);
}

// @Directive(): marca una clase como directiva reutilizable.
export function Directive(): <T extends new (...args: never[]) => object>(
  target: T,
) => T {
  return <T extends new (...args: never[]) => object>(target: T): T => {
    defineMetadata(DIRECTIVE_METADATA, { isDirective: true }, target);

    // Una directiva también es un componente renderizable.
    defineComponentMetadata(target, {
      type: target,
      selector: toKebabCase(target.name),
    });

    return target;
  };
}
