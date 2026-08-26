// Definiciones de nodos AST para el compiler .bel.
//
// Cada nodo representa una construcción del lenguaje .bel:
// elementos JSX, texto, interpolaciones, directivas de plantilla
// (<if>, <for>, <switch>), decoradores, y código TypeScript
// que pasa sin modificar.
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

/**
 * Clase anotada con un decorador Belzium (@Component, @UI, @Store, etc.)
 * que contiene un método render() o template() con JSX.
 *
 * Ejemplo:
 *   @Component()
 *   class Counter {
 *     count = ref(0);
 *     render() { return <div>{this.count.value}</div>; }
 *   }
 */
export interface AnnotatedClassNode extends Loc {
  type: "AnnotatedClass";
  decorators: DecoratorNode[];
  name: string;
  /** El bloque render/template, o null si la clase no tiene template. */
  renderMethod: RenderBlock | null;
  /**
   * El resto del class body (campos, métodos no-render) como passthrough.
   * Se preserva tal cual en la salida.
   */
  body: string;
}

/**
 * Decorador aplicado a una clase.
 *
 * Ejemplo: `@Component({ selector: "counter" })`
 * Ejemplo: `@Store()`
 */
export interface DecoratorNode extends Loc {
  type: "Decorator";
  /** Nombre del decorador: "Component", "UI", "Store", "Hook", "Directive", etc. */
  name: string;
  /**
   * Argumentos raw del decorador, incluyendo paréntesis.
   * Ejemplo: `({ selector: "counter" })` o `()` si no tiene args.
   * null si es un decorator sin paréntesis (raro pero posible).
   */
  args: string | null;
}

/**
 * Bloque render() o template() de un componente.
 * Contiene los hijos del template (el árbol virtual).
 */
export interface RenderBlock extends Loc {
  type: "RenderBlock";
  children: TemplateNode[];
}

// Tipo unión de todos los nodos de nivel superior.
export type TopLevelNode = PassthroughNode | AnnotatedClassNode | TemplateNode;

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
 * Expresión interpolada: `{ expression }`.
 * Se compila como `text(String(expression))`.
 *
 * Ejemplo: `{this.count.value}` → `text(String(this.count.value))`
 */
export interface ExpressionNode extends Loc {
  type: "Expression";
  expression: string;
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
  value: AttributeValueNode | null;
}

/**
 * Spread attribute: `{...this.props}`.
 * Se compila como `...this.props` dentro del objeto de props.
 */
export interface SpreadAttributeNode extends Loc {
  type: "SpreadAttribute";
  expression: string;
}

/** Valor de un atributo normal. */
export type AttributeValueNode = StringValueNode | ExpressionValueNode;

/**
 * Valor de string literal: `class="active"`.
 * El valor NO incluye las comillas.
 */
export interface StringValueNode extends Loc {
  type: "StringValue";
  value: string;
}

/**
 * Valor de expresión: `onClick={handler}`.
 * El valor es la expresión raw entre las llaves.
 */
export interface ExpressionValueNode extends Loc {
  type: "ExpressionValue";
  expression: string;
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
  condition: string;
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
  iterable: string;
  /** Key de iteración (atributo key): "n.id", "item.key", etc. null si no hay key. */
  key: string | null;
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
  discriminant: string;
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
  test: string;
  consequent: TemplateNode[];
}


