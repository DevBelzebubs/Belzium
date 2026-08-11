// Token tipado: identidad única + descripción para debugging
class Token<T = unknown> {
    readonly id: symbol;
    constructor(readonly description: string) {
        this.id = Symbol(description);
    }
}

// InjectionToken es la clase (createToken) y también el tipo unión que acepta el contenedor
export const InjectionToken = Token;
// Token de inyección: clase creada con createToken, o bien clase constructora, string o symbol
export type InjectionToken<T = unknown> = Token<T> | string | symbol | (new (...args: any[]) => T);

// Crea un token tipado para el sistema de DI
export function createToken<T>(description: string): Token<T> {
    return new Token<T>(description);
}
