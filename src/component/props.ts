// Props de componentes: datos proporcionados por el componente padre

import { reactive } from "../reactive/reactive";

// Estado interno utilizado para mantener
// la identidad de las props durante la vida
// del componente.
export interface ComponentProps<T extends Record<string, unknown>> {
  // Objeto reactivo interno.
  target: T;

  // Proxy público de solo lectura.
  readonly: Readonly<T>;
}

// Crea las props reactivas de un componente
export function createProps<T extends Record<string, unknown>>(
  props: T,
): ComponentProps<T> {
  // El objeto interno es el que realmente
  // participa en el sistema reactivo.
  const target = reactive({
    ...props,
  });

  // El componente solamente recibe
  // acceso de lectura.
  const readonly = new Proxy(target, {
    set() {
      throw new Error(`Component props are readonly`);
    },

    deleteProperty() {
      throw new Error(`Component props are readonly`);
    },
  }) as Readonly<T>;

  return {
    target,
    readonly,
  };
}

// Actualiza las props manteniendo
// la identidad del objeto reactivo.
export function updateProps<T extends Record<string, unknown>>(
  target: Record<string, unknown>,
  next: T,
): void {
  // Actualiza las props existentes
  // y agrega las nuevas.
  for (const key of Object.keys(next)) {
    target[key] = next[key];
  }

  // Elimina las props que
  // ya no existen.
  for (const key of Object.keys(target)) {
    if (!(key in next)) {
      delete target[key];
    }
  }
}
