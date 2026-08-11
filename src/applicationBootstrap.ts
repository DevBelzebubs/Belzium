import { ApplicationContext } from "./di/applicationContext";

import { getMetadata } from "./di/metadata";

import { CONFIGURATION_METADATA} from "./di/decorators/configuration";
export class ApplicationBootstrap {
    constructor(private readonly context: ApplicationContext) {}
    register(target: any): void {
        const isConfiguration = getMetadata<boolean>(CONFIGURATION_METADATA, target);
        if (isConfiguration) {
             this.context.registerConfiguration(target);
            return;
        }
        throw new Error(`Unsupported application provider`);
    }
}