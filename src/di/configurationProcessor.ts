import {
    BEAN_METADATA,
    BeanMetadata
} from "./decorators/bean";

import {
    CONFIGURATION_METADATA
} from "./decorators/configuration";

import type {
    ApplicationContext
} from "./applicationContext";
import { getMetadata } from "./metadata";


// Procesa una clase marcada con @Configuration:
// registra sus métodos @Bean como factories en el contexto.
export class ConfigurationProcessor {
    process(configuration: object,context: ApplicationContext): void {
        // Verificar que la clase esté marcada como configuración.
        const constructor = configuration.constructor;
        const isConfiguration = getMetadata(CONFIGURATION_METADATA,constructor);
        if (!isConfiguration) throw new Error(`Class is not marked with @Configuration`);
        // Sin beans declarados no hay nada que registrar.
        const beans = getMetadata(BEAN_METADATA,constructor) as BeanMetadata[] | undefined;
        if (!beans) return;
        // Validar que cada propiedad @Bean sea un método.
        for (const bean of beans) {
            const factory = (configuration as any)[bean.propertyKey];
            if (typeof factory !== "function") throw new Error(`@Bean target must be a method`);
        }
    }
}