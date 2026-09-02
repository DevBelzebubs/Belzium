// Definiciones de nodos AST para el compiler .bel.
//
// Cada nodo representa una construcción del lenguaje .bel:
// elementos JSX, texto, interpolaciones, directivas de plantilla
// (<if>, <for>, <switch>), y código TypeScript que pasa sin modificar.
//
// Todos los nodos incluyen `start` y `end` (offsets en el source original)
// para habilitar source maps, errores con línea/columna, y tooling.

// ============================================================
// UBICACIÓN EN EL SOURCE
// ============================================================

/** Rango de un nodo en el source original (offsets de byte). */
export interface Loc {
  start: number;
  end: number;
}

// ============================================================
// NODOS DE NIVEL SUPERIOR (Top-Level)
// ============================================================

/**
 * Nodo raíz del AST.
 * Representa un archivo .bel completo.
 */
export interface ProgramNode extends Loc {
  type: "Program";
  body: TopLevelNode[];
}

/**
 * Código TypeScript que pasa sin modificar.
 * Esto incluye imports, exports, funciones, y cualquier código
 * que no sea un decorador con render/template.
 *
 * Ejemplo: `import { ref } from "belzium";`
 * Ejemplo: `const x = 42;`
 */
export interface PassthroughNode extends Loc {
  type: "Passthrough";
  code: string;
}

// Tipo unión de todos los nodos de nivel superior.
export type TopLevelNode = PassthroughNode | TemplateNode;

// ============================================================
// NODOS DE TEMPLATE (dentro de render())
// ============================================================

/**
 * Un nodo de template: cualquier cosa que puede aparecer
 * dentro del método render()/template() de un componente.
 */
export type TemplateNode =
  | ElementNode
  | SelfClosingElementNode
  | FragmentNode
  | TextNode
  | ExpressionNode
  | IfDirectiveNode
  | ForDirectiveNode
  | SwitchDirectiveNode;

// ---- Elementos JSX ----

/**
 * Elemento JSX con hijos: `<div class="x">...</div>`.
 * También cubre closing tags (`</div>`) — el parser los valida
 * y los consume, no los agrega al AST.
 */
export interface ElementNode extends Loc {
  type: "Element";
  /** Nombre del tag: "div", "UserCard", "my-element", etc. */
  tag: string;
  /** true si el tag es PascalCase o contiene "." (componente). */
  isComponent: boolean;
  attributes: AttributeNode[];
  children: TemplateNode[];
}

/**
 * Elemento JSX self-closing: `<img />`, `<UserCard />`.
 */
export interface SelfClosingElementNode extends Loc {
  type: "SelfClosingElement";
  tag: string;
  isComponent: boolean;
  attributes: AttributeNode[];
}

/**
 * Fragmento JSX: `<>...</>`.
 * Se compila como `h("div", null, [...])` (wrapper genérico).
 */
export interface FragmentNode extends Loc {
  type: "Fragment";
  children: TemplateNode[];
}

// ---- Texto e Interpolaciones ----

/**
 * Texto literal entre tags JSX.
 * Los saltos de línea con indentación se colapsan a un espacio.
 *
 * Ejemplo: en `<div>  Hello  </div>`, el "  Hello  " es un TextNode.
 */
export interface TextNode extends Loc {
  type: "Text";
  /** Texto original tal cual aparece en el source. */
  raw: string;
  /** Texto limpio (whitespace colapsado, sin indentación inicial). */
  value: string;
}

/**
 * Rol semántico de una expresión dentro del template.
 *
 * La capa de expression modela cualquier fragmento JS interpolado
 * (dentro de `{}`) de forma unificada: un `ExpressionNode` guarda el
 * texto raw balanceado en `source` y su `role` indica para qué se
 * usa. El parser clasifica el rol una sola vez; el lowering consume
 * el slot semántico y no necesita conocer la sintaxis del source.
 */
