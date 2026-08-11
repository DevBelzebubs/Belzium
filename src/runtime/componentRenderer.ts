// ComponentRenderer: monta componentes que definen render() y reaccionan al estado

import {
    getComponentMetadata
} from "../component/metadata";

import type {
    Constructor
} from "../di/types";

import type {
    RenderableComponent
} from "../component/types";
import { effect } from "../reactive/effect";
import { patch } from "./vnodeRenderer";
import type { VNode } from "./vnode";


// Componente montado: instancia, elemento y forma de desmontarlo
export interface MountedComponent<T extends RenderableComponent> {

    // Instancia del componente montado
    instance: T;

    // Nodo DOM donde está montado
    element: Element;

    // Detiene las reacciones al estado, desmontando el componente
    dispose(): void;
}


export class ComponentRenderer {

    // Monta el componente: renderiza y reacciona a los cambios de estado
    mount<T extends RenderableComponent>(
        component: Constructor<T>,
        instance: T,
        element: Element
    ): MountedComponent<T> {

        // Verifica que la clase sea un componente
        const metadata =
            getComponentMetadata(
                component
            );
        if (!metadata) {
            throw new Error(
                `Class is not a component`
            );
        }
        let currentVNode: VNode | null = null;
        // Efecto que re-renderiza el componente cada vez que cambia su estado
        const renderEffect =
            effect(() => {
                // Genera el nuevo árbol virtual
                const nextVNode =
                    instance.render();
                // Compara el árbol anterior con el nuevo
                patch(
                    currentVNode,
                    nextVNode,
                    element
                );
                // El nuevo árbol pasa a ser el anterior
                // para la siguiente actualización
                currentVNode =
                    nextVNode;
            });
        // Detiene el efecto para desmontar el componente
        const dispose =
            () => renderEffect.stop();

        // Devuelve la instancia montada y su mecanismo de destrucción
        return {
            instance,
            element,
            dispose
        };
    }
}
