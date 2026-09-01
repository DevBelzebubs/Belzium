// Módulo hoja (sin imports) que centraliza la conversión crudo <-> reactivo.
// Al no importar a nadie, siempre se evalúa por completo antes que reactive.ts
// o ref.ts, evitando ciclos y el error "setReactiveFactory is not a function"
// durante la evaluación parcial de módulos.

export const RAW = Symbol("raw"); // Key especial que expone el objeto crudo tras un proxy reactivo

// Marcador estructural (string) para identificar un Ref sin importar ref.ts.
// Los Ref lo definen como propiedad propia no enumerable (Object.defineProperty),
// de modo que no aparece en los miembros de completado de la API pública.
export const REF_MARKER = "__belzium__ref__";

type ReactiveFactory = <T extends object>(target: T) => T;
// Usamos el patrón factory para crear objetos reactivos
let reactiveFactory: ReactiveFactory;
export const rawMap = new WeakMap<object, object>(); // Cache de proxies reactivos → sus objetos crudos (para toRaw y para detectar que un valor ya es reactivo)

export function setReactiveFactory(factory: ReactiveFactory) {
  // Establece la función que se usará para crear objetos reactivos
  reactiveFactory = factory;
}
export function toReactive<T>(value: T): T {
  // Convierte un valor a un objeto reactivo si es un objeto, de lo contrario retorna el valor tal cual
  if (typeof value !== "object" || value === null) {
    return value;
  }

  // Los refs ya son reactivos y gestionan su propio seguimiento
  // de dependencias; envolverlos en otro proxy rompe sus Sets internos.
  if (
    REF_MARKER in value &&
    (value as Record<string, unknown>)[REF_MARKER] === true
  ) {
    return value;
  }

  return reactiveFactory(value as object) as T;
}
export function toRaw<T>(value: T): T {
  // Convierte un objeto reactivo a su objeto crudo correspondiente, de lo contrario retorna el valor tal cual
  if (typeof value !== "object" || value === null) {
    return value;
  }

  return ((value as any)[RAW] ?? value) as T;
}