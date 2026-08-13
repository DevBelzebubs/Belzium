// Input: prop reactiva de un componente
// construida sobre el sistema reactivo (Pulse).
//
// Simétrica a output(): el renderer escribe en .value
// el valor de la prop homónima del componente padre.

import { ref } from "../reactive/ref";

// Marca interna para identificar un Input.
export const IS_INPUT = Symbol("belzium:input");

// Contrato público de un Input.
export interface Input<T = unknown> {
  // Valor de la prop, reactivo.
  value: T;
}

// Implementación concreta de un Input.
class InputImpl<T = unknown> implements Input<T> {
  // Valor almacenado internamente.
  // Participa en el sistema reactivo
  // como cualquier ref.
  private readonly state = ref<T | undefined>(undefined);

  // Marca interna del Input.
  readonly [IS_INPUT] = true;

  // Lectura del valor: registra el efecto
  // actual como dependencia del ref.
  get value(): T {
    return this.state.value as T;
  }

  // Escritura del valor: notifica a los
  // efectos dependientes (ej: render).
  set value(newValue: T) {
    this.state.value = newValue;
  }
}

// Crea un nuevo Input.
export function input<T = unknown>(): Input<T> {
  return new InputImpl<T>();
}

// Comprueba si un valor es un Input.
export function isInput(value: unknown): value is Input<unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  return (value as { [IS_INPUT]?: unknown })[IS_INPUT] === true;
}
