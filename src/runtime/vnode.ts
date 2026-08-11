// VNode: representación virtual de un nodo del DOM

// Nodo de texto: symbol que distingue los nodos de texto de los elementos
export const TEXT_NODE =
    Symbol("belzium:text");

export type ComponentConstructor =
    new (...args: any[]) => {
        render(): VNode;
    };
// Tipo de un vnode: el tag del elemento o un nodo de texto
export type VNodeType =
    | string
    | typeof TEXT_NODE
    | ComponentConstructor;

export type VNodeKey =
    | string
    | number
    | symbol;


// Representa un nodo virtual del árbol
export interface VNode {
    type: VNodeType;
    props: Record<string, unknown> | null;
    children: VNode[];
    text?: string;
    key?: VNodeKey;
}

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
    type: VNodeType,
    props: Record<string, unknown> | null = null,
    children: VNode[] = []
): VNode {

    const key =
        props?.key as
        VNodeKey | undefined;


    const vnodeProps =
        props
            ? { ...props }
            : null;


    if (vnodeProps) {
        delete vnodeProps.key;
    }


    return {
        type,
        props: vnodeProps,
        children,
        key
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
