export class Token<T = unknown> {
    // Nombre descriptivo para debugging.
    readonly description: string;
    constructor(description: string) {
        this.description = description;
    }
}


// Token de inyección: identifica un provider dentro del ApplicationContext (string, symbol o clase constructora)
export type InjectionToken<T = unknown> = | Token<T>| string | symbol | (new (...args: any[]) => T);
// Crea un token tipado para el sistema de DI.
export function createToken<T>(description: string): Token<T> {
    return new Token<T>( description);
}