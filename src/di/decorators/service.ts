import {
    defineMetadata
} from "../metadata";

import {
    Scope
} from "../scope";

import type {
    InjectionToken
} from "../token";


export const SERVICE_METADATA =
    Symbol("belzeflow:service");


export interface ServiceOptions<T = unknown> {
    token?: InjectionToken<T>;
    dependencies?: InjectionToken<T>[];
    scope?: Scope;
}

export interface ServiceMetadata<T = unknown> {
    token: InjectionToken<T>;
    dependencies: InjectionToken<T>[];
    scope: Scope;
}


export function Service<T = unknown>(
    options: ServiceOptions<T> = {}
): ClassDecorator {
    return (target) => {
        defineMetadata(SERVICE_METADATA,{
                token:
                    (options.token ??
                    target) as InjectionToken<T>,
                dependencies:
                    options.dependencies ??
                    [],
                scope:
                    options.scope ??
                    Scope.SINGLETON
            } satisfies ServiceMetadata<T>,
            target
        );
    };
}