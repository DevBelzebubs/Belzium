import { createComponentProxy } from "./componentProxy";
import type { InjectionKey, Provides } from "./injection";
import { defineComponentMetadata } from "./metadata";
import { ComponentOptions } from "./types";

export type EmitFn = (event: string, ...args: unknown[]) => void;
export interface SetupContext {
  emit: EmitFn;
}
export interface ComponentPublicInstance {
  [key: string | symbol]: unknown;
}
export interface ComponentInstance {
  // Instancia de un componente
  type: Component;
  props: Record<string, unknown>;
  setupState: Record<string, unknown>;
  emit: EmitFn;
  parent: ComponentInstance | null;
  proxy: ComponentPublicInstance;
  provides: Provides; // Valores proporcionados al componente, heredados del padre por cadena de prototipos
}

export interface Component {
  // Definición de un componente
  setup?: (
    props: Record<string, unknown>,
    context: SetupContext,
  ) => Record<string, unknown> | void;
}
let currentInstance: ComponentInstance | null = null;
export function createComponentInstance(
  type: Component,
  props: Record<string, unknown> = {},
  parent: ComponentInstance | null = null,
): ComponentInstance {
  // Crea una instancia de un componente
  const provides = new Map<InjectionKey, unknown>();
  const instance = {
    type,
    props,
    setupState: {},
    emit: (() => {}) as EmitFn,
    parent,
    proxy: null as unknown as ComponentPublicInstance,
    provides,
  };
  instance.emit = createEmit(instance);
  instance.proxy = createComponentProxy(instance, { unwrap: true });
  return instance;
}
export function setupComponent(instance: ComponentInstance) {
  // Configura un componente
  const setup =
    instance.type.setup ??
    (instance.type as { prototype?: { setup?: typeof instance.type.setup } })
      .prototype?.setup;
  if (!setup) {
    return;
  }
  const previousInstance = getCurrentInstance();
  setCurrentInstance(instance);
  try {
    const setupResult = setup(instance.props, {
      emit: instance.emit,
    });
    if (setupResult) {
      instance.setupState = setupResult;
    }
  } finally {
    setCurrentInstance(previousInstance);
  }
}
function createEmit(instance: ComponentInstance): EmitFn {
  // Crea la función emit para un componente
  return (event, ...args) => {
    // Se llama a la función emit con el evento y los argumentos
    const handlerName = `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
    const handler = instance.props[handlerName];
    if (typeof handler === "function") {
      handler(...args); // Llama al handler con los argumentos
    }
  };
}
export function getCurrentInstance() {
  //Instancia del componente
  return currentInstance;
}
export function provide<T>(key: InjectionKey<T> | string, value: T): void {
  // Proporciona un valor a los componentes descendientes
  const instance = getCurrentInstance();
  if (!instance) {
    throw new Error("provide() can only be used inside a component setup()");
  }
  instance.provides.set(key, value);
}
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue?: T,
): T | undefined {
  // Inyecta un valor proporcionado por un componente ancestro, o el valor por defecto si no existe
  const instance = getCurrentInstance();
  if (!instance) {
    throw new Error("inject() can only be used inside a component setup()");
  }

  // Recorre la cadena de padres; funciona incluso si el padre
  // se asigna después de createComponentInstance().
  let current: ComponentInstance | null = instance;
  while (current) {
    if (current.provides.has(key)) {
      return current.provides.get(key) as T;
    }
    current = current.parent;
  }

  return defaultValue;
}
function setCurrentInstance(instance: ComponentInstance | null) {
  // Setea la instancia actual
  currentInstance = instance;
}
export function Component(
  options: ComponentOptions,
): <T extends new (...args: never[]) => object>(target: T) => T;

// Implementación común de ambas formas del decorador.
export function Component(options: ComponentOptions = {}) {
  return <T extends new (...args: never[]) => object>(target: T): T => {
    // Registra la metadata del componente.
    defineComponentMetadata(target, {
      type: target,
      selector: options.selector,
    });

    return target;
  };
}
