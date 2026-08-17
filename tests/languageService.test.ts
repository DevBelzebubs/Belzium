import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BelziumLanguageService, type SourcePosition } from "../tools/belzium-language/src/languageService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TYPES_DIR = path.join(ROOT, "tools", "belzium-language", "types");
const LIB_DIR = path.join(
  path.dirname(createRequire(import.meta.url).resolve("typescript/package.json")),
  "lib",
);

const COUNTER_SOURCE = `@Component()
export class Counter {
  count = ref(0);
  items = [1, 2, 3];

  render() {
    return (
      <div>
        <button onClick={() => this.count.value++}>
          Count: {this.count.value}
        </button>
        @if (this.count.value >= 3) {
          <p>Big</p>
        } @else {
          <p>Small</p>
        }
      </div>
    );
  }
}
`;

const COUNTER_URI = "file:///counter.bel";

beforeAll(() => {
  const require = createRequire(import.meta.url);
  const tsc = require.resolve("typescript/lib/tsc.js");
  const tsconfig = path.join(ROOT, "tsconfig.types.json");
  execFileSync(process.execPath, [tsc, "-p", tsconfig], {
    stdio: "pipe",
    cwd: ROOT,
  });
});

function positionAt(source: string, offset: number): SourcePosition {
  const before = source.slice(0, offset);
  const lines = before.split("\n");
  return { line: lines.length - 1, character: lines[lines.length - 1].length };
}

function offsetAt(source: string, position: SourcePosition): number {
  const lines = source.split("\n");
  let offset = 0;
  for (let i = 0; i < position.line; i++) {
    offset += lines[i].length + 1;
  }
  return offset + position.character;
}

function createService(): BelziumLanguageService {
  return new BelziumLanguageService({
    rootDir: ROOT,
    typesDir: TYPES_DIR,
    libDir: LIB_DIR,
  });
}

