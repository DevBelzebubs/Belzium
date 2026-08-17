// Store: estado global reactivo, sin dependencia del IoC.
//
// A diferencia de @Service, un Store no se inyecta por constructor:
// se accede mediante useStore() desde cualquier parte de la app
// y siempre devuelve la misma instancia (singleton por clase).

import { reactive } from "./reactive/reactive";
import { defineMetadata, getMetadata } from "./di/metadata";

// Metadata que identifica un Store.
export const STORE_METADATA = Symbol("belzium:store");

export interface StoreMetadata {
  isStore: true;
}

export function getStoreMetadata(
  target: object,
): StoreMetadata | undefined {
  return getMetadata<StoreMetadata>(STORE_METADATA, target);
}

// @Store(): marca una clase como store global reactivo.
export function Store(): ClassDecorator {
  return (target) => {
    defineMetadata(STORE_METADATA, { isStore: true }, target);
  };
}

// Instancias vivas de los stores, por clase.
const stores = new Map<new (...args: any[]) => object, object>();

// Obtiene la instancia reactiva del store.
// Se crea una única vez y se reutiliza en toda la app.
export function useStore<T extends object>(
  storeClass: new (...args: any[]) => T,
): T {
  if (!getStoreMetadata(storeClass)) {
    throw new Error(`Class is not a store`);
  }

  let instance = stores.get(storeClass);
  if (!instance) {
    instance = reactive(new storeClass());
    stores.set(storeClass, instance);
  }

  return instance as T;
}

// Elimina todas las instancias vivas.
// Útil para resetear el estado entre tests.
export function resetStores(): void {
  stores.clear();
}
