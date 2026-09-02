// Renderer de VNodes: convierte el árbol virtual en nodos reales del DOM

import { ApplicationContext } from "../di/applicationContext";

import { effect } from "../reactive/effect";

import { setSlots, useSlots, type Slots } from "../component/slots";

import type { RenderableComponent } from "../component/types";
import { getComponentMetadata } from "../component/metadata";
import {
  ComponentScope,
  getCurrentComponentScope,
  setCurrentComponentScope,
} from "../component/componentScope";
import {
  TEXT_NODE,
  type ComponentConstructor,
  type VNode,
  type VNodeKey,
} from "./vnode";
import { ComponentProps, createProps, updateProps } from "../component/props";
import { isOutput } from "../component/output";
import { isInput, type Input } from "../component/input";
import { toRaw } from "../reactive/reactiveContext";
import { ref } from "../reactive/ref";
const componentProps = new WeakMap<
  RenderableComponent,
  ComponentProps<Record<string, unknown>>
>();

// Slots actualizables de cada instancia.
//
// Se guardan como un ref para que el cambio de
// slots (re-render del padre) dispare el render
// del componente hijo que los consume.
const componentSlots = new WeakMap<RenderableComponent, ReturnType<typeof ref>>();

// Suscripciones de outputs de una instancia.
// Se almacenan para poder cancelarlas al desmontar.
const instanceOutputs = new WeakMap<object, Array<() => void>>();
// Determina si un VNode representa un componente
function isComponentVNode(
  vnode: VNode,
): vnode is VNode & { type: ComponentConstructor } {
  return typeof vnode.type === "function";
}

// Determina si dos VNodes representan la misma entidad
function isSameVNode(oldVNode: VNode, newVNode: VNode): boolean {
  return oldVNode.type === newVNode.type && oldVNode.key === newVNode.key;
}
// Desmonta un componente y detiene toda la reactividad asociada a su scope
function unmountComponent(vnode: VNode): void {
  const component = vnode.component;
  if (!component) return;

  // Cancela las suscripciones de los outputs ANTES
  // del hook de la instancia para que un emit()
  // durante onUnmounted no llegue al padre.
  const disposers = instanceOutputs.get(component.instance);
  if (disposers) {
    for (const dispose of disposers) {
      dispose();
    }
    instanceOutputs.delete(component.instance);
  }

  // El hook de la instancia se ejecuta ANTES de
  // eliminar el nodo para que siga teniendo
  // acceso al DOM.
  component.instance.onUnmounted?.();

  // Desmonta recursivamente los componentes
  // anidados en el subárbol del componente.
  if (component.subTree) {
    unmountTree(component.subTree);
  }

  // El hook se ejecuta ANTES de eliminar el nodo
  // para que siga teniendo acceso al DOM.
  component.scope?.unmount();

  // Evita que el mismo componente sea desmontado
  // dos veces accidentalmente.
  vnode.component = undefined;
}

// Desmonta los componentes anidados dentro
// de un árbol virtual de forma recursiva
export function unmountTree(vnode: VNode): void {
  if (isComponentVNode(vnode)) {
    unmountComponent(vnode);

    return;
  }

  for (const child of vnode.children) {
    unmountTree(child);
  }
}
// Convierte un VNode en un nodo real del DOM
export function createElement(
  vnode: VNode,
  context?: ApplicationContext,
): Node {
  // Si es un nodo de texto,
  // se crea un nodo de texto real
  if (vnode.type === TEXT_NODE) {
    return document.createTextNode(vnode.text ?? "");
  }

  // Los componentes necesitan el ApplicationContext
  // para poder ser resueltos mediante el IoC
  if (isComponentVNode(vnode)) {
    if (!context) {
      throw new Error(`ApplicationContext is required to render a component`);
    }

    // createElement() no monta directamente
    // el componente: delega en mountComponent()
    const container = document.createElement("div");

    return mountComponent(vnode, container, context, 0);
  }

  // Crea el elemento según el tag del VNode
  const element = document.createElement(vnode.type as string);

  // Aplica las props iniciales
  patchProps(element, null, vnode.props);

  // Crea los hijos recursivamente
  // y conserva el ApplicationContext
  for (const child of vnode.children) {
    element.appendChild(createElement(child, context));
  }

  return element;
}

