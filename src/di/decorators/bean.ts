import { defineMetadata, getMetadata } from "../metadata";

// Metadata de los métodos @Bean.
export const BEAN_METADATA =
    Symbol("belzium:bean");


export interface BeanMetadata {
    propertyKey: string | symbol;
}
// @Bean(): marca un método de una clase @Configuration como un provider factory.
export function Bean() {
    return (value: Function) => {
        defineMetadata(BEAN_METADATA, true, value);
    };
}