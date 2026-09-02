import type {
  PassthroughNode,
  GeneratedNode,
  LoweredElement,
  LoweredFragment,
  SelfClosingElementNode,
  TextNode,
  ExpressionNode,
  AttributeNode,
  NormalAttributeNode,
  SpreadAttributeNode,
  StringValueNode,
  LoweredConditional,
  LoweredList,
  LoweredSwitchExpression,
} from "./nodes";

export function generate(nodes: Array<PassthroughNode | GeneratedNode>): string {
  let out = "";
  for (const node of nodes) {
    out += emitTopLevel(node);
  }
  return out;
}

/** Re-emite un único nodo (template lowered o passthrough) a código string. */
export function emitNodeCode(node: PassthroughNode | GeneratedNode): string {
  return emitTopLevel(node);
}

function emitTopLevel(node: PassthroughNode | GeneratedNode): string {
  switch (node.type) {
    case "Passthrough":
      return node.code;
    case "LoweredConditional":
      return emitConditional(node);
    case "LoweredList":
      return emitList(node);
    case "LoweredSwitchExpression":
      return emitSwitch(node);
    default:
      return emitTemplateNode(node as GeneratedNode);
  }
}

function emitChildren(nodes: GeneratedNode[]): string {
  return nodes.map(n => emitTemplateNode(n)).filter(s => s !== "").join(", ");
}

function emitTemplateNode(node: GeneratedNode): string {
  switch (node.type) {
    case "Element": return emitElement(node as LoweredElement);
    case "Fragment": return emitFragment(node as LoweredFragment);
    case "SelfClosingElement": return emitSelfClosing(node as SelfClosingElementNode);
    case "Text": return emitText(node as TextNode);
    case "Expression": return emitExpression(node as ExpressionNode);
    case "LoweredConditional": return emitConditional(node as LoweredConditional);
    case "LoweredList": return emitList(node as LoweredList);
    case "LoweredSwitchExpression": return emitSwitch(node as LoweredSwitchExpression);
    default: throw new Error(`Unknown node type: ${(node as { type: string }).type}`);
  }
}

function emitElement(node: LoweredElement): string {
  return emitElementParts(
    node.isComponent ? node.tag : JSON.stringify(node.tag),
    node.attributes,
    emitChildren(node.children),
  );
}

function emitSelfClosing(node: SelfClosingElementNode): string {
  return `h(${node.isComponent ? node.tag : JSON.stringify(node.tag)}, ${emitProps(node.attributes)}, [])`;
}

// Emite `h(type, props, [children])` a partir de sus partes.
function emitElementParts(
  typeCode: string,
  attributes: AttributeNode[],
  childrenCode: string,
): string {
  const propsCode = emitProps(attributes);
  return `h(${typeCode}, ${propsCode}, [${childrenCode}])`;
}

function emitFragment(node: LoweredFragment): string {
  return `h("div", null, [${emitChildren(node.children)}])`;
}

function emitText(node: TextNode): string {
  if (!node.value) return "";
  return `text(${JSON.stringify(node.value)})`;
}

function emitExpression(node: ExpressionNode): string {
  return `text(String(${node.source}))`;
}

function emitConditional(node: LoweredConditional): string {
  let expr = `(${node.test.source}) ? [${emitChildren(node.consequent)}] : `;
  if (node.alternate === null) {
    expr += "[]";
  } else if (Array.isArray(node.alternate)) {
    expr += `[${emitChildren(node.alternate)}]`;
  } else {
    expr += emitConditional(node.alternate);
  }
  return node.spread ? `...(${expr})` : `(${expr})`;
}

function emitList(node: LoweredList): string {
  const meaningful = node.children.filter(
    n => !(n.type === "Text" && !(n as TextNode).value),
  );

  let typeCode: string;
  let attributes: AttributeNode[];
  let childrenCode: string;
  if (meaningful.length === 1 && meaningful[0].type === "Element") {
    const el = meaningful[0] as LoweredElement;
    typeCode = el.isComponent ? el.tag : JSON.stringify(el.tag);
    attributes = el.attributes;
    childrenCode = emitChildren(el.children);
  } else {
    typeCode = JSON.stringify("div");
    attributes = [];
    childrenCode = emitChildren(node.children);
  }

  const propsCode = emitPropsWithKey(attributes, node.key);
  const hCall = `h(${typeCode}, ${propsCode}, [${childrenCode}])`;
  return `...${node.iterable.source}.map((${node.variable}) => ${hCall})`;
}

function emitSwitch(node: LoweredSwitchExpression): string {
  let body = "";
  for (const c of node.cases) {
    body += `case ${c.test.source}: return [${emitChildren(c.consequent)}]; `;
  }
  body += node.defaultCase
    ? `default: return [${emitChildren(node.defaultCase)}];`
    : "default: return [];";
  return `...(() => { switch (${node.discriminant.source}) { ${body} } })()`;
}

function emitPropsWithKey(
  attributes: AttributeNode[],
  key: ExpressionNode | null,
): string {
  const entries: string[] = [];
  if (key) entries.push(`key: ${key.source}`);
  for (const attr of attributes) {
    if (attr.type === "SpreadAttribute") {
      entries.push(`...${attr.spread.source}`);
    } else {
      entries.push(`${propKeyCode(attr.name)}: ${attr.value === null ? "true" : emitAttrValue(attr.value)}`);
    }
  }
  return entries.length === 0 ? "null" : `{ ${entries.join(", ")} }`;
}

function emitProps(attrs: AttributeNode[]): string {
  if (attrs.length === 0) return "null";
  const entries: string[] = [];
  for (const attr of attrs) {
    if (attr.type === "SpreadAttribute") {
      entries.push(`...${attr.spread.source}`);
    } else {
      const value = attr.value === null ? "true" : emitAttrValue(attr.value);
      entries.push(`${propKeyCode(attr.name)}: ${value}`);
    }
  }
  return `{ ${entries.join(", ")} }`;
}

function emitAttrValue(value: StringValueNode | ExpressionNode): string {
  if (value.type === "StringValue") return JSON.stringify(value.value);
  return value.source;
}

// Devuelve la clave de prop ya lista para emitir: normaliza className/htmlFor
// y, si el nombre no es un identificador JS válido (data-*, aria-*, kebab, ...),
// lo emite como string para no generar JS inválido.
function propKeyCode(name: string): string {
  let key = normalizePropName(name);
  if (!/^[A-Za-z_$][\w$]*$/.test(key)) key = JSON.stringify(key);
  return key;
}

function normalizePropName(name: string): string {
  if (name === "className") return "class";
  if (name === "htmlFor") return "for";
  return name;
}