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
  SwitchCaseNode,
  AttributeNode,
  NormalAttributeNode,
  SpreadAttributeNode,
  StringValueNode,
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
  return emitElementParts(
    node.isComponent ? node.tag : JSON.stringify(node.tag),
    node.attributes,
    emitChildren(node.children),
  );
}

// Emite `h(type, props, [children])` a partir de sus partes, sin recurrir
// a nodos AST. Puede usarse tanto desde un ElementNode como desde <for>.
function emitElementParts(
  typeCode: string,
  attributes: AttributeNode[],
  childrenCode: string,
): string {
  const propsCode = emitProps(attributes);
  return `h(${typeCode}, ${propsCode}, [${childrenCode}])`;
}

function emitFragment(node: FragmentNode): string {
  return `h("div", null, [${emitChildren(node.children)}])`;
}

function emitText(node: TextNode): string {
  if (!node.value) return "";
  return `text(${JSON.stringify(node.value)})`;
}

function emitExpression(node: ExpressionNode): string {
  return `text(String(${node.source}))`;
}

function emitIf(node: IfDirectiveNode, spread = true): string {
  let expr = `(${node.condition.source}) ? [${emitChildren(node.consequent)}] : `;
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

  let typeCode: string;
  let attributes: AttributeNode[];
  let childrenCode: string;
  if (meaningful.length === 1 && meaningful[0].type === "Element") {
    typeCode = meaningful[0].isComponent
      ? meaningful[0].tag
      : JSON.stringify(meaningful[0].tag);
    attributes = meaningful[0].attributes;
    childrenCode = emitChildren(meaningful[0].children);
  } else {
    typeCode = JSON.stringify("div");
    attributes = [];
    childrenCode = emitChildren(node.children);
  }

  const propsCode = emitPropsWithKey(attributes, node.key);
  const hCall = `h(${typeCode}, ${propsCode}, [${childrenCode}])`;
  return `...${node.iterable.source}.map((${node.variable}) => ${hCall})`;
}

function emitSwitch(node: SwitchDirectiveNode): string {
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
