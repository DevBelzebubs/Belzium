import { describe, expect, it } from "vitest";
import {
  Pipeline,
  getPipelineMetadata,
  createNode,
  link,
  isPipelineNode,
  PipelineGraph,
} from "../src";
import type { PipelineNode } from "../src/pipeline/types";
import { createNode as rawCreateNode } from "../src/pipeline/node";

describe("@Pipeline", () => {
  it("Debería marcar una clase como pipeline", () => {
    @Pipeline()
    class ETLPipeline {}

    const metadata = getPipelineMetadata(ETLPipeline);
    expect(metadata).toBeDefined();
    expect(metadata?.isPipeline).toBe(true);
    expect(typeof metadata?.graphId).toBe("symbol");
    expect(metadata?.nodes).toEqual([]);
  });

  it("Cada pipeline debería tener un graphId único", () => {
    @Pipeline()
    class A {}
    @Pipeline()
    class B {}

    const a = getPipelineMetadata(A);
    const b = getPipelineMetadata(B);
    expect(a!.graphId).not.toBe(b!.graphId);
  });
});

describe("createNode", () => {
  it("Debería crear un nodo con id, tipo y conexiones vacías", () => {
    const node = createNode({ type: "source" });
    expect(typeof node.id).toBe("symbol");
    expect(node.type).toBe("source");
    expect(node.parents).toEqual([]);
    expect(node.children).toEqual([]);
  });

  it("Debería respetar un id proporcionado", () => {
    const id = Symbol("users");
    const node = createNode({ id, type: "transform" });
    expect(node.id).toBe(id);
  });
});

describe("link", () => {
  it("Debería conectar parent -> child", () => {
    const source = createNode({ type: "source" });
    const sink = createNode({ type: "sink" });

    link(source, sink);

    expect(source.children).toContain(sink);
    expect(sink.parents).toContain(source);
  });
});

describe("isPipelineNode", () => {
  it("Debería reconocer un nodo válido", () => {
    const node = rawCreateNode({ type: "join" });
    expect(isPipelineNode(node)).toBe(true);
  });

  it("Debería rechazar valores que no son nodos", () => {
    expect(isPipelineNode(null)).toBe(false);
    expect(isPipelineNode({})).toBe(false);
    expect(isPipelineNode({ id: "x", type: "filter" })).toBe(false);
  });
});

describe("PipelineGraph", () => {
  it("Debería registrar, consultar y conectar nodos", () => {
    const graph = new PipelineGraph();
    const source = createNode<number>({ type: "source" });
    const aggregate = createNode<number>({ type: "aggregate" });

    graph.link(source, aggregate);

    expect(graph.getNode(source.id)).toBe(source);
    expect(graph.getNode(aggregate.id)).toBe(aggregate);

    const nodes: PipelineNode<number>[] = graph.getAllNodes();
    expect(nodes).toHaveLength(2);
    expect(source.children).toContain(aggregate);
    expect(aggregate.parents).toContain(source);
  });
});
