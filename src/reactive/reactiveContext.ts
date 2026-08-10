import { RAW } from "./reactive";

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
  return reactiveFactory(value as object) as T;
}
export function toRaw<T>(value: T): T {
  // Convierte un objeto reactivo a su objeto crudo correspondiente, de lo contrario retorna el valor tal cual
  if (typeof value !== "object" || value === null) {
    return value;
  }

  return ((value as any)[RAW] ?? value) as T;
}
