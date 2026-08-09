export function reactive<T extends object>(target: T): T {
    return new Proxy(target, {
        get(target, key, receiver) {
            return Reflect.get(target, key, receiver);
        },
        set(target, key, value, receiver) {
            return Reflect.set(target, key, value, receiver);
        }
    });
}