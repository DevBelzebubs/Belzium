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


export interface ServiceOptions {

    token?: InjectionToken;

    dependencies?: InjectionToken[];

    scope?: Scope;
}


export interface ServiceMetadata {

    token: InjectionToken;

    dependencies: InjectionToken[];

    scope: Scope;
}


export function Service(
    options: ServiceOptions = {}
): ClassDecorator {
    return (target) => {
        defineMetadata(SERVICE_METADATA,{
                token:
                    options.token ??
                    target,
                dependencies:
                    options.dependencies ??
                    [],
                scope:
                    options.scope ??
                    Scope.SINGLETON
            },
            target
        );
    };
}