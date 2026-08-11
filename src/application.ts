import { ApplicationBootstrap } from "./applicationBootstrap";
import {
    ApplicationContext
} from "./di/applicationContext";

import type { Provider } from "./di/provider";
import { Constructor } from "./di/types";

export type ApplicationProvider =
    | Provider
    | Constructor;

export interface ApplicationOptions {
    providers?: ApplicationProvider[];
}


export class Application {
    readonly context: ApplicationContext;
    constructor(options: ApplicationOptions = {}) {
        this.context = new ApplicationContext();
        const bootstrap = new ApplicationBootstrap(this.context);
        for (const provider of options.providers ?? []) {
            if (typeof provider === "function") {
                bootstrap.register(provider);
            } else {
                this.context.registerProvider(provider);
            }
        }
    }

    resolve<T>(token: any): T {
        return this.context.resolve<T>(token);
    }
}