import type {
  ProgramNode,
  TopLevelNode,
  PassthroughNode,
  TemplateNode,
  ElementNode,
  FragmentNode,
  TextNode,
  ExpressionNode,
  IfDirectiveNode,
  ForDirectiveNode,
  SwitchDirectiveNode,
  AttributeNode,
  NormalAttributeNode,
  SpreadAttributeNode,
  StringValueNode,
  ExpressionValueNode,
} from "./nodes";

export function generate(ast: ProgramNode): string {
  let out = "";
  for (const node of ast.body) {
    out += emitTopLevel(node);
  }
  return out;
}

function emitTopLevel(node: TopLevelNode): string {
  switch (node.type) {
    case "Passthrough":
      return node.code;
    default:
      return emitTemplateNode(node as TemplateNode);
  }
}

function emitChildren(nodes: TemplateNode[]): string {
  return nodes.map(n => emitTemplateNode(n)).filter(s => s !== "").join(", ");
}

function emitTemplateNode(node: TemplateNode): string {
  switch (node.type) {
    case "Element": return emitElement(node);
    case "Fragment": return emitFragment(node);
    case "Text": return emitText(node);
    case "Expression": return emitExpression(node);
    case "IfDirective": return emitIf(node);
    case "ForDirective": return emitFor(node);
    case "SwitchDirective": return emitSwitch(node);
    default: throw new Error(`Unknown node type: ${(node as { type: string }).type}`);
  }
}

function emitElement(node: ElementNode): string {
  const typeCode = node.isComponent ? node.tag : JSON.stringify(node.tag);
  const propsCode = emitProps(node.attributes);
  const childrenCode = `[${emitChildren(node.children)}]`;
  return `h(${typeCode}, ${propsCode}, ${childrenCode})`;
}

function emitFragment(node: FragmentNode): string {
  return `h("div", null, [${emitChildren(node.children)}])`;
}

function emitText(node: TextNode): string {
  if (!node.value) return "";
  return `text(${JSON.stringify(node.value)})`;
}

function emitExpression(node: ExpressionNode): string {
  return `text(String(${node.expression}))`;
}

function emitIf(node: IfDirectiveNode, spread = true): string {
  let expr = `(${node.condition}) ? [${emitChildren(node.consequent)}] : `;
  if (node.alternate === null) {
    expr += "[]";
  } else if (Array.isArray(node.alternate)) {
    expr += `[${emitChildren(node.alternate)}]`;
  } else {
    expr += emitIf(node.alternate, false);
  }
  return spread ? `...(${expr})` : `(${expr})`;
}

function emitFor(node: ForDirectiveNode): string {
  const meaningful = node.children.filter(
    n => !(n.type === "Text" && !n.value),
  );

  let childElement: ElementNode;
  if (meaningful.length === 1 && meaningful[0].type === "Element") {
    childElement = meaningful[0];
  } else {
    childElement = {
      type: "Element", tag: "div", isComponent: false,
      attributes: [], children: node.children,
      start: 0, end: 0,
    };
  }

  const keyAttr: NormalAttributeNode | null = node.key
    ? { type: "Attribute", name: "key", value: { type: "ExpressionValue", expression: node.key, start: 0, end: 0 } as ExpressionValueNode, start: 0, end: 0 }
    : null;

  const attrs = keyAttr ? [keyAttr, ...childElement.attributes] : childElement.attributes;
  const hCall = emitElement({ ...childElement, attributes: attrs });
  const mapBody = `(${node.variable}) => ${hCall}`;
  return `...${node.iterable}.map(${mapBody})`;
}

function emitSwitch(node: SwitchDirectiveNode): string {
  let body = "";
  for (const c of node.cases) {
    body += `case ${c.test}: return [${emitChildren(c.consequent)}]; `;
  }
  body += node.defaultCase
    ? `default: return [${emitChildren(node.defaultCase)}];`
    : "default: return [];";
  return `...(() => { switch (${node.discriminant}) { ${body} } })()`;
}

function emitProps(attrs: AttributeNode[]): string {
  if (attrs.length === 0) return "null";
  const entries: string[] = [];
  for (const attr of attrs) {
    if (attr.type === "SpreadAttribute") {
      entries.push(`...${attr.expression}`);
    } else {
      const name = normalizePropName(attr.name);
      const value = attr.value === null ? "true" : emitAttrValue(attr.value);
      entries.push(`${name}: ${value}`);
    }
  }
  return `{ ${entries.join(", ")} }`;
}

function emitAttrValue(value: StringValueNode | ExpressionValueNode): string {
  switch (value.type) {
    case "StringValue": return JSON.stringify(value.value);
    case "ExpressionValue": return value.expression;
  }
}

function normalizePropName(name: string): string {
  if (name === "className") return "class";
  if (name === "htmlFor") return "for";
  return name;
}
