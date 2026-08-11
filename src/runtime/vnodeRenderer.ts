// Renderer de vnodes: convierte el árbol virtual en nodos reales del DOM

import {
    TEXT_NODE,
    type VNode
} from "./vnode";

// Convierte un vnode en un elemento real del DOM
export function createElement(
    vnode: VNode
): Node {

    // Si es un nodo de texto, se crea un nodo de texto real
    if (vnode.type === TEXT_NODE) {
        return document.createTextNode(
            vnode.text ?? ""
        );
    }

    // Crea el elemento según el tag del vnode
    const element =
        document.createElement(vnode.type);

    // Aplica las props: atributos y eventos
    patchProps(
        element,
        null,
        vnode.props
    );

    // Crea los hijos recursivamente y los agrega al elemento
    for (const child of vnode.children) {
        element.appendChild(
            createElement(child)
        );
    }

    return element;
}


// Actualiza el DOM comparando un vnode anterior con uno nuevo
export function patch(
    oldVNode: VNode | null,
    newVNode: VNode | null,
    container: Node,
    index = 0
): Node | null {

    // Si no existía un vnode anterior, se crea e inserta el nuevo
    if (!oldVNode && newVNode) {

        const node =
            createElement(newVNode);

        container.insertBefore(
            node,
            container.childNodes[index] ?? null
        );

        return node;
    }

    // Si el nuevo vnode no existe, se elimina el nodo anterior
    if (oldVNode && !newVNode) {

        const node =
            container.childNodes[index];

        if (node) {
            container.removeChild(node);
        }

        return null;
    }

    // Si alguno de los vnodes no existe, no hay nada más que comparar
    if (!oldVNode || !newVNode) {
        return null;
    }

    // Obtiene el nodo real correspondiente al vnode actual
    const currentNode =
        container.childNodes[index];

    // Si el nodo real no existe, se crea el nuevo vnode
    if (!currentNode) {

        const node =
            createElement(newVNode);

        container.appendChild(node);

        return node;
    }

    // Si los tipos son diferentes, se reemplaza completamente el nodo
    if (oldVNode.type !== newVNode.type) {

        const node =
            createElement(newVNode);

        container.replaceChild(
            node,
            currentNode
        );

        return node;
    }

    // Si es un nodo de texto, solamente se actualiza su contenido
    if (newVNode.type === TEXT_NODE) {

        const oldText =
            oldVNode.text ?? "";

        const newText =
            newVNode.text ?? "";

        // Solo modifica el DOM si el texto realmente cambió
        if (oldText !== newText) {
            currentNode.textContent =
                newText;
        }

        return currentNode;
    }

    // Actualiza las props del elemento existente
    patchProps(
        currentNode as Element,
        oldVNode.props,
        newVNode.props
    );

    // Compara y actualiza los hijos del elemento
    patchChildren(
        oldVNode.children,
        newVNode.children,
        currentNode
    );

    return currentNode;
}


// Compara las props anteriores con las nuevas y actualiza el elemento
function patchProps(
    element: Element,
    oldProps: Record<string, unknown> | null,
    newProps: Record<string, unknown> | null
): void {

    const previous =
        oldProps ?? {};

    const next =
        newProps ?? {};

    // Elimina las props que ya no existen
    for (const key of Object.keys(previous)) {

        if (!(key in next)) {

            removeProp(
                element,
                key,
                previous[key]
            );
        }
    }

    // Agrega o actualiza las props nuevas
    for (const [key, value] of Object.entries(next)) {

        // Solo actualiza la prop si su valor cambió
        if (previous[key] !== value) {

            setProp(
                element,
                key,
                value,
                previous[key]
            );
        }
    }
}


// Aplica o actualiza una prop individual
function setProp(
    element: Element,
    key: string,
    value: unknown,
    previousValue?: unknown
): void {

    // Si era un evento anterior, primero elimina su listener
    if (
        key.startsWith("on") &&
        typeof previousValue === "function"
    ) {

        const event =
            key.slice(2).toLowerCase();

        element.removeEventListener(
            event,
            previousValue as EventListener
        );
    }

    // Las props on* son eventos: se registra el nuevo listener
    if (
        key.startsWith("on") &&
        typeof value === "function"
    ) {

        const event =
            key.slice(2).toLowerCase();

        element.addEventListener(
            event,
            value as EventListener
        );

        return;
    }

    // Los valores falsy o null eliminan el atributo
    if (
        value === false ||
        value == null
    ) {

        element.removeAttribute(key);

        return;
    }

    // El resto de las props se aplican como atributos
    element.setAttribute(
        key,
        String(value)
    );
}


// Elimina una prop del elemento real
function removeProp(
    element: Element,
    key: string,
    value: unknown
): void {

    // Si la prop era un evento, elimina su listener
    if (
        key.startsWith("on") &&
        typeof value === "function"
    ) {

        const event =
            key.slice(2).toLowerCase();

        element.removeEventListener(
            event,
            value as EventListener
        );

        return;
    }

    // Elimina el atributo del elemento
    element.removeAttribute(key);
}


// Compara los hijos anteriores con los nuevos y aplica los cambios
function patchChildren(
    oldChildren: VNode[],
    newChildren: VNode[],
    container: Node
): void {

    // Obtiene la cantidad máxima de hijos entre ambos árboles
    const maxLength =
        Math.max(
            oldChildren.length,
            newChildren.length
        );

    // Compara cada posición del árbol de hijos
    for (
        let i = 0;
        i < maxLength;
        i++
    ) {

        patch(
            oldChildren[i] ?? null,
            newChildren[i] ?? null,
            container,
            i
        );
    }
}