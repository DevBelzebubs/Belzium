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
  const provides = parent
    ? Object.create(parent.provides)
    : Object.create(null);
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
  instance.proxy = createComponentProxy(instance);
  return instance;
}
export function setupComponent(instance: ComponentInstance) {
  // Configura un componente
  const setup = instance.type.setup;
  if (!setup) {
    return;
  }
  setCurrentInstance(instance);
  try {
    const setupResult = setup(instance.props, { emit: instance.emit });
    if (setupResult) {
      instance.setupState = setupResult;
    }
  } finally {
    setCurrentInstance(null);
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
export function provide<T>(key: InjectionKey<T>, value: T) {
  // Proporciona un valor a los componentes descendientes
  const instance = getCurrentInstance();
  if (!instance) {
    return;
  }
  instance.provides[key] = value;
}
export function inject<T>(
  key: InjectionKey<T>,
  defaultValue?: T,
): T | undefined {
  // Inyecta un valor proporcionado por un componente ancestro, o el valor por defecto si no existe
  const instance = getCurrentInstance();
  if (!instance) {
    return defaultValue;
  }

  if (key in instance.provides) {
    return instance.provides[key] as T;
  }

  return defaultValue;
}
function setCurrentInstance(instance: ComponentInstance | null) {
  // Setea la instancia actual
  currentInstance = instance;
}
export function Component(options: ComponentOptions) {
  return <T extends new (...args: never[]) => object>(target: T): T => {
    defineComponentMetadata(target, {
      type: target,
      selector: options.selector,
    });
    return target;
  };
}
