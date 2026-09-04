// PipelineNode: factory y helpers para construir y conectar nodos.
import type {
  PipelineNode,
  PipelineNodeOptions,
} from "./types";

// Crea un nodo con id (por defecto uno anónimo) y arrays de conexión vacíos.
export function createNode<T = unknown>(
  options: PipelineNodeOptions<T>,
): PipelineNode<T> {
  return {
    id: options.id ?? Symbol(options.type),
    type: options.type,
    parents: [],
    children: [],
  };
}

// Conecta dos nodos: parent -> child.
export function link<T>(
  parent: PipelineNode<T>,
  child: PipelineNode<T>,
): void {
  parent.children.push(child);
  child.parents.push(parent);
}

// Guard: comprueba si un valor es estructuralmente un nodo.
export function isPipelineNode<T = unknown>(
  value: unknown,
): value is PipelineNode<T> {
  if (typeof value !== "object" || value === null) return false;
  const node = value as Partial<PipelineNode<T>>;
  return (
    typeof node.id === "symbol" &&
    typeof node.type === "string"
  );
}
