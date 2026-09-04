// PipelineGraph: contenedor del grafo de nodos de un pipeline.
//
// En esta fase solo almacena y conecta nodos; no ejecuta nada.
import type { PipelineNode } from "./types";
import { link } from "./node";

export class PipelineGraph<T = unknown> {
  private nodes = new Map<symbol, PipelineNode<T>>();

  // Registra un nodo en el grafo.
  addNode(node: PipelineNode<T>): PipelineNode<T> {
    this.nodes.set(node.id, node);
    return node;
  }

  // Obtiene un nodo por su id.
  getNode(id: symbol): PipelineNode<T> | undefined {
    return this.nodes.get(id);
  }

  // Devuelve todos los nodos registrados.
  getAllNodes(): PipelineNode<T>[] {
    return Array.from(this.nodes.values());
  }

  // Conecta dos nodos del grafo (parent -> child).
  link(parent: PipelineNode<T>, child: PipelineNode<T>): void {
    this.addNode(parent);
    this.addNode(child);
    link(parent, child);
  }
}
