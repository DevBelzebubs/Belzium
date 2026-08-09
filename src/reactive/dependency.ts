import { activeEffect, ReactiveEffect } from "./effect";
const targetMap = new WeakMap<object, Map<PropertyKey, Set<ReactiveEffect>>>();
type TriggerType = "SET" | "ADD" | "DELETE";
export const ITERATE_KEY = Symbol("iterate"); // Key especial trackeada al iterar (Object.keys, for..in, size, iteradores de colecciones)
export const MAP_KEY_ITERATE_KEY = Symbol("Map key iterate"); // Key especial para la iteración de keys de un Map
const isArrayIndex = (key: PropertyKey): boolean =>
  typeof key === "string" &&
  Number.isInteger(Number(key)) &&
  Number(key) >= 0 &&
  Number(key) < 0xffffffff &&
  String(Number(key)) === key;

export function track(target: object, key: PropertyKey) {
  if (!activeEffect) return; // Si no hay un efecto activo, no pasa nada
  let depsMap = targetMap.get(target); // Map del objeto

  if (!depsMap) {
    depsMap = new Map();
    targetMap.set(target, depsMap); // Crea un nuevo map para el objeto si no existe
  }

  let deps = depsMap.get(key); // Set de efectos para la propiedad

  if (!deps) {
    deps = new Set();
    depsMap.set(key, deps); // Crea un nuevo set de efectos para la propiedad si no existe
  }
  trackEffect(deps); // Agrega el efecto activo al set de efectos para la propiedad
}
export function trigger(
  target: object,
  key: PropertyKey,
  type: TriggerType,
  newValue?: unknown,
) {
  const depsMap = targetMap.get(target); // Map del objeto

  if (!depsMap) return;
  const effects = new Set<ReactiveEffect>();

  const deps = depsMap.get(key); // Set de efectos para la propiedad

  if (deps) {
    deps.forEach((effect) => {
      effects.add(effect);
    });
  }
  const lengthEffects = depsMap.get("length"); // Al agregar un índice, la longitud cambia
  if (Array.isArray(target) && type === "ADD" && isArrayIndex(key)) {
    if (lengthEffects) {
      lengthEffects.forEach((effect) => {
        effects.add(effect);
      });
    }
  }
  if (Array.isArray(target) && key === "length" && type === "SET") {
    // Si se está estableciendo la longitud de un array, se dispara los efectos de los índices
    const newLength = Number(newValue);
    const iterateEffects = depsMap.get(ITERATE_KEY);
    depsMap.forEach((dep, depKey) => {
      if (isArrayIndex(depKey) && Number(depKey) >= newLength) {
        dep.forEach((effect) => {
          effects.add(effect);
        });
      }
    });
  }
  if (type === "ADD" || type === "DELETE") {
    const iterateEffects = depsMap.get(ITERATE_KEY);

    if (iterateEffects) {
      iterateEffects.forEach((effect) => {
        effects.add(effect);
      });
    }
    if (target instanceof Map) {
      const mapKeyEffects = depsMap.get(MAP_KEY_ITERATE_KEY);

      if (mapKeyEffects) {
        mapKeyEffects.forEach((effect) => {
          effects.add(effect);
        });
      }
    }
  }
  triggerEffect(effects);
}
export function trackEffect(deps: Set<ReactiveEffect>) {
  if (!activeEffect) return; // Si no hay un efecto activo, no pasa nada
  if (deps.has(activeEffect)) return;
  deps.add(activeEffect); // Agrega el efecto activo al set de efectos para la propiedad (Esto era lo que faltaba ._.XD)
  activeEffect.deps.push(deps); // Agrega el set de efectos al array de dependencias del efecto activo
}
export function triggerEffect(deps: Set<ReactiveEffect>) {
  const effects = new Set(deps);
  effects.forEach((effect) => {
    if (effect.scheduler) {
      // Si el efecto tiene un scheduler, ejecuta el scheduler en lugar de ejecutar el efecto directamente
      effect.scheduler();
    } else {
      effect.run(); // Ejecuta el efecto una vez
    }
  });
}
