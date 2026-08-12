// VNode: representación virtual de un nodo del DOM

import { ComponentScope } from "../component/componentScope";
import type { RenderableComponent } from "../component/types";

// Nodo de texto: symbol que distingue los nodos de texto
// de los elementos HTML
export const TEXT_NODE = Symbol("belzium:text");

// Constructor de un componente Belzium
export type ComponentConstructor = new (
  ...args: never[]
) => RenderableComponent;

// Tipo de un VNode:
// tag HTML, nodo de texto o componente
export type VNodeType = string | typeof TEXT_NODE | ComponentConstructor;

// Identificador utilizado para mantener
// la identidad de un VNode entre renders
export type VNodeKey = string | number | symbol;

// Representa un nodo virtual del árbol
export interface VNode {
  // Tipo del nodo
  type: VNodeType;

  // Props destinadas al elemento o componente
  props: Record<string, unknown> | null;

  // Hijos del nodo
  children: VNode[];

  // Contenido de un nodo de texto
  text?: string;

  // Identidad opcional del nodo
  key?: VNodeKey;

  // Estado interno de un componente montado
  component?: VNodeComponentState;
}

// Estado interno asociado a un VNode de componente
export interface VNodeComponentState {
  // Instancia creada mediante ApplicationContext
  instance: RenderableComponent;

  // Árbol virtual generado por el componente
  subTree: VNode | null;

  element: Node | null;
  // Efecto Pulse asociado al componente
  scope: ComponentScope;
}

// Crea un VNode de elemento o componente
export function h(
  type: VNodeType,
  props: Record<string, unknown> | null = null,
  children: VNode[] = [],
): VNode {
  // La key se utiliza únicamente
  // para identificar el VNode durante el diff
  const key = props?.key as VNodeKey | undefined;

  // Las props reales no contienen la key
  const vnodeProps = props ? { ...props } : null;

  if (vnodeProps) {
    delete vnodeProps.key;
  }

  return {
    type,
    props: vnodeProps,
    children,
    key,
  };
}

// Crea un VNode de texto
export function text(value: string): VNode {
  return {
    type: TEXT_NODE,
    props: null,
    children: [],
    text: value,
  };
}

// Determina si dos VNodes pueden reutilizar
// la misma instancia o nodo real
export function isSameVNode(oldVNode: VNode, newVNode: VNode): boolean {
  // Dos VNodes son compatibles cuando tienen
  // el mismo tipo y la misma key
  return oldVNode.type === newVNode.type && oldVNode.key === newVNode.key;
}