export type ExpressionRole =
  | "text" // {expr} interpolación de texto
  | "attrValue" // x={expr} atributo no-evento
  | "eventHandler" // onX={expr} atributo cuyo nombre empieza con "on"
  | "spread" // {..expr} spread de props
  | "condition" // <if condition={expr}>
  | "iterable" // <for each={x of expr}>
  | "key" // <for key={expr}>
  | "discriminant" // <switch value={expr}>
  | "caseTest"; // <case test={expr}>

/**
 * Una expresión JS interpolada en el template.
 *
 * Se compila según su rol: texto → `text(String(source))`, valor de
 * atributo o evento → `name: source`, spread → `...source`, etc.
 *
 * Ejemplo: `{this.count.value}` → `Expression { role: "text", source: "this.count.value" }`
 */
export interface ExpressionNode extends Loc {
  type: "Expression";
  role: ExpressionRole;
  /** Texto JS raw balanceado (ya depurado por readGroup). */
  source: string;
}

// ---- Atributos ----

/** Un atributo de un elemento JSX. */
export type AttributeNode = NormalAttributeNode | SpreadAttributeNode;

/**
 * Atributo normal: `name={value}` o `name="string"` o `name`.
 *
 * Si value es null, el atributo es booleano (implícito true):
 *   `<disabled>` → `{ disabled: true }`
 */
export interface NormalAttributeNode extends Loc {
  type: "Attribute";
  name: string;
  /** value es null para atributos booleanos. */
  value: AttributeValueNode | null;
}

/**
 * Spread attribute: `{...this.props}`.
 * Se compila como `...this.props` dentro del objeto de props.
 */
export interface SpreadAttributeNode extends Loc {
  type: "SpreadAttribute";
  spread: ExpressionNode;
}

/** Valor de un atributo normal. */
export type AttributeValueNode = StringValueNode | ExpressionNode;

/**
 * Valor de string literal: `class="active"`.
 * El valor NO incluye las comillas.
 */
export interface StringValueNode extends Loc {
  type: "StringValue";
  value: string;
}

// ---- Directivas de Plantilla ----

/**
 * Directiva `<if>` / `<else-if>` / `<else>`.
 *
 * Se compila como expresión ternaria esparcida:
 *   `...((cond) ? [consequent] : [alternate])`
 *
 * Si no hay <else>, alternate es null y se compila a `...((cond) ? [consequent] : [])`.
 * Si hay <else-if>, alternate es otro IfDirectiveNode (encadenado).
 */
export interface IfDirectiveNode extends Loc {
  type: "IfDirective";
  condition: ExpressionNode;
  consequent: TemplateNode[];
  /**
   * - null: no hay rama alternativa
   * - TemplateNode[]: <else> simple
   * - IfDirectiveNode: <else-if> (encadenado)
   */
  alternate: TemplateNode[] | IfDirectiveNode | null;
}

/**
 * Directiva `<for each={var of iterable} key={key}>`.
 *
 * Se compila como `.map()`:
 *   `...iterable.map((variable) => h(..., { key: ... }, [...]))`
 */
export interface ForDirectiveNode extends Loc {
  type: "ForDirective";
  /** Variable de iteración: "n", "item", etc. */
  variable: string;
  /** Expresión del iterable: "this.items", "this.users", etc. */
  iterable: ExpressionNode;
  /** Key de iteración (atributo key), o null si no hay key. */
  key: ExpressionNode | null;
  children: TemplateNode[];
}

/**
 * Directiva `<switch>` / `<case>` / `<default>`.
 *
 * Se compila como IIFE con switch:
 *   `...(() => { switch (discriminant) { case ...: return [...]; default: return [...]; } })()`
 */
export interface SwitchDirectiveNode extends Loc {
  type: "SwitchDirective";
  /** Expresión del switch: "this.status", "this.mode", etc. */
  discriminant: ExpressionNode;
  cases: SwitchCaseNode[];
  /** Cuerpo del `<default>`, o null si no hay default. */
  defaultCase: TemplateNode[] | null;
}

