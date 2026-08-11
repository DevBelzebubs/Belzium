// Renderer de vnodes: convierte el árbol virtual en nodos reales del DOM

import { ApplicationContext } from "../di/applicationContext";
import { ComponentConstructor, TEXT_NODE, VNodeKey, type VNode } from "./vnode";
// Convierte un vnode en un elemento real del DOM
// Convierte un vnode en un nodo real del DOM
export function createElement(vnode: VNode, context?: ApplicationContext): Node {
  // Si es un nodo de texto, se crea un nodo de texto real
  if (vnode.type === TEXT_NODE) {
    return document.createTextNode(vnode.text ?? "");
  }

  // Los componentes se montan mediante su propio renderer
  if (typeof vnode.type === "function") {
    if (!context) {
        throw new Error(`ApplicationContext is required to render a component`);
    }
    return mountComponent(
        vnode,
        context
    );
  }

  // Crea el elemento según el tag del vnode
  const element = document.createElement(vnode.type);

  // Aplica las props: atributos y eventos
  patchProps(element, null, vnode.props);

  // Crea los hijos recursivamente y los agrega al elemento
  for (const child of vnode.children) {
    element.appendChild(createElement(child, context));
  }

  return element;
}

// Actualiza el DOM comparando un vnode anterior con uno nuevo
export function patch(
  oldVNode: VNode | null,
  newVNode: VNode | null,
  container: Node,
  index = 0,
  context?: ApplicationContext
): Node | null {
  // Si no existía un vnode anterior, se crea e inserta el nuevo
  if (!oldVNode && newVNode) {
    const node = createElement(newVNode);

    container.insertBefore(node, container.childNodes[index] ?? null);

    return node;
  }

  // Si el nuevo vnode no existe, se elimina el nodo anterior
  if (oldVNode && !newVNode) {
    const node = container.childNodes[index];

    if (node) {
      container.removeChild(node);
    }

    return null;
  }

  // Si alguno de los vnodes no existe, no hay nada más que comparar
  if (!oldVNode || !newVNode) {
    return null;
  }

  // Obtiene el nodo real correspondiente al vnode actual
  const currentNode = container.childNodes[index];

  // Si el nodo real no existe, se crea el nuevo vnode
  if (!currentNode) {
    const node = createElement(newVNode);

    container.appendChild(node);

    return node;
  }

  // Compara el vnode anterior con el nuevo sobre el nodo real existente
  return patchNode(oldVNode, newVNode, currentNode);
}

// Actualiza un nodo real existente comparando su vnode anterior con el nuevo
function patchNode(oldVNode: VNode, newVNode: VNode, currentNode: Node): Node {
  // Si los tipos son diferentes, se reemplaza completamente el nodo
  if (oldVNode.type !== newVNode.type) {
    const node = createElement(newVNode);

    currentNode.parentNode?.replaceChild(node, currentNode);

    return node;
  }

  // Si es un nodo de texto, solamente se actualiza su contenido
  if (newVNode.type === TEXT_NODE) {
    const oldText = oldVNode.text ?? "";

    const newText = newVNode.text ?? "";

    // Solo modifica el DOM si el texto realmente cambió
    if (oldText !== newText) {
      currentNode.textContent = newText;
    }

    return currentNode;
  }

  // Actualiza las props del elemento existente
  patchProps(currentNode as Element, oldVNode.props, newVNode.props);

  // Compara y actualiza los hijos del elemento
  patchChildren(oldVNode.children, newVNode.children, currentNode);

  return currentNode;
}