describe("languageService", () => {
  it("sugiere miembros de this.count tras el punto", () => {
    const service = createService();
    service.openDocument(COUNTER_URI, COUNTER_SOURCE);

    const at = COUNTER_SOURCE.indexOf("this.count.") + "this.count.".length;
    const completions = service.getCompletionsAt(COUNTER_URI, positionAt(COUNTER_SOURCE, at));

    expect(completions.some((c) => c.label === "value")).toBe(true);
    expect(completions.some((c) => c.label === "IS_REF")).toBe(true);
  });

  it("muestra el tipo de this.count.value en hover", () => {
    const service = createService();
    service.openDocument(COUNTER_URI, COUNTER_SOURCE);

    const at = COUNTER_SOURCE.indexOf("this.count.value") + "this.count.value".length;
    const hover = service.getHoverAt(COUNTER_URI, positionAt(COUNTER_SOURCE, at));

    expect(hover).not.toBeNull();
    expect(hover!.contents).toMatch(/value/);
  });

  it("resuelve la definición de this.count a la propiedad de la clase", () => {
    const service = createService();
    service.openDocument(COUNTER_URI, COUNTER_SOURCE);

    const at = COUNTER_SOURCE.indexOf("this.count") + "this.".length;
    const definitions = service.getDefinitionAt(COUNTER_URI, positionAt(COUNTER_SOURCE, at));

    expect(definitions).toHaveLength(1);
    const def = definitions[0];
    expect(def.uri).toBe(COUNTER_URI);
    const fieldAt = COUNTER_SOURCE.indexOf("count = ref(0)");
    expect(def.start).toEqual(positionAt(COUNTER_SOURCE, fieldAt));
  });

  it("reporta un error semántico y lo mapea a la posición exacta del source", () => {
    const service = createService();
    const source = `@Component()
export class App {
  render() {
    return (
      <div>
        @if (this.missingProp) { <p>x</p> }
      </div>
    );
  }
}
`;
    service.openDocument(COUNTER_URI, source);

    const diagnostics = service.getDiagnostics(COUNTER_URI);
    expect(diagnostics.length).toBeGreaterThan(0);

    const missing = diagnostics.find((d) => d.message.includes("missingProp"));
    expect(missing).toBeDefined();
    expect(missing!.severity).toBe("error");

    const needleAt = source.indexOf("missingProp");
    expect(missing!.start).toEqual(positionAt(source, needleAt));
    expect(offsetAt(source, missing!.end)).toBeGreaterThan(needleAt);
  });

  it("sirve completions sobre un documento actualizado", () => {
    const service = createService();
    service.openDocument(COUNTER_URI, "@Component()\nclass A {\n  name = 'x';\n  render() { return <p>ok</p>; }\n}\n");

    const source = `@Component()
class A {
  name = 'x';
  render() { return <p>{this.na}</p>; }
}
`;
    service.updateDocument(COUNTER_URI, source);

    const at = source.indexOf("this.na") + "this.na".length;
    const completions = service.getCompletionsAt(COUNTER_URI, positionAt(source, at));

    expect(completions.some((c) => c.label === "name")).toBe(true);
  });

  it("no reporta errores en el fixture counter.bel (regresión de la lib de TS)", () => {
    const service = createService();
    const source = readFileSync(
      path.join(ROOT, "tests", "compiler", "fixtures", "counter.bel"),
      "utf8",
    );
    const uri = "file:///counter.bel";

    service.openDocument(uri, source);

    const diagnostics = service.getDiagnostics(uri);
    const codes = diagnostics.map((d) => d.code);
    expect(diagnostics).toHaveLength(0);
    expect(codes).not.toContain(2339);
    expect(codes).not.toContain(7006);
  });

  it("emite tokens semánticos para directivas y decoradores", () => {
    const service = createService();
    service.openDocument(COUNTER_URI, COUNTER_SOURCE);

    const tokens = service.getSemanticTokens(COUNTER_URI);
    const tokenAt = (needle: string) => {
      const expectedStart = positionAt(COUNTER_SOURCE, COUNTER_SOURCE.indexOf(needle));
      return tokens.find(
        (t) =>
          t.start.line === expectedStart.line &&
          t.start.character === expectedStart.character,
      );
    };

    const ifToken = tokenAt("@if");
    expect(ifToken).toBeDefined();
    expect(ifToken!.tokenType).toBe("keyword");
    expect(ifToken!.length).toBe("@if".length);

    const elseToken = tokenAt("@else");
    expect(elseToken).toBeDefined();
    expect(elseToken!.tokenType).toBe("keyword");

    const componentToken = tokenAt("@Component");
    expect(componentToken).toBeDefined();
    expect(componentToken!.tokenType).toBe("decorator");
    expect(componentToken!.length).toBe("@Component".length);
  });

  it("genera rangos de plegado para directivas @ y bloques de clase", () => {
    const service = createService();
    service.openDocument(COUNTER_URI, COUNTER_SOURCE);

    const folds = service.getFoldingRanges(COUNTER_URI);
    expect(folds.length).toBeGreaterThan(0);

    const ifAt = COUNTER_SOURCE.indexOf("@if");
    const ifClose = COUNTER_SOURCE.indexOf("}", ifAt);
    const ifStart = positionAt(COUNTER_SOURCE, ifAt);
    const ifFold = folds.find(
      (f) => f.kind === "region" && f.start.line === ifStart.line && f.start.character === ifStart.character,
    );
    expect(ifFold).toBeDefined();
    expect(ifFold!.end).toEqual(positionAt(COUNTER_SOURCE, ifClose));

    const elseAt = COUNTER_SOURCE.indexOf("@else");
    const elseStart = positionAt(COUNTER_SOURCE, elseAt);
    expect(
      folds.some(
        (f) => f.kind === "region" && f.start.line === elseStart.line && f.start.character === elseStart.character,
      ),
    ).toBe(true);
  });
});
