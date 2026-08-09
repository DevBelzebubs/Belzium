import { track, trigger, ITERATE_KEY } from "./dependency";
const reactiveMap = new WeakMap<object, any>();

const baseHandlers: ProxyHandler<object> = {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    track(target, property); // Llama a la función track para registrar la dependencia
    if (typeof value === "object" && value !== null) {
      return reactive(value);
    }
    return value;
  },
  set(target, property, value, receiver) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, property);
    const oldValue = Reflect.get(target, property, receiver);
    const result = Reflect.set(target, property, value, receiver);
    if (!hadKey) {
      trigger(target, property, "ADD", value);
    } else if (!Object.is(oldValue, value)) {
      //Trigger ejecuta en condicional para evitar renders inecesarios
      trigger(target, property, "SET", value); // Llama a la función trigger para notificar los efectos
    }
    return result;
  },
  deleteProperty(target, property) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, property); // Verifica si la propiedad existía antes de eliminarla
    const result = Reflect.deleteProperty(target, property);

    if (hadKey && result) {
      // Si la propiedad existía y se eliminó correctamente, se llama a trigger para notificar los efectos
      trigger(target, property, "DELETE");
    }
    return result;
  },
  has(target, property) {
    // Verifica si la propiedad existe en el objeto reactivo y trackea la dependencia
    const result = Reflect.has(target, property);
    track(target, property);
    return result;
  },
  ownKeys(target) {
    track(target, ITERATE_KEY); // Trackea la iteración del objeto (Object.keys, for..in)
    return Reflect.ownKeys(target);
  },
};

const collectionHandlers: ProxyHandler<object> = {
  get(target, key, receiver) {
    const raw = target as Map<unknown, unknown>; // Los métodos internos de Map no se pueden invocar con el proxy como receiver
    if (key === "size") {
      track(raw, ITERATE_KEY);
      return Reflect.get(raw, key, raw);
    }
    if (key === "get") {
      return (mapKey: PropertyKey) => {
        const value = raw.get(mapKey);
        track(raw, mapKey);
        return value;
      };
    }
    if (key === "has") {
      return (mapKey: PropertyKey) => {
        const result = raw.has(mapKey);
        track(raw, mapKey);
        return result;
      };
    }
    if (key === "set") {
      return (mapKey: PropertyKey, value: unknown) => {
        const hadKey = raw.has(mapKey);
        const oldValue = raw.get(mapKey);
        raw.set(mapKey, value);
        if (!hadKey) {
          trigger(raw, mapKey, "ADD");
        } else if (!Object.is(oldValue, value)) {
          trigger(raw, mapKey, "SET");
        }
        return receiver; // Map.prototype.set retorna el mapa, se devuelve el proxy para mantener la cadena
      };
    }
    if (key === "delete") {
      return (mapKey: PropertyKey) => {
        const hadKey = raw.has(mapKey);
        const result = raw.delete(mapKey);
        if (hadKey && result) {
          trigger(raw, mapKey, "DELETE");
        }
        return result;
      };
    }
    return Reflect.get(raw, key, receiver);
  },
};

export function reactive<T extends object>(target: T): T {
  const existing = reactiveMap.get(target);
  if (existing) {
    return existing;
  }
  const handler = isMap(target) ? collectionHandlers : baseHandlers;
  const proxy = new Proxy(target, handler) as T;
  reactiveMap.set(target, proxy);
  return proxy;
}
function isMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map;
}
