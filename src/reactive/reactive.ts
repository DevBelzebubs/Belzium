import { track, trigger, ITERATE_KEY, MAP_KEY_ITERATE_KEY } from "./dependency";
import { RAW, setReactiveFactory, toReactive, rawMap } from "./reactiveContext";
export { RAW };
const reactiveMap = new WeakMap<object, any>(); // Cache de objetos crudos que ya fueron envueltos en un proxy reactivo (evita proxies duplicados)
const baseHandlers: ProxyHandler<object> = {
  // Handlers para objetos y arrays (acceso a propiedades, índices y length)
  get(target, property, receiver) {
    if (property === RAW) {
      // Si se accede a la propiedad RAW, se retorna el objeto crudo correspondiente
      return target;
    }
    const value = Reflect.get(target, property, receiver); // Obtiene el valor de la propiedad
    track(target, property); // Llama a la función track para registrar la dependencia
    return toReactive(value); // Si el valor no es un objeto, lo convierte a reactivo (si es un objeto) o lo retorna tal cual
  },
  set(target, property, value, receiver) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, property);
    const oldValue = Reflect.get(target, property, receiver);
    const oldLength = Array.isArray(target) ? (target as unknown[]).length : -1;
    const result = Reflect.set(target, property, value, receiver);
    if (!hadKey) {
      trigger(target, property, "ADD", value);
    } else if (!Object.is(oldValue, value)) {
      //Trigger ejecuta en condicional para evitar renders inecesarios
      trigger(target, property, "SET", value); // Llama a la función trigger para notificar los efectos
    }
    // Al reducir arr.length las claves eliminadas cambian la iteración:
    // se disparan también los efectos de ITERATE_KEY (Object.keys / for..in).
    if (property === "length" && Number(value) < oldLength) {
      trigger(target, ITERATE_KEY, "SET");
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
  // Handlers para Map y Set (los métodos internos no se pueden invocar con el proxy como receiver)
  get(target, key, receiver) {
    if (key === RAW) {
      return target;
    }
    if (key === "size" && (target instanceof Map || target instanceof Set)) {
      track(target, ITERATE_KEY); // Trackea la iteración: size cambia al añadir/eliminar elementos
      return Reflect.get(target, "size", target); // Lee size sobre el objeto crudo porque el getter nativo no acepta el proxy como receiver
    }
    if (key === "get" && target instanceof Map) {
      // Se intercepta la llamada a Map.prototype.get para trackear la dependencia
      return (mapKey: PropertyKey) => {
        const value = target.get(mapKey);
        track(target, mapKey);
        return toReactive(value);
      };
    }
    if (
      (key === "has" || key === "delete") &&
      (target instanceof Map || target instanceof Set)
    ) {
      // Map y Set comparten la firma de has() y delete(), se unifican en una sola rama (en Set la key es el valor)
      if (key === "has") {
        return (value: unknown) => {
          const result = target.has(value); // Verifica si la key/valor existe
          track(target, value as PropertyKey); // Trackea la dependencia de esa key/valor
          return result;
        };
      }
      return (value: unknown) => {
        const hadValue = target.has(value); // Verifica si la key/valor existía antes de eliminarlo
        const result = target.delete(value); // Elimina la key/valor del objeto crudo
        if (hadValue) {
          trigger(target, value as PropertyKey, "DELETE"); // Notifica a los efectos de la key/valor y de la iteración
        }
        return result; // delete() retorna un booleano
      };
    }
    if (key === "set" && target instanceof Map) {
      return (mapKey: PropertyKey, value: unknown) => {
        // Se intercepta la llamada a Map.prototype.set para trackear y trigger los efectos correspondientes
        const hadKey = target.has(mapKey);
        const oldValue = target.get(mapKey);
        target.set(mapKey, value);
        if (!hadKey) {
          trigger(target, mapKey, "ADD");
        } else if (!Object.is(oldValue, value)) {
          trigger(target, mapKey, "SET");
        }
        return receiver; // Map.prototype.set retorna el mapa, se devuelve el proxy para mantener la cadena
      };
    }
    if (key === "add" && target instanceof Set) {
      return (value: unknown) => {
        const hadValue = target.has(value); // Verifica si el valor ya existe en el Set
        if (!hadValue) {
          target.add(value); // Agrega el valor al Set crudo
          trigger(target, value as PropertyKey, "ADD", value); // Notifica a los efectos del valor y de la iteración
        }
        return receiver; // Set.prototype.add retorna el Set, se devuelve el proxy para mantener la cadena
      };
    }
    if (
      (target instanceof Map && key === "keys") ||
      (target instanceof Set && (key === "keys" || key === "values"))
    ) {
      // Los iteradores nativos se pueden usar sobre el objeto crudo y solo trackean la iteración (reaccionan a ADD/DELETE)
      return () => {
        track(target, ITERATE_KEY);
        if (target instanceof Set) {
          return reactiveIterator(target[key]());
        }
        return target[key]();
      };
    }
    if (key === "values" || key === Symbol.iterator) {
      if (target instanceof Map) {
        // Usa mapIterator para trackear además cada key durante la iteración (un SET en esa key re-ejecuta el efecto)
        return () =>
          mapIterator(target, key === "values" ? "values" : "entries");
      }
    }
    if (key === "entries" && target instanceof Map) {
      return () => mapIterator(target, "entries");
    }
    if (key === "forEach" && target instanceof Map) {
      return (
        callback: (
          value: unknown,
          key: unknown,
          map: Map<unknown, unknown>,
        ) => void,
      ) => {
        track(target, ITERATE_KEY); // Trackea la iteración (reacciona a ADD/DELETE)
        target.forEach((value, mapKey) => {
          // Se trackea la key para que un SET dispare el efecto, igual que mapIterator
          track(target, mapKey as PropertyKey);
          callback(toReactive(value), mapKey, receiver);
        });
      };
    }
    if (key === "clear") {
      if (target instanceof Map) {
        return () => {
          if (target.size > 0) {
            // Se disparan las deps de cada key eliminada (además de la iteración)
            const keys = [...target.keys()];
            target.clear();
            keys.forEach((mapKey) => {
              trigger(target, mapKey as PropertyKey, "DELETE");
            });
          }
        };
      }
      if (target instanceof Set) {
        return () => {
          if (target.size > 0) {
            // Se disparan las deps de cada valor eliminado (además de la iteración)
            const values = [...target.values()];
            target.clear();
            values.forEach((value) => {
              trigger(target, value as PropertyKey, "DELETE");
            });
          }
        };
      }
    }
    if (key === "entries" && target instanceof Set) {
      return () => {
        track(target, ITERATE_KEY);
        return target.entries();
      };
    }
    if (key === "forEach" && target instanceof Set) {
      return (callback: (value: unknown, value2: unknown, set: Set<unknown>) => void, thisArg?: unknown) => {
        track(target, ITERATE_KEY);
        target.forEach((value) => {
          track(target, value as PropertyKey);
          callback.call(thisArg, toReactive(value), toReactive(value), receiver);
        }, thisArg);
      };
    }
    if (key === Symbol.iterator) {
      if (target instanceof Set) {
        return () => {
          track(target, ITERATE_KEY);
          return reactiveIterator(target[Symbol.iterator]());
        };
      }
    }
    return Reflect.get(target, key, receiver);
  },
};

