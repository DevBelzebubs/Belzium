import type { VNode } from "../runtime/vnode";

// Función perezosa que genera los nodos de un slot
export type Slot = () => VNode[];

// Slots recibidos por un componente, indexados por nombre
export type Slots = Record<string, Slot>;

let currentSlots: Slots = {};

export function useSlots(): Slots {
  return currentSlots;
}

export function setSlots(slots: Slots): void {
  currentSlots = slots;
}
