// Application: punto de entrada del runtime de Belzium.
//
// Se encarga de crear el contexto IoC,
// resolver el componente raíz y montarlo
// dentro del DOM.

import { ApplicationContext } from "../di/applicationContext";

import { ComponentRenderer } from "./componentRenderer";

import type { Constructor } from "../di/types";

// Representa una aplicación Belzium montada.
export interface BelziumApplication {
  // Contexto IoC utilizado por la aplicación.
  context: ApplicationContext;

  // Monta el componente raíz dentro de un elemento.
  mount(target: string | Element): void;

  // Desmonta la aplicación.
  unmount(): void;
}

// Crea una aplicación Belzium.
export function createApp(rootComponent: Constructor): BelziumApplication {
  // Crea el contexto IoC raíz de la aplicación.
  const context = new ApplicationContext();

  // Registra el componente raíz como provider
  // para que el contexto pueda resolverlo.
  context.registerProvider({
    token: rootComponent,
    useClass: rootComponent,
  });

  // Renderer encargado de montar
  // componentes dentro del DOM.
  const renderer = new ComponentRenderer(context);

  // Elemento donde se encuentra montada
  // actualmente la aplicación.
  let mountedElement: Element | null = null;

  // Instancia del componente raíz.
  let rootInstance: InstanceType<Constructor> | null = null;

  return {
    // El contexto pertenece a la aplicación.
    context,

    // Monta la aplicación.
    mount(target) {
      // Permite utilizar un selector CSS
      // o un Element directamente.
      const element =
        typeof target === "string" ? document.querySelector(target) : target;

      // El target debe existir.
      if (!element) {
        throw new Error(`Mount target not found`);
      }

      // Evita montar dos veces
      // la misma aplicación.
      if (mountedElement) {
        throw new Error(`Application is already mounted`);
      }

      // El componente raíz se resuelve
      // mediante el ApplicationContext.
      const instance = context.resolve(rootComponent);

      // Monta el componente utilizando
      // el renderer existente.
      renderer.mount(rootComponent, instance, element);

      // Guarda el elemento montado.
      mountedElement = element;

      // Guarda la instancia raíz.
      rootInstance = instance;
    },

    // Desmonta la aplicación.
    unmount() {
      // Si no está montada,
      // no hay nada que desmontar.
      if (!mountedElement) {
        return;
      }
      // Por ahora limpiamos el DOM.
      mountedElement.innerHTML = "";

      // Libera las referencias.
      mountedElement = null;
      rootInstance = null;
    },
  };
}