export function reactive<T extends object>(target: T): T {
  const existing = reactiveMap.get(target); // Si el objeto ya tiene un proxy reactivo, se reutiliza
  if (existing) {
    return existing;
  }
  if (rawMap.has(target)) {
    return target; // Si el valor ya es un proxy reactivo, se retorna tal cual (evita crear un proxy de un proxy)
  }
  // Los Map y Set necesitan handlers especiales porque sus métodos internos no se pueden invocar con el proxy como receiver
  const handler =
    isMap(target) || isSet(target) ? collectionHandlers : baseHandlers;
  const proxy = new Proxy(target, handler) as T;
  reactiveMap.set(target, proxy); // Cachea el proxy asociado al objeto crudo
  rawMap.set(proxy, target);
  return proxy;
}
function isMap(value: unknown): value is Map<unknown, unknown> {
  // Type guard para identificar Maps
  return value instanceof Map;
}
function isSet(value: unknown): value is Set<unknown> {
  // Type guard para identificar Sets
  return value instanceof Set;
}

function reactiveIterator<T>(iterator: Iterator<T>): Iterator<T> {
  // Envuelve un iterador nativo para que cada valor emitido pase por toReactive
  return {
    next() {
      const result = iterator.next();
      if (result.done) return result;
      return { value: toReactive(result.value), done: false };
    },
    [Symbol.iterator]() {
      return this;
    },
  } as Iterator<T>;
}

function mapIterator( // Trackea cada key de manera individual durante la iteración
  target: Map<unknown, unknown>,
  kind: "keys" | "values" | "entries",
) {
  // Trackea la iteración: MAP_KEY_ITERATE_KEY para keys y ITERATE_KEY para values/entries (reaccionan a ADD/DELETE)
  track(target, kind === "keys" ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);

  return (function* () {
    // Generador que recorre las entradas del Map crudo
    for (const [mapKey, mapValue] of target.entries()) {
      track(target, mapKey as PropertyKey); // Trackea cada key individual para que un SET dispare los efectos de iteración
      yield kind === "keys" // Hace yield solo de lo que pide el kind
        ? mapKey
        : kind === "values"
          ? toReactive(mapValue)
          : [mapKey, toReactive(mapValue)];
    }
  })();
}
setReactiveFactory(reactive);
