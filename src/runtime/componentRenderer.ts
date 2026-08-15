// Renderer de componentes: conecta componentes, IoC, Pulse y VNodes

import { getComponentMetadata } from "../component/metadata";

import type { RenderableComponent } from "../component/types";

import type { Constructor } from "../di/types";

import { ApplicationContext } from "../di/applicationContext";

import type { VNode } from "./vnode";
import { ComponentScope } from "../component/componentScope";
import type { ComponentInstance } from "./componentInstance";

import { patch } from "./vnodeRenderer";

import { effect } from "../reactive/effect";

// Representa un componente montado dentro del DOM
export interface MountedComponent<
  T extends RenderableComponent = RenderableComponent,
> {
  // Instancia real del componente montado
  instance: T;

  // Elemento donde se monta el componente
  element: Element;

  // Scope reactivo perteneciente al ciclo de vida del componente
  scope: ComponentScope;

  // Detiene el efecto reactivo del componente
  dispose(): void;
}

// Renderer encargado de montar componentes
export class ComponentRenderer {
  // Contexto IoC utilizado para resolver
  // componentes y sus dependencias
  constructor(private context?: ApplicationContext) {}

  // Monta una instancia de componente dentro de un elemento
  mount<T extends RenderableComponent>(
    component: Constructor<T>,
    instance: T,
    element: Element,
  ): MountedComponent<T> {
    // Obtiene la metadata registrada por @Component.
    const metadata = getComponentMetadata(component);

    // Verifica que la clase sea un componente válido.
    if (!metadata) {
      throw new Error(`Class is not a component`);
    }

    // Cada instancia montada posee
    // su propio ciclo de vida.
    const scope = new ComponentScope();

    // Árbol virtual generado durante
    // el último render.
    let currentVNode: VNode | null = null;

    // Ejecuta el render dentro del
    // ComponentScope.
    scope.run(() => {
      effect(() => {
        // Genera el nuevo árbol virtual.
        const nextVNode = instance.render();

        // Compara el árbol anterior
        // con el nuevo.
        patch(currentVNode, nextVNode, element, 0, this.context);

        // A partir de la primera actualización se notifican
        // los hooks de actualización (no en el montaje inicial).
        if (currentVNode) {
          scope.update();
          instance.onUpdated?.();
        }

        // Conserva el árbol actual.
        currentVNode = nextVNode;
      });
    });

    // El componente ya fue renderizado
    // y su DOM inicial existe.
    scope.mount();

    // Desmonta el componente mediante
    // su ComponentScope.
    const dispose = () => {
      scope.unmount();
    };

    return {
      instance,
      element,
      scope,
      dispose,
    };
  }
}