// Actualiza el DOM comparando un VNode anterior
// con un nuevo VNode
export function patch(
  oldVNode: VNode | null,
  newVNode: VNode | null,
  container: Node,
  index = 0,
  context?: ApplicationContext,
): Node | null {
  // Si no existe un nuevo VNode,
  // elimina el nodo anterior
  if (!newVNode) {
    if (oldVNode) {
      const oldNode = container.childNodes[index];

      if (isComponentVNode(oldVNode)) {
        unmountComponent(oldVNode);
      }

      if (oldNode) {
        container.removeChild(oldNode);
      }
    }

    return null;
  }

  // Si no existía un VNode anterior,
  // monta el nuevo
  if (!oldVNode) {
    const node = createElement(newVNode, context);

    container.insertBefore(node, container.childNodes[index] ?? null);

    return node;
  }

  // Si los VNodes representan entidades diferentes,
  // reemplaza completamente el nodo
  if (!isSameVNode(oldVNode, newVNode)) {
    const oldNode = container.childNodes[index];

    // El componente viejo debe desmontarse
    // antes de reemplazar su nodo.
    if (isComponentVNode(oldVNode)) {
      unmountComponent(oldVNode);
    }

    const newNode = createElement(newVNode, context);

    if (oldNode) {
      container.replaceChild(newNode, oldNode);
    } else {
      container.appendChild(newNode);
    }

    return newNode;
  }

  // Si el VNode representa un componente,
  // actualizamos su instancia existente
  if (isComponentVNode(newVNode)) {
    return updateComponent(oldVNode, newVNode, container, index, context);
  }

  // Obtiene el nodo real correspondiente
  // al VNode actual
  const currentNode = container.childNodes[index];

  // Si el nodo real no existe,
  // se crea el nuevo VNode
  if (!currentNode) {
    const node = createElement(newVNode, context);

    container.appendChild(node);

    return node;
  }

  // Actualiza un nodo real existente
  return patchNode(oldVNode, newVNode, currentNode, context);
}

// Actualiza un nodo real existente
// comparando su VNode anterior con el nuevo
function patchNode(
  oldVNode: VNode,
  newVNode: VNode,
  currentNode: Node,
  context?: ApplicationContext,
): Node {
  // Los nodos de texto solamente necesitan
  // actualizar su contenido
  if (newVNode.type === TEXT_NODE) {
    const oldText = oldVNode.text ?? "";

    const newText = newVNode.text ?? "";

    // Solo modifica el DOM
    // si el texto realmente cambió
    if (oldText !== newText) {
      currentNode.textContent = newText;
    }

    return currentNode;
  }

  // Actualiza las props del elemento existente
  patchProps(currentNode as Element, oldVNode.props, newVNode.props);

  // Compara y actualiza los hijos
  patchChildren(oldVNode.children, newVNode.children, currentNode, context);

  return currentNode;
}

// Aplica o actualiza las props de un elemento
function patchProps(
  element: Element,
  oldProps: Record<string, unknown> | null,
  newProps: Record<string, unknown> | null,
): void {
  const previous = oldProps ?? {};

  const next = newProps ?? {};

  // Elimina las props que ya no existen
  for (const key of Object.keys(previous)) {
    if (!(key in next)) {
      removeProp(element, key, previous[key]);
    }
  }

  // Agrega o actualiza las props nuevas
  for (const [key, value] of Object.entries(next)) {
    // Solo actualiza la prop
    // si su valor cambió
    if (previous[key] !== value) {
      setProp(element, key, value, previous[key]);
    }
  }
}

// Aplica o actualiza una prop individual
function setProp(
  element: Element,
  key: string,
  value: unknown,
  previousValue?: unknown,
): void {
  // Si era un evento anterior,
  // primero elimina su listener
  if (key.startsWith("on") && typeof previousValue === "function") {
    const event = key.slice(2).toLowerCase();

    element.removeEventListener(event, previousValue as EventListener);
  }

  // Las props on* son eventos
  if (key.startsWith("on") && typeof value === "function") {
    const event = key.slice(2).toLowerCase();

    element.addEventListener(event, value as EventListener);

    return;
  }

  // Los valores falsy o null
  // eliminan el atributo
  if (value === false || value == null) {
    element.removeAttribute(key);

    return;
  }

  // El resto de las props
  // se aplican como atributos
  element.setAttribute(key, String(value));
}

