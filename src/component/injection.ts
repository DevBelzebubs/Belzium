// Clave de inyección: identifica un valor proporcionado por un proveedor (estilo provide/inject)
export type InjectionKey<T = unknown> = string | symbol;
// Valores proporcionados por un componente padre hacia sus descendientes
export type Provides = Record<PropertyKey, unknown>;