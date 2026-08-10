import { createComponentProxy } from "./componentProxy";
import { InjectionKey } from "./injection";

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
  provides: Map<InjectionKey, unknown>;
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
  const instance = getCurrentInstance();
  if (!instance) {
    return;
  }
  instance.provides[key] = value;
}
export function inject<T>(key: InjectionKey<T>,defaultValue?: T): T | undefined {
    const instance =getCurrentInstance();
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
