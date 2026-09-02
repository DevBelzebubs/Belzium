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
import { CompileError } from "../src/compiler/errors";
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
        <if condition={this.ok}><p>Yes</p></if>
        <else><p>No</p></else>
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
        <for each={u of this.users} key={u.id}>
          <li>{u.name}</li>
        </for>
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
        <switch value={this.status}>
          <case test={\"loading\"}><Spinner /></case>
          <case test={\"error\"}><Error /></case>
          <default><p>Idle</p></default>
        </switch>
      </div>
    );
  }
}`);

    expect(code).toContain("switch (this.status)");
    expect(code).toContain(
      'case "loading": return [h(Spinner, null, [])];',
    );
    expect(code).toContain(
      'case "error": return [h(Error, null, [])];',
    );
    expect(code).toContain('default: return [h("p", null, [text("Idle")])];');
  });

  it("compila directivas custom a h(PascalCase, props, children)", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <div>
        <Clickable enabled={enabled}>
          <span>Click</span>
        </Clickable>
      </div>
    );
  }
}`);

    expect(code).toContain(
      "h(Clickable, { enabled: enabled }, [h(\"span\", null, [text(\"Click\")])])",
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

    // Desmonta para liberar el scope/efectos reactivos del componente.
    app.unmount();
  });

  it("ignora comentarios de línea dentro de expresiones", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <div>
        <if condition={this.ok // comment
}>
          <p>Yes</p>
        </if>
      </div>
    );
  }
}`);

    expect(code).toContain("this.ok");
    expect(code).toContain('h("p", null, [text("Yes")])');
  });

  it("ignora comentarios de bloque dentro de expresiones", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <div>
        <if condition={this.ok /* ) */}>
          <p>Works</p>
        </if>
      </div>
    );
  }
}`);

    expect(code).toContain("this.ok");
    expect(code).toContain('h("p", null, [text("Works")])');
  });

  it("acepta literales RegExp dentro de expresiones", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <div>
        <if condition={/^[{]$/.test(this.value)}>
          <p>Yes</p>
        </if>
      </div>
    );
  }
}`);

    expect(code).toContain("/^[{]$/.test(this.value)");
    expect(code).toContain('h("p", null, [text("Yes")])');
  });

  it("compila <else-if> encadenado correctamente", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <div>
        <if condition={this.status === "a"}>
          <p>A</p>
        </if>
        <else-if condition={this.status === "b"}>
          <p>B</p>
        </else-if>
        <else>
          <p>C</p>
        </else>
      </div>
    );
  }
}`);

    expect(code).toContain(
      "...((this.status === \"a\") ? [h(\"p\", null, [text(\"A\")])] : ((this.status === \"b\") ? [h(\"p\", null, [text(\"B\")])] : [h(\"p\", null, [text(\"C\")])]))",
    );
  });

  it("compila <for> sin key", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <ul>
        <for each={n of this.items}>
          <li>{n}</li>
        </for>
      </ul>
    );
  }
}`);

    expect(code).toContain(
      '...this.items.map((n) => h("li", null, [text(String(n))]))',
    );
  });

  it("compila <for> con múltiples hijos usando wrapper div", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <ul>
        <for each={item of this.items}>
          <span>{item}</span>
          <em>!</em>
        </for>
      </ul>
    );
  }
}`);

    expect(code).toContain('...this.items.map((item) => h("div", null, [h("span"');
    expect(code).toContain('h("em", null, [text("!")])');
  });

  it("lanza error si <else-if> aparece sin <if> previo", () => {
    expect(() => compile(`@Component()
class App {
  render() {
    return (
      <div>
        <else-if condition={true}>
          <p>Hi</p>
        </else-if>
      </div>
    );
  }
}`)).toThrow(/<else-if> must follow/);
  });

  it("lanza error si <for> no tiene atributo each", () => {
    expect(() => compile(`@Component()
class App {
  render() {
    return (
      <div>
        <for>
          <p>Hi</p>
        </for>
      </div>
    );
  }
}`)).toThrow(/each attribute/);
  });

  it("lanza CompileError con linea, columna y snippet", () => {
    const source = `@Component()
class App {
  render() {
    return (
      <div>
        <for>
          <p>Hi</p>
        </for>
      </div>
    );
  }
}`;
    try {
      compile(source);
      expect.unreachable("deberia lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(CompileError);
      const e = err as CompileError;
      expect(e.line).toBe(6);
      expect(e.column).toBe(9);
      expect(e.snippet).toContain("<for>");
      expect(e.snippet).toContain("^");
      expect(e.message).toContain("line 6");
      expect(e.message).toContain("column 9");
    }
  });

  it("reporta linea:columna en errores que antes no tenian posicion", () => {
    const source = `@Component()
class App {
  render() {
    return (<div id="abc>Hi</div>);
  }
}`;
    try {
      compile(source);
      expect.unreachable("deberia lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(CompileError);
      const e = err as CompileError;
      expect(e.message).toMatch(/Unterminated/);
      expect(e.line).toBe(4);
      expect(e.column).toBeGreaterThan(0);
    }
  });

  it("emite props con guion como claves string (data-*, aria-*)", () => {
    const code = compile(`@Component()
class App {
  render() {
    return <div data-id={this.id} aria-label="x" stroke-width={2}>Hi</div>;
  }
}`);
    expect(code).toContain('"data-id": this.id');
    expect(code).toContain('"aria-label": "x"');
    expect(code).toContain('"stroke-width": 2');
  });

  it("acepta literales string en <switch> y <case>", () => {
    const code = compile(`@Component()
class App {
  render() {
    return (
      <switch value="loading">
        <case test="loading"><p>Loading</p></case>
        <case test="ok"><p>Ok</p></case>
        <default><p>Other</p></default>
      </switch>
    );
  }
}`);
    expect(code).toContain("switch (\"loading\")");
    expect(code).toContain("case \"loading\":");
    expect(code).toContain("case \"ok\":");
  });

  it("da mensaje claro si <for each> recibe un string en vez de expresion", () => {
    const source = `@Component()
class App {
  render() {
    return <for each="x of items"><p>Hi</p></for>;
  }
}`;
    try {
      compile(source);
      expect.unreachable("deberia lanzar");
    } catch (err) {
      const e = err as CompileError;
      expect(e.message).toMatch(/each.*expression/i);
      expect(e.errorKind).toBe("template");
    }
  });

  it("lanza CompileError si la interpolación de texto tiene sintaxis inválida", () => {
    const source = `@Component()
class App {
  render() {
    return <div>{this.count.}</div>;
  }
}`;
    try {
      compile(source);
      expect.unreachable("deberia lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(CompileError);
      const e = err as CompileError;
      expect(e.message).toMatch(/interpolación de texto inválida/);
      expect(e.line).toBeGreaterThan(0);
      expect(e.errorKind).toBe("expression");
    }
  });

  it("lanza CompileError si un handler de evento tiene sintaxis inválida", () => {
    const source = `@Component()
class App {
  render() {
    return <button onClick={this.handle(}>X</button>;
  }
}`;
    try {
      compile(source);
      expect.unreachable("deberia lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(CompileError);
      const e = err as CompileError;
      expect(e.message).toMatch(/handler de evento inválida/);
    }
  });

  it("lanza CompileError si la condición de <if> tiene sintaxis inválida", () => {
    const source = `@Component()
class App {
  render() {
    return (
      <if condition={a b c}>
        <p>Hi</p>
      </if>
    );
  }
}`;
    try {
      compile(source);
      expect.unreachable("deberia lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(CompileError);
      const e = err as CompileError;
      expect(e.message).toMatch(/condición de <if> inválida/);
    }
  });

  it("acepta expresiones sintácticamente válidas sin romper", () => {
    const source = `@Component()
class App {
  render() {
    const tests = [
      /^[{]$/.test(this.value),
      this.a ? this.b : this.c,
      this.items.map((i) => i * 2),
      (() => { return 1; })(),
      \`hola \${this.name}\`,
    ];
    return (
      <div>
        <if condition={this.a > 0 && this.b === "x"}>
          <p>{String(tests.length)}</p>
        </if>
        <for each={item of this.items} key={item.id}>
          <span>{item.name}</span>
        </for>
      </div>
    );
  }
}`;
    expect(() => compile(source)).not.toThrow();
  });

  it("marca errorKind 'template' para errores de sintaxis XML del template", () => {
    const source = `@Component()
class App {
  render() {
    return <div><span></div>;
  }
}`;
    try {
      compile(source);
      expect.unreachable("deberia lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(CompileError);
      const e = err as CompileError;
      expect(e.errorKind).toBe("template");
    }
  });
});
