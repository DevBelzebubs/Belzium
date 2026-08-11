import { BEAN_METADATA, type BeanMetadata, type BeanOptions } from "./bean";
import { defineMetadata, getMetadata } from "../metadata";
import { Scope } from "../scope";

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
            const options = getMetadata<BeanOptions>(BEAN_METADATA, target.prototype[propertyKey]);
            if (!options) continue;
            beans.push({
                propertyKey,
                token: options.token ?? propertyKey,
                dependencies: options.dependencies,
                scope: options.scope ?? Scope.SINGLETON
            });
        }
        defineMetadata(BEAN_METADATA, beans, target);
    };
}
