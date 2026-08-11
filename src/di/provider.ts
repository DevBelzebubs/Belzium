import { Scope } from "./scope";
import { InjectionToken } from "./token";


// Provider basado en una clase, applicationContext resuelve las dependencias y crea una instancia de useClass.
export interface ClassProvider<T = unknown> {

    token: InjectionToken<T>;

    useClass:
        new (...args: any[]) => T;

    // Dependencias que deben resolverse antes de construir la clase.
     
    dependencies?:
        InjectionToken[];

    /**
     * Define el ciclo de vida de la instancia.
     *
     * Si no se especifica:
     * SINGLETON
     */
    scope?:
        Scope;
}


/**
 * Provider basado directamente en un valor.
 *
 * No necesita dependencies ni scope porque
 * el valor ya está creado.
 */
export interface ValueProvider<T = unknown> {

    token:
        InjectionToken<T>;

    useValue:
        T;
}


/**
 * Provider basado en una función factory.
 *
 * ApplicationContext resuelve dependencies
 * y las pasa como argumentos al factory.
 */
export interface FactoryProvider<T = unknown> {

    token:
        InjectionToken<T>;

    useFactory:
        (...dependencies: unknown[]) => T;

    /**
     * Tokens que se resolverán y pasarán
     * como argumentos al factory.
     */
    dependencies?:
        InjectionToken[];

    /**
     * Define el ciclo de vida del resultado
     * generado por el factory.
     *
     * Si no se especifica:
     * SINGLETON
     */
    scope?:
        Scope;
}


// Provider genérico del contenedor DI.

export type Provider<T = unknown> =
    | ClassProvider<T>
    | ValueProvider<T>
    | FactoryProvider<T>;