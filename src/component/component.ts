import { createComponentProxy } from "./componentProxy";

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
  const instance = {type,props,setupState: {},emit: (() => {}) as EmitFn,parent,proxy: null as unknown as ComponentPublicInstance};
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
function setCurrentInstance(instance: ComponentInstance | null) {
  // Setea la instancia actual
  currentInstance = instance;
}
