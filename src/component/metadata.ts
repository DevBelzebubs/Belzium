import {
    defineMetadata,
    getMetadata
} from "../di/metadata";

import type {
    ComponentMetadata
} from "./types";

// Metadata que identifica componentes
export const COMPONENT_METADATA = Symbol("belzium:component");

export function defineComponentMetadata(
    target: new (...args: never[]) => object,
    metadata: ComponentMetadata
): void {
    defineMetadata(
        COMPONENT_METADATA,
        metadata,
        target
    );
}
export function getComponentMetadata(
    target: new (...args: never[]) => object
): ComponentMetadata | undefined {
    return getMetadata<ComponentMetadata>(
        COMPONENT_METADATA,
        target
    );
}
export function isComponent(
    target: new (...args: never[]) => object
): boolean {
    return getComponentMetadata(target) !== undefined;
}

// Convierte un nombre de clase (PascalCase) en un selector kebab-case.
export function toKebabCase(name: string): string {
    return name
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
}