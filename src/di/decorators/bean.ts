import { defineMetadata } from "../metadata";
import type { InjectionToken } from "../token";
import { Scope } from "../scope";
// Metadata de los métodos @Bean.
export const BEAN_METADATA =
    Symbol("belzium:bean");

export interface BeanOptions {
    token?: InjectionToken;
    dependencies?: InjectionToken[];
    scope?: Scope;
}
export interface BeanOptions {
    token?: InjectionToken;
    dependencies?: InjectionToken[];
}

export interface BeanMetadata {
    propertyKey: string | symbol;
    token: InjectionToken;
    dependencies?: InjectionToken[];
    scope: Scope;
}
// @Bean(): marca un método de una clase @Configuration como un provider factory.
export function Bean(options?: BeanOptions) {
    return (value: Function) => {
        defineMetadata(BEAN_METADATA, options ?? {}, value);
    };
}