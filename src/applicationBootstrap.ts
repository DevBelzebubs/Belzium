import { ApplicationContext } from "./di/applicationContext";

import { getMetadata } from "./di/metadata";

import { CONFIGURATION_METADATA} from "./di/decorators/configuration";
import { SERVICE_METADATA, ServiceMetadata } from "./di/decorators/service";
import { Constructor } from "./di/types";
export class ApplicationBootstrap {
    constructor(private readonly context: ApplicationContext) {}
    register(target: Constructor): void {
        const isConfiguration = getMetadata<boolean>(CONFIGURATION_METADATA, target);
        if (isConfiguration) {
             this.context.registerConfiguration(target);
            return;
        }
        const service = getMetadata<ServiceMetadata>(SERVICE_METADATA,target);
        if (service) {
        this.context.registerProvider({
            token: service.token,
            useClass: target,
            dependencies: service.dependencies,
            scope: service.scope
        });
        return;
    }
        throw new Error(`Unsupported application provider`);
    }
}