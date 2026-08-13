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

// ============================================================
// DEPENDENCY INJECTION
// ============================================================

// Configuración declarativa del IoC.
export { Configuration, Bean } from "./di/decorators/index";

// Decorador UI para componentes.
export { UI } from "./di/decorators/ui";

// Hooks de ciclo de vida de los componentes.
export { onMounted, onUnmounted } from "./component/componentScope";

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