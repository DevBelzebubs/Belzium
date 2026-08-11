// Renderer de componentes: conecta componentes, IoC, Pulse y VNodes

import { getComponentMetadata } from "../component/metadata";

import type { RenderableComponent } from "../component/types";

import type { Constructor } from "../di/types";

import { ApplicationContext } from "../di/applicationContext";

import type { VNode } from "./vnode";
import { effectScope, type EffectScope } from "../reactive/effectScope";
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
  scope: EffectScope;

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

    // Cada montaje posee su propio
    // ciclo de vida reactivo.
    const scope = effectScope();

    // Árbol virtual actualmente renderizado
    // por este componente.
    let currentVNode: VNode | null = null;

    // Ejecuta el render dentro del scope.
    const renderEffect = scope.run(() => {
      return effect(() => {
        // Genera el nuevo árbol virtual
        const nextVNode = instance.render();

        // Compara el árbol anterior
        // con el nuevo.
        patch(currentVNode, nextVNode, element, 0, this.context);

        // Guarda el árbol actual
        // para la siguiente actualización.
        currentVNode = nextVNode;
      });
    });

    // El scope ya contiene
    // automáticamente el render effect.
    if (!renderEffect) {
      throw new Error(`Component render effect was not created`);
    }

    // Detiene todo el scope del componente.
    const dispose = () => {
      scope.stop();
    };

    return {
      instance,
      element,
      scope,
      dispose,
    };
  }
}
