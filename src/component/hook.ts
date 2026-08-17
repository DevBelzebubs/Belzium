// Hook: estado y lógica reutilizable atado al ciclo de vida
// del componente que la consume.
//
// useHook() crea una instancia NUEVA por cada componente consumidor
// (una instancia por scope) y enlaza sus métodos onMounted/onUnmounted
// al ciclo de vida de ese componente.

import { reactive } from "../reactive/reactive";
import { defineMetadata, getMetadata } from "../di/metadata";
import {
  ComponentScope,
  getCurrentComponentScope,
} from "./componentScope";

// Metadata que identifica un Hook.
export const HOOK_METADATA = Symbol("belzium:hook");

export interface HookMetadata {
  isHook: true;
}

export function getHookMetadata(target: object): HookMetadata | undefined {
  return getMetadata<HookMetadata>(HOOK_METADATA, target);
}

// @Hook(): marca una clase como hook de componentes.
export function Hook(): ClassDecorator {
  return (target) => {
    defineMetadata(HOOK_METADATA, { isHook: true }, target);
  };
}

// Instancias por scope del consumidor.
const hookInstances = new WeakMap<
  ComponentScope,
  Map<object, unknown>
>();

// Obtiene (o crea) la instancia del hook perteneciente
// al componente en construcción.
export function useHook<T extends object>(
  hookClass: new (...args: any[]) => T,
): T {
  const scope = getCurrentComponentScope();
  if (!scope) {
    throw new Error(`useHook() can only be used inside a component`);
  }

  if (!getHookMetadata(hookClass)) {
    throw new Error(`Class is not a hook`);
  }

  let scopeMap = hookInstances.get(scope);
  if (!scopeMap) {
    scopeMap = new Map();
    hookInstances.set(scope, scopeMap);
  }

  let instance = scopeMap.get(hookClass);
  if (!instance) {
    instance = reactive(new hookClass());

    const lifecycle = instance as {
      onMounted?: () => void;
      onUnmounted?: () => void;
    };

    if (lifecycle.onMounted && scope.lifecycleState === "created") {
      scope.onMount(() => lifecycle.onMounted?.());
    }

    if (lifecycle.onUnmounted) {
      scope.onUnmount(() => lifecycle.onUnmounted?.());
    }

    scopeMap.set(hookClass, instance);
  }

  return instance as T;
}
