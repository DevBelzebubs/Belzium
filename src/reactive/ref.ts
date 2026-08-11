// Ref: contenedor reactivo para un valor individual

import { trackEffect, triggerEffect } from "./dependency";

import { ReactiveEffect } from "./effect";

// Marca interna utilizada para identificar un Ref
export const IS_REF = Symbol("is_ref");

// Contrato público de un Ref
export interface Ref<T> {
  // Valor reactivo
  value: T;

  // Marca que identifica el objeto como Ref
  [IS_REF]: true;
}

// Implementación concreta de un Ref
export class RefImpl<T> implements Ref<T> {
  // Valor almacenado internamente
  private _value: T;

  // Effects que dependen de este Ref
  private readonly deps = new Set<ReactiveEffect>();

  // Marca interna del Ref
  readonly [IS_REF] = true as const;

  constructor(value: T) {
    this._value = value;
  }

  // Lectura del valor reactivo
  get value(): T {
    // Registra el effect actualmente activo
    // como dependencia de este Ref
    trackEffect(this.deps);

    return this._value;
  }

  // Escritura del valor reactivo
  set value(newValue: T) {
    // Si el valor no cambió,
    // no existe ninguna actualización
    if (Object.is(this._value, newValue)) {
      return;
    }

    // Actualiza el valor interno
    this._value = newValue;

    // Notifica a los effects dependientes
    triggerEffect(this.deps);
  }
}

// Crea un Ref reactivo
export function ref<T>(value: T): RefImpl<T> {
  return new RefImpl(value);
}

// Comprueba si un valor es un Ref
export function isRef(value: unknown): value is Ref<unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  return IS_REF in value && value[IS_REF] === true;
}
