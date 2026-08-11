// Renderer: monta componentes sobre elementos del DOM

import type {
    ComponentMetadata
} from "../component/types";
import { getComponentMetadata } from "../component/metadata";


// Resultado de montar un componente
export interface MountResult<
    T extends object
> {

    // Instancia del componente montado
    instance: T;

    // Metadata del componente (@Component)
    metadata: ComponentMetadata;

    // Nodo DOM donde está montado
    element: Element;
}


export class Renderer {

    // Monta un componente sobre un elemento del DOM
    mount<T extends object>(
        component: new (...args: never[]) => T,
        element: Element,
        instance: T
    ): MountResult<T> {

        // Obtiene la metadata del componente
        const metadata =
            getComponentMetadata(
                component
            );
        if (!metadata) {

            throw new Error(
                `Class is not a component`
            );
        }
        return {
            instance,
            metadata,
            element
        };
    }
}
