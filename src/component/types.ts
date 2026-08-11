import { VNode } from "../runtime/vnode";

export interface ComponentOptions {
    // Selector que identifica el componente en el renderer
    selector: string;
}

export interface ComponentMetadata {
    // Constructor del componente
    type: new (...args: never[]) => object;
    // Selector que usa el renderer
    selector: string;
}
// Contrato base de un componente renderizable
export interface RenderableComponent<P extends Record<string, unknown> = Record<string, unknown>> {
    // Props recibidas desde el componente padre
    props?: Readonly<P>;
    // Genera el árbol virtual del componente
    render(): VNode;
}