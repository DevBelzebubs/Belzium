import { BEAN_METADATA, type BeanMetadata } from "./bean";
import { defineMetadata, getMetadata } from "../metadata";

// Metadata que identifica clases de configuración.
export const CONFIGURATION_METADATA =
    Symbol("belzium:configuration");


// @Configuration(): marca una clase como fuente de beans.
export function Configuration(): ClassDecorator {
    return (target) => {
        defineMetadata(CONFIGURATION_METADATA, true, target);
        const beans: BeanMetadata[] = [];
        for (const propertyKey of Object.getOwnPropertyNames(target.prototype)) {
            if (propertyKey === "constructor") continue;
            if (getMetadata(BEAN_METADATA, target.prototype[propertyKey])) {
                beans.push({ propertyKey });
            }
        }
        defineMetadata(BEAN_METADATA, beans, target);
    };
}