/**
 * Un case dentro de un `<switch>`.
 *
 * Ejemplo: `<case test={"loading"}><Spinner /></case>`
 */
export interface SwitchCaseNode extends Loc {
  type: "SwitchCase";
  /** Valor del case: `"loading"`, `42`, etc. (raw expression). */
  test: ExpressionNode;
  consequent: TemplateNode[];
}

// ============================================================
// NODOS LOWERED (resultado del template lowering)
// ============================================================

/**
 * Un hijo ya lowered: puede ser un TemplateNode ordinario (que ya no
 * contiene directivas) o un LoweredNode (una directiva resuelta).
 *
 * El lowering transpila cada `<if>/<for>/<switch>` (y sus cuerpos) a esta
 * forma, dejando codegen como emisor puro sin conocimiento de directivas.
 */
export type GeneratedNode =
  | LoweredElement
  | LoweredFragment
  | SelfClosingElementNode
  | TextNode
  | ExpressionNode
  | LoweredNode;

/**
 * Un elemento JSX tras el lowering: igual a ElementNode pero sus hijos son
 * GeneratedNodes (ya bajados recursivamente).
 */
export interface LoweredElement extends Loc {
  type: "Element";
  tag: string;
  isComponent: boolean;
  attributes: AttributeNode[];
  children: GeneratedNode[];
}

/**
 * Un fragmento JSX tras el lowering: igual a FragmentNode pero sus hijos son
 * GeneratedNodes (ya bajados recursivamente).
 */
export interface LoweredFragment extends Loc {
  type: "Fragment";
  children: GeneratedNode[];
}

/**
 * Resultado del lowering de una directiva de plantilla. El lowering
 * convierte la forma declarativa en construcciones JS con slots
 * semánticos ya resueltos (test, iterable, etc.).
 */
export type LoweredNode =
  | LoweredConditional
  | LoweredList
  | LoweredSwitchExpression;

/**
 * `<if> / <else-if> / <else>` lowered a una expresión ternaria esparcida:
 *   `...((test) ? [consequent] : [alternate])`
 */
export interface LoweredConditional extends Loc {
  type: "LoweredConditional";
  /** Expresión del test: "this.ok", "a > 0", ... */
  test: ExpressionNode;
  consequent: GeneratedNode[];
  /**
   * - null: no hay rama alternativa (se emite `[]`)
   * - GeneratedNode[]: `<else>` simple
   * - LoweredConditional: `<else-if>` encadenado
   */
  alternate: GeneratedNode[] | LoweredConditional | null;
  /**
   * true si es la directiva raíz (se emite con spread inicial),
   * false para `<else-if>` encadenado.
   */
  spread: boolean;
}

/**
 * `<for each={var of iterable} key={...}>` lowered a `.map()`:
 *   `...iterable.map((variable) => <body>)`
 */
export interface LoweredList extends Loc {
  type: "LoweredList";
  /** Variable de iteración: "n", "item", ... */
  variable: string;
  /** Expresión del iterable: "this.items", ... */
  iterable: ExpressionNode;
  /** Key de iteración (atributo key), o null si no hay key. */
  key: ExpressionNode | null;
  /** Hijos del cuerpo del bucle (ya lowered). */
  children: GeneratedNode[];
}

/**
 * `<switch> / <case> / <default>` lowered a una IIFE con switch:
 *   `...(() => { switch (discriminant) { case ...: return [...]; default: return [...]; } })()`
 */
export interface LoweredSwitchExpression extends Loc {
  type: "LoweredSwitchExpression";
  /** Expresión del switch: "this.status", ... */
  discriminant: ExpressionNode;
  cases: Array<{ test: ExpressionNode; consequent: GeneratedNode[] }>;
  /** Cuerpo del `<default>`, o null si no hay default. */
  defaultCase: GeneratedNode[] | null;
}


