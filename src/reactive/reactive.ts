import { track, trigger } from "./dependency";
const reactiveMap = new WeakMap<object, any>();
export function reactive<T extends object>(target: T): T {
  const existing = reactiveMap.get(target);
  if (existing) {
    return existing;
  }
  const proxy = new Proxy(target, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      track(target, property); // Llama a la función track para registrar la dependencia
      if (typeof value === "object" && value !== null) {
        return reactive(value);
      }
      return value;
    },
    set(target, property, value, receiver) {
      const oldValue = Reflect.get(target, property, receiver);
      const result = Reflect.set(target, property, value, receiver);
      if (!Object.is(oldValue, value)) {
        //Trigger ejecuta en condicional para evitar renders inecesarios
        trigger(target, property); // Llama a la función trigger para notificar los efectos
      }
      return result;
    },
  });
  reactiveMap.set(target,proxy)
  return proxy;
}