// Elimina una prop del elemento real
function removeProp(element: Element, key: string, value: unknown): void {
  // Si la prop era un evento,
  // elimina su listener
  if (key.startsWith("on") && typeof value === "function") {
    const event = key.slice(2).toLowerCase();

    element.removeEventListener(event, value as EventListener);

    return;
  }

  // Elimina el atributo
  element.removeAttribute(key);
}

// Compara los hijos anteriores
// con los nuevos y aplica los cambios
function patchChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: Node,
  context?: ApplicationContext,
): void {
  // Si ninguno de los hijos tiene key,
  // utilizamos el diff posicional simple
  const hasKeys =
    oldChildren.some((child) => child.key !== undefined) ||
    newChildren.some((child) => child.key !== undefined);

  if (!hasKeys) {
    patchChildrenByIndex(oldChildren, newChildren, container, context);

    return;
  }

  // Si existen keys,
  // utilizamos el diff basado en identidad
  patchKeyedChildren(oldChildren, newChildren, container, context);
}

// Actualiza hijos comparando sus posiciones
function patchChildrenByIndex(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: Node,
  context?: ApplicationContext,
): void {
  // Obtiene la cantidad máxima de hijos
  const maxLength = Math.max(oldChildren.length, newChildren.length);

  // Compara cada posición del árbol
  for (let i = 0; i < maxLength; i++) {
    patch(
      oldChildren[i] ?? null,
      newChildren[i] ?? null,
      container,
      i,
      context,
    );
  }

  // Al reducir la lista, patch() con índice elimina el nodo
  // en esa posición pero los nodos sobrantes del final quedan
  // huérfanos (el índice apunta fuera del DOM). Se podan aquí.
  while (container.childNodes.length > newChildren.length) {
    container.removeChild(container.lastChild!);
  }
}

// Actualiza hijos utilizando sus keys
function patchKeyedChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: Node,
  context?: ApplicationContext,
): void {
  // Mapea cada key anterior
  // a su VNode
  const oldKeyToVNode = new Map<VNodeKey, VNode>();

  // Mapea cada key anterior
  // a su nodo real
  const oldKeyToNode = new Map<VNodeKey, Node>();

  // Cola de nodos DOM de hijos old sin key (capturados antes de reordenar)
  const oldUnkeyedNodes: { vnode: VNode; domNode: Node }[] = [];

  oldChildren.forEach((child, index) => {
    if (child.key !== undefined) {
      oldKeyToVNode.set(child.key, child);

      const node = container.childNodes[index];

      if (node) {
        oldKeyToNode.set(child.key, node);
      }
    } else {
      const domNode = container.childNodes[index];
      if (domNode) {
        oldUnkeyedNodes.push({ vnode: child, domNode });
      }
    }
  });

  // Procesa los nuevos hijos
  for (let newIndex = 0; newIndex < newChildren.length; newIndex++) {
    const newChild = newChildren[newIndex];

    if (newChild.key === undefined) {
      // Hijo sin key: buscar siguiente old unkeyed sin usar
      const entry = oldUnkeyedNodes.length > 0 && oldUnkeyedNodes[0].vnode.type === newChild.type && oldUnkeyedNodes[0].vnode.key === undefined
        ? oldUnkeyedNodes.shift()
        : undefined;
      if (entry) {
        const patchedNode = patchNode(entry.vnode, newChild, entry.domNode, context);
        if (patchedNode !== entry.domNode) {
          container.insertBefore(patchedNode, entry.domNode);
          container.removeChild(entry.domNode);
        }
        if (container.childNodes[newIndex] !== patchedNode) {
          container.insertBefore(patchedNode, container.childNodes[newIndex] ?? null);
        }
        continue;
      }
      // No hay match: crear nuevo nodo
      const newNode = createElement(newChild, context);
      container.insertBefore(newNode, container.childNodes[newIndex] ?? null);
      continue;
    }

    const oldVNode = oldKeyToVNode.get(newChild.key);

    // No existía:
    // crea e inserta un nuevo nodo
    if (!oldVNode) {
      const newNode = createElement(newChild, context);

      container.insertBefore(newNode, container.childNodes[newIndex] ?? null);

      continue;
    }

    // Obtiene el nodo real asociado
    // a la key anterior
    const oldNode = oldKeyToNode.get(oldVNode.key!);

    if (!oldNode) {
      continue;
    }

    // Parchea el VNode existente
    const currentIndex = Array.prototype.indexOf.call(
      container.childNodes,
      oldNode,
    );
    const patchedNode = patch(
      oldVNode,
      newChild,
      container,
      currentIndex,
      context,
    );

    // Mueve el nodo existente
    // a su nueva posición
    if (patchedNode && container.childNodes[newIndex] !== patchedNode) {
      container.insertBefore(
        patchedNode,
        container.childNodes[newIndex] ?? null,
      );
    }
  }

  // Elimina los hijos keyed que ya
  // no existen en el nuevo árbol
  for (const [key, oldVNode] of oldKeyToVNode) {
    if (newChildren.some((child) => child.key === key)) {
      continue;
    }

    // Desmonta los componentes que desaparecen
    if (isComponentVNode(oldVNode)) {
      unmountComponent(oldVNode);
    }

    // Elimina el nodo real correspondiente
    const oldNode = oldKeyToNode.get(key);

    if (oldNode && oldNode.parentNode) {
      oldNode.parentNode.removeChild(oldNode);
    }
  }

  // Elimina hijos unkeyed que sobraron sin match
  for (const entry of oldUnkeyedNodes) {
    // Desmonta los componentes que desaparecen
    unmountTree(entry.vnode);

    if (entry.domNode.parentNode) {
      entry.domNode.parentNode.removeChild(entry.domNode);
    }
  }
}

