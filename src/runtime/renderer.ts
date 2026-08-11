import type { ComponentMetadata } from "../component/types";
import { getComponentMetadata } from "../component/metadata";

export interface MountResult<T extends object> {
    instance: T;
    metadata: ComponentMetadata;
    element: Element;
}

export class Renderer {

    mount<T extends object>(component: new (...args: never[]) => T,element: Element,instance: T): MountResult<T> {
        const metadata = getComponentMetadata(component);
        if (!metadata) {
            throw new Error(`Class is not a component`);
        }
        return {
            instance,
            metadata,
            element
        };
    }
}