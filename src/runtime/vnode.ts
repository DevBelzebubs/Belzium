// VNode: representación virtual de un nodo del DOM

// Nodo de texto: symbol que distingue los nodos de texto de los elementos
export const TEXT_NODE =
    Symbol("belzium:text");


// Tipo de un vnode: el tag del elemento o un nodo de texto
export type VNodeType =
    | string
    | typeof TEXT_NODE;


export interface VNode {
    // Tipo del nodo: tag del elemento o TEXT_NODE
    type: VNodeType;
    // Props del elemento: atributos y eventos on*
    props: Record<string, unknown> | null;
    // Hijos del elemento
    children: VNode[];
    // Contenido del nodo de texto
    text?: string;
}

// Crea un vnode de elemento
export function h(
    type: string,
    props: Record<string, unknown> | null = null,
    children: VNode[] = []
): VNode {

    return {
        type,
        props,
        children
    };
}

// Crea un vnode de texto
export function text(
    value: string
): VNode {

    return {
        type: TEXT_NODE,
        props: null,
        children: [],
        text: value
    };
}
