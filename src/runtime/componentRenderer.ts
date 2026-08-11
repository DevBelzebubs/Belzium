import { getComponentMetadata } from "../component/metadata";

import type {
    Constructor
} from "../di/types";

import type {
    RenderableComponent
} from "../component/types";
import { effect } from "../reactive/effect";


export interface MountedComponent<
    T extends RenderableComponent
> {

    instance: T;

    element: Element;

    dispose(): void;
}


export class ComponentRenderer {

    mount<T extends RenderableComponent>(
        component: Constructor<T>,
        instance: T,
        element: Element
    ): MountedComponent<T> {

        const metadata =
            getComponentMetadata(
                component
            );
        if (!metadata) {

            throw new Error(
                `Class is not a component`
            );
        }
        const renderEffect =
            effect(() => {
                element.innerHTML =
                    instance.render();
            });
        const dispose =
            () => renderEffect.stop();
        return {
            instance,
            element,
            dispose
        };
    }
}