// Compara las props anteriores con las nuevas y actualiza el elemento
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
    // Solo actualiza la prop si su valor cambió
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
  // Si era un evento anterior, primero elimina su listener
  if (key.startsWith("on") && typeof previousValue === "function") {
    const event = key.slice(2).toLowerCase();

    element.removeEventListener(event, previousValue as EventListener);
  }

  // Las props on* son eventos: se registra el nuevo listener
  if (key.startsWith("on") && typeof value === "function") {
    const event = key.slice(2).toLowerCase();

    element.addEventListener(event, value as EventListener);

    return;
  }

  // Los valores falsy o null eliminan el atributo
  if (value === false || value == null) {
    element.removeAttribute(key);

    return;
  }

  // El resto de las props se aplican como atributos
  element.setAttribute(key, String(value));
}

// Elimina una prop del elemento real
function removeProp(element: Element, key: string, value: unknown): void {
  // Si la prop era un evento, elimina su listener
  if (key.startsWith("on") && typeof value === "function") {
    const event = key.slice(2).toLowerCase();

    element.removeEventListener(event, value as EventListener);

    return;
  }

  // Elimina el atributo del elemento
  element.removeAttribute(key);
}

// Compara los hijos anteriores con los nuevos y aplica los cambios
function patchChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: Node,
): void {
  // Si ninguno de los hijos tiene key, utilizamos el diff posicional simple
  const hasKeys =
    oldChildren.some((child) => child.key !== undefined) ||
    newChildren.some((child) => child.key !== undefined);
  if (!hasKeys) {
    patchChildrenByIndex(oldChildren, newChildren, container);

    return;
  }
  patchKeyedChildren(oldChildren, newChildren, container);
}
// Actualiza hijos comparando sus posiciones
function patchChildrenByIndex(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: Node,
): void {
  // Obtiene la cantidad máxima de hijos
  const maxLength = Math.max(oldChildren.length, newChildren.length);

  // Compara cada posición del árbol
  for (let i = 0; i < maxLength; i++) {
    patch(oldChildren[i] ?? null, newChildren[i] ?? null, container, i);
  }
}
// Actualiza hijos utilizando sus keys como identidad
function patchKeyedChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: Node,
): void {
  // Mapea cada key anterior a su vnode y a su nodo real
  const oldKeyToVNode = new Map<VNodeKey, VNode>();

  const oldKeyToNode = new Map<VNodeKey, Node>();

  oldChildren.forEach((child, index) => {
    if (child.key !== undefined) {
      oldKeyToVNode.set(child.key, child);

      oldKeyToNode.set(child.key, container.childNodes[index]);
    }
  });

  for (let newIndex = 0; newIndex < newChildren.length; newIndex++) {
    const newChild = newChildren[newIndex];

    const oldVNode =
      newChild.key !== undefined ? oldKeyToVNode.get(newChild.key) : undefined;

    // No existía → crear e insertar un nuevo nodo
    if (!oldVNode) {
      const newNode = createElement(newChild);

      container.insertBefore(newNode, container.childNodes[newIndex] ?? null);

      continue;
    }

    // Existe → parchear el nodo real correcto (el de la key)
    const patchedNode = patchNode(
      oldVNode,
      newChild,
      oldKeyToNode.get(oldVNode.key!)!,
    );

    // Mueve el nodo existente a su nueva posición
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
// Crea el nodo DOM correspondiente a un vnode de componente
function createComponentElement(vnode: VNode): Node {
  // Obtiene el constructor del componente
  const Component = vnode.type as ComponentConstructor;
  // Crea la instancia del componente
  const instance = new Component();
  // Renderiza el componente para obtener su vnode raíz
  const renderedVNode = instance.render();

  // Convierte el vnode del componente en DOM
  return createElement(renderedVNode);
}
export function mountComponent(
  vnode: VNode,
  context: ApplicationContext,
): Node {
  // Obtiene el constructor del componente
  const Component = vnode.type as ComponentConstructor;

  // Resuelve la instancia mediante el ApplicationContext
  const instance = context.resolve(Component);

  // Renderiza el componente para obtener su vnode raíz
  const renderedVNode = instance.render();

  // Convierte el vnode resultante en DOM
  return createElement(renderedVNode);
}