// Monta un componente representado por un VNode
export function mountComponent(
  vnode: VNode,
  container: Node,
  context: ApplicationContext,
  index: number,
): Node {
  // Obtiene el constructor del componente
  const Component = vnode.type as ComponentConstructor;

  // Crea el scope del componente.
  //
  // Se crea antes de resolver la instancia
  // para que el constructor pueda registrar
  // sus hooks de ciclo de vida.
  const scope = new ComponentScope();

  // Resuelve la instancia mediante el IoC
  // dentro del scope del componente.
  const previousScope = getCurrentComponentScope();
  setCurrentComponentScope(scope);
  let instance: RenderableComponent;
  try {
    instance = context.resolve(Component);
  } finally {
    setCurrentComponentScope(previousScope);
  }

  // Crea las props reactivas del componente.
  // El componente recibirá únicamente
  // la vista de solo lectura.
  const props = createProps((vnode.props ?? {}) as Record<string, unknown>);

  // Asigna las props públicas a la instancia
  instance.props = props.readonly;

  // Conserva las props internas
  // asociadas a la instancia.
  componentProps.set(instance, props);

  // Expone la variante configurada en @UI
  // (ej: @UI({ variants: { primary: {...} } }))
  // según la prop `variant` recibida.
  const uiVariants = getComponentMetadata(Component)?.variants;
  const variantName = vnode.props?.variant;
  if (uiVariants && variantName != null) {
    (instance as RenderableComponent & { variant?: Record<string, unknown> })
      .variant = uiVariants[String(variantName)];
  }

  // Ejecuta setup() si el componente lo define y
  // expone el estado retornado en la instancia,
  // de modo que render() pueda accederlo vía this.
  const withSetup = instance as RenderableComponent & {
    setup?: (
      props?: Readonly<Record<string, unknown>>,
    ) => Record<string, unknown> | void;
  };

  // Construye los slots del componente:
  // - default: los hijos del VNode del componente
  // - nombrados: via la prop `slots` (funciones perezosas)
  const slots: Slots = {
    default: () => vnode.children,
    ...((vnode.props?.slots ?? {}) as Slots),
  };

  // Expone los slots en la instancia para
  // que render() pueda consumirlos vía this.slots.
  //
  // Se exponen mediante un getter respaldado por un
  // ref: al actualizarse (re-render del padre) el
  // render del componente se dispara de nuevo.
  const currentSlots = ref<Slots>(slots);
  componentSlots.set(instance, currentSlots);
  Object.defineProperty(instance, "slots", {
    get: () => currentSlots.value,
    configurable: true,
  });
  const previousSlots = useSlots();
  const previousComponentScope = getCurrentComponentScope();
  setSlots(slots);
  setCurrentComponentScope(scope);
  let setupResult: Record<string, unknown> | void;
  try {
    setupResult = withSetup.setup?.(props.readonly);
  } finally {
    setSlots(previousSlots);
    setCurrentComponentScope(previousComponentScope);
  }
  if (setupResult && typeof setupResult === "object") {
    Object.assign(instance, setupResult);
  }

  // Conecta los outputs declarados en la instancia
  // con los handlers que el padre pasa como props.
  const disposers: Array<() => void> = [];
  for (const key of Object.keys(instance)) {
    const candidate = (instance as unknown as Record<string, unknown>)[key];
    if (isOutput(candidate)) {
      disposers.push(
        candidate.subscribe((value: unknown) => {
          const handler = props.readonly[key];
          if (typeof handler === "function") {
            (handler as (value: unknown) => void)(value);
          }
        }),
      );
    }
  }
  instanceOutputs.set(instance, disposers);

  // Conecta los inputs declarados en la instancia
  // con los valores que el padre pasa como props.
  //
  // Se leen las props crudas (toRaw) para no
  // registrar dependencias en el efecto del padre.
  const rawProps = toRaw(props.readonly);
  for (const key of Object.keys(instance)) {
    const candidate = (instance as unknown as Record<string, unknown>)[key];
    if (isInput(candidate)) {
      (candidate as Input<unknown>).value = rawProps[key];
    }
  }

  // Expone las props como propiedades directas
  // de la instancia (ej: this.value) mediante
  // getters que leen de las props reactivas.
  //
  // No se pisan las propiedades que la instancia
  // ya posee: outputs, setupState, slots, props...
  for (const key of Object.keys(props.readonly)) {
    if (key in instance) {
      continue;
    }
    Object.defineProperty(instance, key, {
      get: () => props.readonly[key],
      configurable: true,
    });
  }

  // Estado interno del componente
  // que será conservado durante su vida.
  const componentState = {
    // Instancia resuelta mediante IoC
    instance,

    // Props internas actualizables
    props,

    // Árbol virtual generado por el componente
    subTree: null as VNode | null,

    // Nodo raíz real del componente
    element: null as Node | null,

    // Scope responsable del lifecycle
    // y de la reactividad
    scope,
  };

  // Crea el efecto dentro del ComponentScope.
  //
  // Esto es fundamental:
  // scope.unmount() podrá detener
  // este efecto posteriormente.
  scope.run(() => {
    effect(() => {
      // Cada ejecución del efecto (incluidas las
      // re-runs) corre dentro del scope del componente.
      //
      // Esto garantiza que los efectos creados
      // durante el render (ej: watch) pertenezcan
      // al scope y se detengan con el unmount.
      scope.run(() => {
        // El componente en construcción durante el render
        // es el scope actual: los hooks (onMounted/onUnmounted)
        // declarados dentro del render pertenecen a él.
        const previousScope = getCurrentComponentScope();
        setCurrentComponentScope(scope);

        try {
          // Genera el nuevo árbol virtual
          const nextVNode = instance.render();

        // Primer render del componente
        if (!componentState.subTree) {
          const node = createElement(nextVNode, context);

          // Inserta el nodo en el contenedor real
          container.insertBefore(node, container.childNodes[index] ?? null);

          // Guarda el nodo raíz
          componentState.element = node;
        } else {
          // Obtiene el nodo padre real
          // donde actualmente vive el componente
          const parent = componentState.element?.parentNode;

          // Si ya no existe el padre,
          // el componente fue desmontado
          if (!parent) {
            return;
          }

          // Busca la posición actual
          // del componente dentro del padre
          const currentIndex = Array.prototype.indexOf.call(
            parent.childNodes,
            componentState.element,
          );

          // Actualiza el árbol virtual
          const patchedNode = patch(
            componentState.subTree,
            nextVNode,
            parent,
            currentIndex,
            context,
          );

          // El nodo raíz pudo haber sido reemplazado
          if (patchedNode) {
            componentState.element = patchedNode;
          }

          // El componente terminó su actualización:
          // se notifican los hooks de actualización
          // del scope y de la instancia.
          scope.update();
          instance.onUpdated?.();
        }

        // Guarda el árbol generado
        // para la siguiente actualización
        componentState.subTree = nextVNode;

        // Mantiene el subárbol vigente en el estado
        // del VNode para poder desmontar los
        // componentes anidados más recientes.
        if (vnode.component) {
          vnode.component.subTree = nextVNode;
        }
        } finally {
          setCurrentComponentScope(previousScope);
        }
      });
    });
  });

  // El componente terminó su montaje inicial.
  scope.mount();

  // Hook de ciclo de vida de la instancia.
  instance.onMounted?.();

  // Guarda el estado dentro del VNode.
  //
  // Esto permite reutilizar el mismo
  // ComponentScope durante futuros patches.
  vnode.component = {
    instance: instance as RenderableComponent,

    subTree: componentState.subTree,

    element: componentState.element,

    scope,
  };

  // Recupera el nodo que acaba de montar
  const node = componentState.element;

  if (!node) {
    // Si el render no produjo DOM,
    // liberamos inmediatamente el scope.
    scope.unmount();

    throw new Error(`Component did not render a DOM node`);
  }

  return node;
}

