import { isRef } from "../reactive/ref";
import type { ComponentInstance, ComponentPublicInstance } from "./component";

export function createComponentProxy( // Crea un proxy para la instancia de un componente
  instance: ComponentInstance,
): ComponentPublicInstance {
  return new Proxy(
    {},
    {
      get(_, key) {
        // Intercepta el acceso a las propiedades del proxy
        let value: unknown;
        if (key in instance.setupState) {
          value = instance.setupState[key as string];
        } else if (key in instance.props) {
          value = instance.props[key as string];
        } else {
          return undefined;
        }
        return isRef(value) ? value.value : value;
      },
      set(_, key, value) {
        // Intercepta la asignación de propiedades del proxy
        if (key in instance.setupState) {
          const oldValue = instance.setupState[key as string];
          if (isRef(oldValue)) {
            oldValue.value = value;
          } else {
            instance.setupState[key as string] = value;
          }
          return true;
        }
        if (key in instance.props) {
            return false;
        }
        return false;
      },
    },
  );
}
