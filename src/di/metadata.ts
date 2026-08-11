import { Scope } from "./scope";
import { InjectionToken } from "./token";
type MetadataKey = symbol;
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
const metadataStore =new WeakMap<object, Map<MetadataKey, unknown>>();
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
export function defineMetadata<T>(key: MetadataKey,value: T,target: object): void{
    let metadata = metadataStore.get(target);
    if (!metadata) metadata = new Map<MetadataKey, unknown>();
    metadataStore.set(target,metadata);
    metadata.set(key,value);
}
export function getMetadata<T>(key: MetadataKey,target: object): T | undefined {
    return metadataStore.get(target)?.get(key) as T | undefined;
}


import type { Provider } from "./provider";