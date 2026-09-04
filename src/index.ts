// API pública de Belzium.
// Este archivo define las funcionalidades que una aplicación
// puede consumir directamente.

// ============================================================
// PULSES — REACTIVIDAD
// ============================================================

// Reactividad mediante Proxy.
export { reactive } from "./reactive/reactive";

// Conversión entre objetos reactivos y valores originales.
export { toReactive, toRaw } from "./reactive/reactiveContext";

// Efectos reactivos.
export { effect } from "./reactive/effect";

// Valores derivados.
export { computed } from "./reactive/computed";

// Variables reactivas individuales.
export { ref, isRef } from "./reactive/ref";

export type { Ref } from "./reactive/ref";

// Observación de estado reactivo.
export { watch, watchEffect } from "./reactive/watch";

// ============================================================
// COMPONENTES
// ============================================================

// API principal para declarar componentes.
export {
  Component,
  createComponentInstance,
  setupComponent,
  getCurrentInstance,
} from "./component/component";

export type {
  ComponentInstance,
  ComponentPublicInstance,
  SetupContext,
  EmitFn,
} from "./component/component";

// Proxy público de una instancia.
export { createComponentProxy } from "./component/componentProxy";

// Metadatos de componentes.
export { isComponent } from "./component/metadata";

export type {
  ComponentOptions,
  RenderableComponent,
} from "./component/types";

// ============================================================
// DEPENDENCY INJECTION
// ============================================================

// Configuración declarativa del IoC.
export { Configuration, Bean } from "./di/decorators/index";

// Decorador UI para componentes.
export { UI } from "./di/decorators/ui";

// Hooks de ciclo de vida de los componentes.
export {
  onMounted,
  onUnmounted,
  onUpdated,
} from "./component/componentScope";

// Application: punto de entrada del runtime.
export {
    createApp,
} from "./runtime/application";

export type {
    BelziumApplication,
} from "./runtime/application";
export {
  provide,
  inject,
} from "./component/provideInject";

export type {
  InjectionKey,
} from "./component/provideInject";

// Slots de un componente.
export {
  useSlots,
} from "./component/slots";

export type {
  Slot,
  Slots,
} from "./component/slots";

// Outputs: emisión de eventos hacia el componente padre.
export {
  output,
  isOutput,
} from "./component/output";

export type {
  Output,
} from "./component/output";

// Inputs: props reactivas recibidas del componente padre.
export {
  input,
  isInput,
} from "./component/input";

export type {
  Input,
} from "./component/input";

// ============================================================
// VNODES
// ============================================================

// Construcción de VNodes.
export {
  h,
  text,
  createTextVNode,
  TEXT_NODE,
  isSameVNode,
} from "./runtime/vnode";

export type {
  VNode,
  VNodeType,
  VNodeKey,
  VNodeComponentState,
  ComponentConstructor,
} from "./runtime/vnode";

// ============================================================
// STORES
// ============================================================

// Estado global reactivo (no-IoC).
export {
  Store,
  useStore,
  resetStores,
  getStoreMetadata,
  STORE_METADATA,
} from "./store";

export type {
  StoreMetadata,
} from "./store";

// ============================================================
// HOOKS
// ============================================================

// Estado y lógica atada al ciclo de vida del componente.
export {
  Hook,
  useHook,
  getHookMetadata,
  HOOK_METADATA,
} from "./component/hook";

export type {
  HookMetadata,
} from "./component/hook";

// ============================================================
// DIRECTIVAS
// ============================================================

// Directivas personalizadas del template.
export {
  Directive,
  getDirectiveMetadata,
  DIRECTIVE_METADATA,
} from "./component/directive";

export type {
  DirectiveMetadata,
} from "./component/directive";

// ============================================================
// PIPELINES
// ============================================================

// Definición de pipelines (flujo de nodos).
export {
  Pipeline,
  getPipelineMetadata,
  PIPELINE_METADATA,
} from "./pipeline/decorator";

export type {
  PipelineMetadata,
  PipelineNode,
  PipelineNodeOptions,
  PipelineNodeType,
} from "./pipeline/types";

export {
  createNode,
  link,
  isPipelineNode,
} from "./pipeline/node";

export {
  PipelineGraph,
} from "./pipeline/graph";