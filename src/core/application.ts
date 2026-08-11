import {
    ApplicationContext
} from "../di/applicationContext";

import {
    ConfigurationProcessor
} from "../di/configurationProcessor";

import {
    CONFIGURATION_METADATA
} from "../di/decorators/configuration";

import { getMetadata } from "../di/metadata";

import type {
    InjectionToken
} from "../di/token";
// Clases que serán registradas automáticamente como componente
export interface ApplicationOptions {
    providers?: Array<new (...args: any[]) => any>;
}
export class Application {
    // Contenedor de dependencias de la app.
    readonly context: ApplicationContext;
    constructor(options: ApplicationOptions = {}) {
        this.context = new ApplicationContext();
        for (const provider of options.providers ?? []) {
            if (getMetadata(CONFIGURATION_METADATA, provider)) {
                new ConfigurationProcessor().process(new provider(), this.context);
            } else {
                this.context.registerComponent(provider);
            }
        }
    }
    resolve<T>(token: InjectionToken<T>): T {
        return this.context.resolve(token);
    }
    // Inicia la app
    start(): void {} 
}
export function createApplication(options: ApplicationOptions = {}): Application {
    return new Application(options);
}