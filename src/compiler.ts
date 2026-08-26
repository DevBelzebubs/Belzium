import { toKebabCase } from "./component/metadata";
import { ASTBuilder } from "./compiler/astBuilder";
import { generate } from "./compiler/codegen";

export interface CompileOptions {
  importPath?: string;
}

export const RUNTIME_APIS = [
  "h", "text", "ref", "isRef", "reactive", "computed", "effect",
  "watch", "watchEffect", "input", "output", "onMounted", "onUnmounted",
  "onUpdated", "Store", "useStore", "resetStores", "Hook", "useHook",
  "Directive", "Component", "UI", "Service", "Configuration", "Bean",
  "createApp", "provide", "inject", "useSlots", "isComponent",
  "toReactive", "toRaw",
];

export function compile(
  source: string,
  options: CompileOptions = {},
): string {
  const importPath = options.importPath ?? "belzium";

  const ast = new ASTBuilder(source).build();
  let output = generate(ast);
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
