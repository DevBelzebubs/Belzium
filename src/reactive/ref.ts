// Ref: contenedor reactivo para un valor individual

import { trackEffect, triggerEffect } from "./dependency";

import { ReactiveEffect } from "./effect";

// Garantiza que reactiveFactory esté registrado antes de usar toReactive
import "./reactive";

import { REF_MARKER, toRaw, toReactive } from "./reactiveContext";

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
    // Marcador estructural no enumerable: permite que reactiveContext
    // (módulo hoja, sin importar ref.ts) detecte este Ref y no lo envuelva.
    Object.defineProperty(this, REF_MARKER, { value: true });
  }

  // Lectura del valor reactivo
  get value(): T {
    // Registra el effect actualmente activo
    // como dependencia de este Ref
    trackEffect(this.deps);

    // Los objetos se envuelven en proxies reactivos
    // (deep reactivity) para que las lecturas anidadas
    // queden trackeadas. Los refs se devuelven tal cual.
    return toReactive(this._value);
  }

  // Escritura del valor reactivo
  set value(newValue: T) {
    // Si el valor no cambió,
    // no existe ninguna actualización
    if (Object.is(this._value, toRaw(newValue))) {
      return;
    }

    // Actualiza el valor interno (se guarda el objeto crudo)
    this._value = toRaw(newValue);

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
