// PipelineNodeType: tipos de nodo que puede contener un pipeline.
export type PipelineNodeType =
  | "source"
  | "transform"
  | "filter"
  | "join"
  | "group"
  | "aggregate"
  | "sink";

// PipelineNode: todo elemento de un pipeline es un nodo.
// Representa un vértice del grafo con sus conexiones (parents/children).
export interface PipelineNode<T = unknown> {
  id: symbol;
  type: PipelineNodeType;
  parents: PipelineNode<T>[];
  children: PipelineNode<T>[];
}

// Opciones para construir un nodo.
export interface PipelineNodeOptions<T = unknown> {
  type: PipelineNodeType;
  id?: symbol;
}

// Metadata que se almacena en la clase decorada con @Pipeline.
export interface PipelineMetadata {
  isPipeline: true;
  graphId: symbol;
  nodes: PipelineNode[];
}
