import { describe, expect, it } from "vitest";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import {
  dirname,
  join,
  relative,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../src/compiler";
import { createApp } from "../src";
import type { RenderableComponent } from "../src";

const thisDir = dirname(fileURLToPath(import.meta.url));

describe("compiler", () => {
  it("convierte JSX en llamadas h/text", () => {
    const source = `
@Component()
class Counter {
  render() {
    return <button onClick={() => this.count.value++}>{this.count.value}</button>;
  }
}`;

    const code = compile(source);

    expect(code).toContain('h("button"');
    expect(code).toContain("onClick: () => this.count.value++");
    expect(code).toContain("text(String(this.count.value))");
  });

  it("inyecta el selector kebab-case", () => {
    const code = compile(`@Component()
class UserCard {
  render() { return <div />; }
}`);

    expect(code).toContain('@Component({ selector: "user-card" })');
  });

  it("inyecta el selector en @UI", () => {
    const code = compile(`@UI()
class PrimaryButton {
  render() { return <button />; }
}`);

    expect(code).toContain('@UI({ selector: "primary-button" })');
  });

  it("preserva un selector explícito", () => {
    const code = compile(`@Component({ selector: "my-card" })
class Card {
  render() { return <div />; }
}`);

    expect(code).toContain('@Component({ selector: "my-card" })');
  });

  it("compila @if/@else en una expresión ternaria", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <div>
        @if (this.ok) { <p>Yes</p> }
        @else { <p>No</p> }
      </div>
    );
  }
}`);

    expect(code).toContain(
      "...((this.ok) ? [h(\"p\", null, [text(\"Yes\")])] : [h(\"p\", null, [text(\"No\")])])",
    );
  });

  it("compila @for con key", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <ul>
        @for (u of this.users; u.id) {
          <li>{u.name}</li>
        }
      </ul>
    );
  }
}`);

    expect(code).toContain(
      '...this.users.map((u) => h("li", { key: u.id }, [text(String(u.name))]))',
    );
  });

  it("compila @switch/@case/@default", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <div>
        @switch (this.status) {
          @case ("loading") { <p>Loading</p> }
          @case ("ok") { <p>Ok</p> }
          @default { <p>?</p> }
        }
      </div>
    );
  }
}`);

    expect(code).toContain("switch (this.status)");
    expect(code).toContain(
      'case "loading": return [h("p", null, [text("Loading")])];',
    );
    expect(code).toContain('default: return [h("p", null, [text("?")])];');
  });

  it("compila directivas custom a h(PascalCase, props, children)", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <div>
        @clickable (enabled) { <span>Click</span> }
      </div>
    );
  }
}`);

    expect(code).toContain(
      "h(Clickable, { enabled }, [h(\"span\", null, [text(\"Click\")])])",
    );
  });

  it("renombra template() a render()", () => {
    const code = compile(`@Component()
class App {
  template() {
    return <div>Hi</div>;
  }
}`);

    expect(code).toContain("render() {");
  });

  it("no convierte comparaciones ni genéricos en JSX", () => {
    const code = compile(`@Component()
class App {
  age = 10;
  name = input<string>();

  render() {
    return <p>{this.age > 5 ? "big" : "small"} {this.name.value}</p>;
  }
}`);

    expect(code).toContain("age > 5");
    expect(code).toContain("name = input<string>();");
  });

  it("agrega los imports del runtime", () => {
    const code = compile(
      `@Component()
class App {
  count = ref(0);

  render() {
    return <div>{this.count.value}</div>;
  }
}`,
      { importPath: "./runtime" },
    );

    expect(code).toContain(
      'import { Component, h, ref, text } from "./runtime";',
    );
  });
});

describe("compiler integration", () => {
  it("compila un .bel real, lo monta y reacciona a interacciones", async () => {
    // Vite transforma `new URL(<literal>, import.meta.url)` como un asset,
    // así que las rutas se construyen con path.resolve sobre el directorio
    // del archivo de test.
    const fixturePath = join(thisDir, "compiler", "fixtures", "counter.bel");
    const cacheDir = join(thisDir, "compiler", ".cache");

    const source = readFileSync(fixturePath, "utf8");
    const importPath = relative(
      cacheDir,
      join(thisDir, "..", "src", "index"),
    ).split("\\").join("/");
    const code = compile(source, { importPath });

    mkdirSync(cacheDir, { recursive: true });
    const outFile = join(cacheDir, "counter.ts");
    writeFileSync(outFile, code, "utf8");

    document.body.innerHTML = `<div id="app"></div>`;

    const mod = await import(pathToFileURL(outFile).href);
    const { Counter } = mod as { Counter: new () => RenderableComponent };

    const app = createApp(Counter);
    app.mount("#app");

    const root = document.querySelector("#app")!;

    expect(root.textContent).toContain("Count: 0");

    const button = root.querySelector("button")!;
    button.dispatchEvent(new MouseEvent("click"));

    expect(root.textContent).toContain("Count: 1");

    button.dispatchEvent(new MouseEvent("click"));
    button.dispatchEvent(new MouseEvent("click"));

    expect(root.textContent).toContain("Count: 3");
    expect(root.textContent).toContain("Big");
    expect(root.textContent).not.toContain("Small");

    expect(root.querySelectorAll("li")).toHaveLength(3);
  });
});
