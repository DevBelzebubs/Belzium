// @Pipeline: decorador de clase que define un pipeline (flujo de nodos).
//
// A diferencia de un ejecutor, @Pipeline solo DECLARA la metadata del
// pipeline sobre la clase decorada; no ejecuta nada en esta fase.
import { defineMetadata, getMetadata } from "../di/metadata";
import type { PipelineMetadata } from "./types";

// Metadata que identifica un Pipeline.
export const PIPELINE_METADATA = Symbol("belzium:pipeline");

export function getPipelineMetadata(
  target: object,
): PipelineMetadata | undefined {
  return getMetadata<PipelineMetadata>(PIPELINE_METADATA, target);
}

// @Pipeline(): marca una clase como pipeline, registrando su metadata básica.
export function Pipeline(): ClassDecorator {
  return (target) => {
    defineMetadata(
      PIPELINE_METADATA,
      {
        isPipeline: true,
        graphId: Symbol("pipeline-graph"),
        nodes: [],
      } satisfies PipelineMetadata,
      target,
    );
  };
}
