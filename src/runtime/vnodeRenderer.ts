// Renderer de VNodes: convierte el árbol virtual en nodos reales del DOM

import { ApplicationContext } from "../di/applicationContext";

import { effect } from "../reactive/effect";

import type { RenderableComponent } from "../component/types";

import {
  TEXT_NODE,
  type ComponentConstructor,
  type VNode,
  type VNodeKey,
} from "./vnode";

// Determina si un VNode representa un componente
function isComponentVNode(vnode: VNode): boolean {
  return typeof vnode.type === "function";
}

// Determina si dos VNodes representan la misma entidad
function isSameVNode(oldVNode: VNode, newVNode: VNode): boolean {
  return oldVNode.type === newVNode.type && oldVNode.key === newVNode.key;
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
  const element = document.createElement(vnode.type);

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

  oldChildren.forEach((child, index) => {
    if (child.key !== undefined) {
      oldKeyToVNode.set(child.key, child);

      const node = container.childNodes[index];

      if (node) {
        oldKeyToNode.set(child.key, node);
      }
    }
  });

  // Procesa los nuevos hijos
  for (let newIndex = 0; newIndex < newChildren.length; newIndex++) {
    const newChild = newChildren[newIndex];

    const oldVNode =
      newChild.key !== undefined ? oldKeyToVNode.get(newChild.key) : undefined;

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
    const patchedNode = patchNode(oldVNode, newChild, oldNode, context);

    // Mueve el nodo existente
    // a su nueva posición
    if (patchedNode && container.childNodes[newIndex] !== patchedNode) {
      container.insertBefore(
        patchedNode,
        container.childNodes[newIndex] ?? null,
      );
    }
  }

  // Elimina nodos que ya no aparecen
  for (const oldChild of oldChildren) {
    if (
      oldChild.key !== undefined &&
      !newChildren.some((child) => child.key === oldChild.key)
    ) {
      const node = oldKeyToNode.get(oldChild.key);

      if (node?.parentNode === container) {
        container.removeChild(node);
      }
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

  // Resuelve la instancia mediante el IoC
  const instance = context.resolve(Component);

  // Estado interno del componente
  // que será conservado durante su vida
  const componentState = {
    instance,
    subTree: null as VNode | null,
    element: null as Node | null,
    effect: undefined as ReturnType<typeof effect> | undefined,
  };

  // Ejecuta el render dentro de Pulse.
  // Las dependencias utilizadas durante
  // render() quedan asociadas al componente.
  const renderEffect = effect(() => {
    // Genera el nuevo árbol virtual
    const nextVNode = instance.render();

    // El primer render no tiene
    // un árbol anterior
    if (!componentState.subTree) {
      const node = createElement(nextVNode, context);

      container.insertBefore(node, container.childNodes[index] ?? null);

      componentState.element = node;
    } else {
      // Los renders posteriores
      // utilizan el diff normal
      patch(componentState.subTree, nextVNode, container, index, context);
    }

    // Guarda el árbol generado
    // para la siguiente actualización
    componentState.subTree = nextVNode;
  });

  // Guarda el efecto en el estado interno
  componentState.effect = renderEffect;

  // Guarda el estado dentro del VNode.
  // Esto permite reutilizar la instancia
  // durante futuros patches.
  vnode.component = {
    instance: instance as RenderableComponent,

    subTree: componentState.subTree,

    effect: renderEffect,
  };

  // Recupera el nodo que acaba de montar
  const node = componentState.element;

  if (!node) {
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
  // El componente debe disponer
  // de su ApplicationContext
  if (!context) {
    throw new Error(`ApplicationContext is required to update a component`);
  }

  // Recupera el estado interno
  // del componente anterior
  const component = oldVNode.component;

  // Si por alguna razón no existe estado,
  // se monta nuevamente
  if (!component) {
    return mountComponent(newVNode, container, context, index);
  }

  // Reutiliza la misma instancia
  newVNode.component = component;

  // Por ahora el componente conserva
  // su propio Pulse effect.
  //
  // Los cambios de estado interno
  // dispararán directamente ese effect.
  //
  // En este punto solo sincronizamos
  // el subTree almacenado.
  return container.childNodes[index] ?? null;
}
