// Output: canal de eventos de un componente
// construido sobre el sistema reactivo (Pulse).
//
// No es un EventEmitter: internamente usa un ref
// y sus suscriptores son efectos reactivos.

import { ref } from "../reactive/ref";
import { ReactiveEffect } from "../reactive/effect";

// Marca interna para identificar un Output.
export const IS_OUTPUT = Symbol("belzium:output");

// Contrato público de un Output.
export interface Output<T = unknown> {
  // Emite un valor hacia los suscriptores.
  emit(value: T): void;
  // Se suscribe a las emisiones y devuelve
  // una función para cancelar la suscripción.
  subscribe(listener: (value: T) => void): () => void;
}

// Implementación concreta de un Output.
class OutputImpl<T = unknown> implements Output<T> {
  // Último valor emitido. Participa en el
  // sistema reactivo como cualquier ref.
  private readonly state = ref<T | undefined>(undefined);

  // Marca interna del Output.
  readonly [IS_OUTPUT] = true;

  // Emite un valor escribiendo el ref:
  // el sistema reactivo notifica a los efectos
  // suscritos mediante triggerEffect.
  emit(value: T): void {
    this.state.value = value;
  }

  // Crea un efecto reactivo que lee el ref.
  // La primera ejecución solo registra la
  // dependencia; las posteriores (disparadas
  // por emit) invocan al listener.
  subscribe(listener: (value: T) => void): () => void {
    let firstRun = true;

    const reactiveEffect = new ReactiveEffect(() => {
      const current = this.state.value;
      if (!firstRun) {
        listener(current as T);
      }
      firstRun = false;
    });

    reactiveEffect.run();

    return () => reactiveEffect.stop();
  }
}

// Crea un nuevo Output.
export function output<T = unknown>(): Output<T> {
  return new OutputImpl<T>();
}

// Comprueba si un valor es un Output.
export function isOutput(value: unknown): value is Output<unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  return (value as { [IS_OUTPUT]?: unknown })[IS_OUTPUT] === true;
}
