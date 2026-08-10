import { Scope } from "./scope";
import { InjectionToken } from "./token";
// Tipos de componentes que pueden ser descubiertos
export enum ComponentType {
    SERVICE = "service",
    REPOSITORY = "repository",
    HOOK = "hook",
    BEAN = "bean"
}
// Metadata asociada a una clase decorada, describe que es el componente
export interface ComponentMetadata<T = unknown> {
    token: InjectionToken<T>;
    type: ComponentType;
    scope: Scope;
    dependencies?: InjectionToken[];
}
// Registro global de metadata
const componentMetadata = new WeakMap<Function, ComponentMetadata>();
export function defineComponentMetadata<T>(target: new (...args: any[]) => T,metadata: ComponentMetadata<T>): void {
    componentMetadata.set(target,metadata);
}
// Obtiene la metadata respecto a una clase
export function getComponentMetadata<T>(target: new (...args: any[]) => T): ComponentMetadata<T> | undefined {
    return componentMetadata.get(target) as ComponentMetadata<T> | undefined;
}
// Convierte la metadata de un componente en un Provider
export function componentToProvider<T>(target: new (...args: any[]) => T): Provider<T> {
    const metadata = getComponentMetadata(target);
    if (!metadata) throw new Error(`Class is not registered as a component`);
    return {
        token: metadata.token,
        useClass: target,
        dependencies: metadata.dependencies,
        scope: metadata.scope
    };
}


import type { Provider } from "./provider";