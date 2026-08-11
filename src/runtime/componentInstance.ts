// Representa el estado interno de un componente durante su montaje

import type { VNode } from "./vnode";

import type {
    RenderableComponent
} from "../component/types";


// Estado interno de un componente montado
export interface ComponentInstance<
    T extends RenderableComponent = RenderableComponent
> {

    // Instancia real de la clase del componente
    instance: T;

    // VNode que representa al componente
    vnode: VNode;

    // Árbol virtual generado por el componente
    subTree: VNode | null;

    // Nodo real donde se encuentra montado
    element: Node | null;

    // Detiene la reactividad del componente
    dispose: () => void;
}