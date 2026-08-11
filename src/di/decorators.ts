import {
    ComponentType,
    defineComponentMetadata
} from "./metadata";

import { Scope } from "./scope";
import { InjectionToken } from "./token";
// Opciones de @Service: ciclo de vida y dependencias a inyectar.
export interface ServiceOptions {
    scope?: Scope;
    dependencies?: InjectionToken[];
}

// Decorador @Service(), Marca una clase como un componente gestionado por el contenedor de dependencias
export function Service(options?: ServiceOptions) {
    return function <T extends new (...args: any[]) => any>(target: T): T {
        defineComponentMetadata(target,{
                token: target,
                type: ComponentType.SERVICE,
                scope:
                    options?.scope ??
                    Scope.SINGLETON,
                dependencies:
                    options?.dependencies
            }
        );
        return target;
    };
}