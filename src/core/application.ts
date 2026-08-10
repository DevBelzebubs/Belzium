import {
    ApplicationContext
} from "../di/applicationContext";

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
        if (options.providers) this.context.registerComponents(options.providers);
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