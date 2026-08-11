// Renderer de componentes: conecta componentes, IoC, Pulse y VNodes

import { getComponentMetadata } from "../component/metadata";

import type { RenderableComponent } from "../component/types";

import type { Constructor } from "../di/types";

import { ApplicationContext } from "../di/applicationContext";

import type { VNode } from "./vnode";

import type { ComponentInstance } from "./componentInstance";

import { patch } from "./vnodeRenderer";

import { effect } from "../reactive/effect";

// Representa un componente montado dentro del DOM
export interface MountedComponent<T extends RenderableComponent = RenderableComponent,> {
  // Instancia real del componente montado
  instance: T;

  // Elemento donde se monta el componente
  element: Element;

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
    // Obtiene la metadata registrada por @Component
    const metadata = getComponentMetadata(component);

    // Verifica que la clase sea un componente válido
    if (!metadata) {
      throw new Error(`Class is not a component`);
    }

    // Estado interno del componente.
    // Contiene la instancia, su árbol virtual
    // y el efecto responsable de actualizarlo.
    const componentInstance: ComponentInstance<T> = {
      // Instancia real del componente
      instance,

      // VNode que representa al componente
      vnode: {
        type: component,
        props: null,
        children: [],
      },

      // El componente todavía no ha generado
      // su primer árbol virtual
      subTree: null,

      // Nodo donde será montado
      element,

      // Se reemplaza inmediatamente
      // por el stop del efecto
      dispose: () => {},
    };

    // Ejecuta el render dentro de Pulse.
    // Cada dependencia reactiva utilizada durante
    // render() queda asociada al componente.
    const renderEffect = effect(() => {
      // Genera el nuevo árbol virtual
      const nextVNode = instance.render();

      // Compara el árbol anterior
      // con el nuevo árbol
      patch(componentInstance.subTree, nextVNode, element, 0, this.context);

      // Guarda el árbol actual.
      // El siguiente render utilizará este
      // árbol como referencia para el diff.
      componentInstance.subTree = nextVNode;
    });

    // Guarda la función que detiene
    // el efecto reactivo del componente
    componentInstance.dispose = () => renderEffect.stop();

    // Devuelve la API pública del componente montado
    return {
      instance,
      element,
      dispose: componentInstance.dispose,
    };
  }
}