// Actualiza un componente que ya está montado
function updateComponent(
  oldVNode: VNode,
  newVNode: VNode,
  container: Node,
  index: number,
  context?: ApplicationContext,
): Node | null {
  // El componente necesita el ApplicationContext
  if (!context) {
    throw new Error(`ApplicationContext is required to update a component`);
  }

  // Recupera el estado interno
  // del componente anterior
  const component = oldVNode.component;

  // Si no existe estado,
  // el componente debe montarse nuevamente
  if (!component) {
    return mountComponent(newVNode, container, context, index);
  }

  // Conserva el estado en el VNode nuevo
  newVNode.component = component;

  // Recupera las props reactivas
  const props = componentProps.get(component.instance);

  if (!props) {
    throw new Error(`Component props state not found`);
  }

  // Actualiza las props manteniendo
  // la identidad del objeto reactivo
  updateProps(props.target, (newVNode.props ?? {}) as Record<string, unknown>);

  // Actualiza los slots del componente:
  // el padre re-renderizó con contenido nuevo.
  //
  // El cambio del ref dispara el render del
  // hijo, que vuelve a evaluar this.slots.
  const currentSlots = componentSlots.get(component.instance);
  if (currentSlots) {
    const newSlots: Slots = {
      default: () => newVNode.children,
      ...((newVNode.props?.slots ?? {}) as Slots),
    };
    currentSlots.value = newSlots;
  }

  // Crea getters para props nuevas que
  // no existían durante el montaje inicial.
  for (const key of Object.keys(props.target)) {
    if (key in component.instance) continue;
    Object.defineProperty(component.instance, key, {
      get: () => props.readonly[key],
      configurable: true,
    });
  }

  // Recalcula la variante @UI si la prop
  // variant cambió durante la actualización.
  const uiVariants = getComponentMetadata(oldVNode.type as ComponentConstructor)?.variants;
  const newVariantName = newVNode.props?.variant;
  if (uiVariants && newVariantName != null) {
    (component.instance as RenderableComponent & { variant?: Record<string, unknown> })
      .variant = uiVariants[String(newVariantName)];
  } else if (newVariantName == null) {
    delete (component.instance as RenderableComponent & { variant?: Record<string, unknown> }).variant;
  }

  // Refleja los nuevos valores en los inputs
  // declarados en la instancia. El ref interno
  // del input disparará el render del hijo.
  const rawProps = toRaw(props.target);
  for (const key of Object.keys(component.instance)) {
    const candidate = (component.instance as unknown as Record<string, unknown>)[
      key
    ];
    if (isInput(candidate)) {
      (candidate as Input<unknown>).value = rawProps[key];
    }
  }

  // El Pulse del componente detectará
  // el cambio si las props participan
  // en su render()
  return component.element ?? container.childNodes[index] ?? null;
}
