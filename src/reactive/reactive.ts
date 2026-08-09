import { track, trigger } from "./dependency";

export function reactive<T extends object>(target: T): T {
    return new Proxy(target, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            track(target, property); // Llama a la función track para registrar la dependencia
            return value;
        },
        set(target, property, value, receiver) {
            const result = Reflect.set(target, property, value, receiver);
            trigger(target, property); // Llama a la función trigger para notificar los efectos
            return result;
        }
    });
}