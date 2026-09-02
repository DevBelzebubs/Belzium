// Template lowering: transforma las directivas declarativas del template
// (<if>, <for>, <switch>) en construcciones JS con slots semánticos ya
// resueltos (test, iterable, discriminant, ...), listas para que codegen
// las emita sin tener que conocer las directivas.
//
// El lowering es recursivo: los cuerpos internos (consequent, alternate,
// children, cases, default) se bajan a su vez, de modo que al final del
// proceso cada GeneratedNode es un TemplateNode sin directivas o un
// LoweredNode anidado.
//
// El resultado es un árbol `GeneratedNode[]` con offsets (Loc) preservados
// del .bel original, lo que permite que la emisión anote source maps.

import type {
  GeneratedNode,
  TemplateNode,
  TopLevelNode,
  PassthroughNode,
  ElementNode,
  FragmentNode,
  IfDirectiveNode,
  ForDirectiveNode,
  SwitchDirectiveNode,
  LoweredConditional,
  LoweredList,
  LoweredSwitchExpression,
  LoweredElement,
  LoweredFragment,
} from "./nodes";

/** Un nodo de entrada del lowering: puede ser top-level (passthrough) o template. */
export type LowerableNode = TopLevelNode | TemplateNode;

/** Resultado del lowering a nivel top-level: passthrough o template lowered. */
export type LoweredTopLevelNode = PassthroughNode | GeneratedNode;

/**
 * Baja una lista de nodos de nivel superior (que puede contener directivas
 * anidadas) a un array de GeneratedNodes (sin directivas sin resolver).
 */
export function lowerTemplate(nodes: LowerableNode[]): LoweredTopLevelNode[] {
  return nodes.map(lowerNode);
}

/** Baja un cuerpo de template (sin passthrough) a GeneratedNodes. */
function lowerTemplateNodes(nodes: TemplateNode[]): GeneratedNode[] {
  return nodes.map(lowerTemplateNode);
}

function lowerNode(node: LowerableNode): LoweredTopLevelNode {
  if ((node as PassthroughNode).type === "Passthrough") {
    return node as PassthroughNode;
  }
  return lowerTemplateNode(node as TemplateNode);
}

function lowerTemplateNode(node: TemplateNode): GeneratedNode {
  switch (node.type) {
    case "IfDirective":
      return lowerIf(node);
    case "ForDirective":
      return lowerFor(node);
    case "SwitchDirective":
      return lowerSwitch(node);
    case "Element":
      return lowerElement(node);
    case "Fragment":
      return lowerFragment(node);
    default:
      return node;
  }
}

function lowerIf(node: IfDirectiveNode): LoweredConditional {
  const spread = true;
  return {
    type: "LoweredConditional",
    test: node.condition,
    consequent: lowerTemplateNodes(node.consequent),
    alternate: lowerAlternate(node.alternate),
    spread,
    start: node.start,
    end: node.end,
  };
}

function lowerAlternate(
  alternate: IfDirectiveNode["alternate"],
): LoweredConditional["alternate"] {
  if (alternate === null) return null;
  if (Array.isArray(alternate)) return lowerTemplateNodes(alternate);
  return lowerIfChain(alternate);
}

function lowerIfChain(node: IfDirectiveNode): LoweredConditional {
  return {
    type: "LoweredConditional",
    test: node.condition,
    consequent: lowerTemplateNodes(node.consequent),
    alternate: lowerAlternate(node.alternate),
    spread: false,
    start: node.start,
    end: node.end,
  };
}

function lowerFor(node: ForDirectiveNode): LoweredList {
  return {
    type: "LoweredList",
    variable: node.variable,
    iterable: node.iterable,
    key: node.key,
    children: lowerTemplateNodes(node.children),
    start: node.start,
    end: node.end,
  };
}

function lowerElement(node: ElementNode): LoweredElement {
  return {
    type: "Element",
    tag: node.tag,
    isComponent: node.isComponent,
    attributes: node.attributes,
    children: lowerTemplateNodes(node.children),
    start: node.start,
    end: node.end,
  };
}

function lowerFragment(node: FragmentNode): LoweredFragment {
  return {
    type: "Fragment",
    children: lowerTemplateNodes(node.children),
    start: node.start,
    end: node.end,
  };
}

function lowerSwitch(node: SwitchDirectiveNode): LoweredSwitchExpression {
  return {
    type: "LoweredSwitchExpression",
    discriminant: node.discriminant,
    cases: node.cases.map(c => ({
      test: c.test,
      consequent: lowerTemplateNodes(c.consequent),
    })),
    defaultCase: node.defaultCase
      ? lowerTemplateNodes(node.defaultCase)
      : null,
    start: node.start,
    end: node.end,
  };
}