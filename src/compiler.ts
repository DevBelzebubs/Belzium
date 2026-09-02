import { toKebabCase } from "./component/metadata";
import { ASTBuilder } from "./compiler/astBuilder";
import { generate } from "./compiler/codegen";
import { lowerTemplate } from "./compiler/templateLowering";
import { buildOutputMagicString } from "./compiler/sourceMap";
import type { LoweredTopLevelNode } from "./compiler/templateLowering";

export interface CompileOptions {
  importPath?: string;
  /** Devuelve `{ code, map }` con un source map (magic-string) de h()/text(). */
  sourceMap?: boolean;
}

export const RUNTIME_APIS = [
  "h", "text", "ref", "isRef", "reactive", "computed", "effect",
  "watch", "watchEffect", "input", "output", "onMounted", "onUnmounted",
  "onUpdated", "Store", "useStore", "resetStores", "Hook", "useHook",
  "Directive", "Component", "UI", "Service", "Configuration", "Bean",
  "createApp", "provide", "inject", "useSlots", "isComponent",
  "toReactive", "toRaw",
];

export interface CompileResult {
  code: string;
  /** Source map (si options.sourceMap es true). */
  map?: string;
}

export function compile(source: string, options: CompileOptions & { sourceMap: true }): CompileResult;
export function compile(source: string, options?: CompileOptions): string;
export function compile(
  source: string,
  options: CompileOptions = {},
): CompileResult | string {
  const importPath = options.importPath ?? "belzium";

  const ast = new ASTBuilder(source).build();
  const lowered: LoweredTopLevelNode[] = lowerTemplate(ast.body);
  let output = generate(lowered);
  output = injectSelectors(output);
  output = output.replace(/\btemplate(\s*\([^)]*\)\s*\{)/g, "render$1");

  const used = new Set<string>();
  for (const api of RUNTIME_APIS) {
    if (new RegExp(`\\b${api}\\b`).test(source)) {
      used.add(api);
    }
  }
  if (/\bh\(/.test(output)) used.add("h");
  if (/\btext\(/.test(output)) used.add("text");

  const imports = [...used].sort((a, b) =>
    a.toLowerCase() < b.toLowerCase()
      ? -1
      : a.toLowerCase() > b.toLowerCase()
        ? 1
        : 0,
  );

  const header =
    imports.length > 0
      ? `import { ${imports.join(", ")} } from ${JSON.stringify(importPath)};\n\n`
      : "";

  if (options.sourceMap) {
    const ms = buildOutputMagicString(source, lowered, header);
    const code = ms.toString();
    const map = ms.generateMap({
      source: "source.bel",
      includeContent: true,
      hires: true,
      file: "output.ts",
    });
    return { code, map: map.toString() };
  }

  return header + output;
}

function injectSelectors(code: string): string {
  return code.replace(
    /@(Component|UI)\(\)(?=\s*(?:export\s+|declare\s+|abstract\s+)*class\s+([A-Za-z_$][\w$]*))/g,
    (_match, decorator: string, className: string) =>
      `@${decorator}({ selector: ${JSON.stringify(toKebabCase(className))} })`,
  );
}

export function toPascalCase(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function cleanText(raw: string): string {
  if (!raw.trim()) return "";
  const collapsed = raw.replace(/\s*\n\s*/g, " ");
  return collapsed.replace(/^\s+/, "");
}

export function normalizePropName(name: string): string {
  if (name === "className") return "class";
  if (name === "htmlFor") return "for";
  return name;
}

export function splitTopLevel(source: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let inString: string | null = null;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
    } else if (ch === separator && depth === 0) {
      parts.push(source.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}
