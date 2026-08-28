import { describe, expect, it } from "vitest";
import ts from "typescript";
import { belToTsx } from "../src/tsxTransform";

// Valida que el documento virtual sea TSX parseable.
function expectTsx(code: string): void {
  const sf = ts.createSourceFile(
    "test.tsx",
    code,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  );
  const parseDiagnostics = (
    sf as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
  ).parseDiagnostics;
  const messages = parseDiagnostics
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
    .join("\n");
  expect(messages).toBe("");
}

describe("belToTsx", () => {
  it("comenta los decoradores y conserva el resto de la línea", () => {
    const source = `@Component()
export class Counter {
  render() { return <div />; }
}`;

    const result = belToTsx(source);

    expect(result.code).toContain("/* @Component() */");
    expect(result.code).toContain("export class Counter {");
    expect(result.code).toContain("render() { return <div />; }");
    expectTsx(result.code);
  });

  it("comenta un decorador en la misma línea sin tragar la clase", () => {
    const source = `@Component() export class Counter {
  render() { return <div />; }
}`;

    const result = belToTsx(source);

    expect(result.code).toContain("/* @Component() */ export class Counter {");
    expect(result.code).toContain("render() { return <div />; }");
    expectTsx(result.code);
  });

  it("traduce <if>/<else> a un ternario", () => {
    const source = `<if condition={this.ok}><p>Yes</p></if><else><p>No</p></else>`;

    const result = belToTsx(source);

    expect(result.code).toContain("{ (this.ok) ? (<>");
    expect(result.code).toContain("</>) : (<>");
    expect(result.code).toContain("</>) }");
    expect(result.code).toContain("<p>Yes</p>");
    expect(result.code).toContain("<p>No</p>");
    expectTsx(result.code);
  });

  it("encadena <else-if>", () => {
    const source = `<if condition={a}>1</if><else-if condition={b}>2</else-if><else>3</else>`;

    const result = belToTsx(source);

    expect(result.code.endsWith("{ (a) ? (<>1</>) : (b) ? (<>2</>) : (<>3</>) }")).toBe(true);
    expectTsx(result.code);
  });

  it("traduce <for> a map", () => {
    const source = `<for each={u of this.users} key={u.id}>
  <li>{u.name}</li>
</for>`;

    const result = belToTsx(source);

    expect(result.code).toContain("{ this.users.map((u) => (<>");
    expect(result.code).toContain("</>)) }");
    expect(result.code).toContain("<li>{u.name}</li>");
    expectTsx(result.code);
  });

  it("traduce <switch>/<case>/<default>", () => {
    const source = `<switch value={this.status}>
  <case test={"loading"}><p>Loading</p></case>
  <default><p>?</p></default>
</switch>`;

    const result = belToTsx(source);

    expect(result.code).toContain("(() => { switch (this.status) {");
    expect(result.code).toContain('case ("loading"): return (<>');
    expect(result.code).toContain("default: return (<>");
    expect(result.code).toContain("} })() }");
    expectTsx(result.code);
  });

  it("pasa directivas custom PascalCase como componentes JSX", () => {
    const source = `<Clickable enabled={enabled}><span>Click</span></Clickable>`;

    const result = belToTsx(source);

    expect(result.code).toContain("<Clickable enabled={enabled}>");
    expect(result.code).toContain("<span>Click</span>");
    expect(result.code).toContain("</Clickable>");
    expectTsx(result.code);
  });

  it("anida directivas correctamente", () => {
    const source = `<if condition={a}><for each={x of xs}><li>{x}</li></for></if>`;

    const result = belToTsx(source);

    expect(result.code).toContain("{ (a) ? (<>");
    expect(result.code).toContain("{ xs.map((x) => (<>");
    expect(result.code).toContain("</>)) }");
    expect(result.code).toContain("</>) : null }");
    expectTsx(result.code);
  });

  it("respeta @ dentro de strings, comentarios y emails", () => {
    const source = `const email = "a@b.c"; // nota @importante
const text = \`${"${"}x@y${"}"}\`;`;

    const result = belToTsx(source);

    expect(result.code).toContain('const email = "a@b.c";');
    expect(result.code).toContain("// nota @importante");
    expect(result.code).toContain("x@y");
  });

  it("no toca @else fuera de un cuerpo de directiva", () => {
    const source = `const s = "@else";`;

    const result = belToTsx(source);

    expect(result.code).toContain('const s = "@else";');
  });

  it("antepone el import del runtime y desplaza el mapa", () => {
    const source = `@Component()
class App {
  count = ref(0);
  render() { return <div>{this.count.value}</div>; }
}`;

    const result = belToTsx(source);

    expect(result.code.startsWith("import { Component, ref } from \"belzium\";\n")).toBe(true);
    expectTsx(result.code);

    const offset = source.indexOf("class App");
    const virtual = result.toVirtual(offset);
    expect(virtual).toBeGreaterThan(offset);
    expect(result.code.slice(virtual, virtual + "class App".length)).toBe("class App");
    expect(result.toSource(virtual)).toBe(offset);
    expect(result.toSource(0)).toBeNull();
  });

  it("no antepone import si el source ya importa", () => {
    const source = `import { Component } from "./runtime";
@Component()
class App {
  render() { return <div />; }
}`;

    const result = belToTsx(source);

    expect(result.code).not.toMatch(/from "belzium"/);
  });

  it("mapea posiciones con round-trip a lo largo del documento", () => {
    const source = `@Component()
class App {
  render() {
    return (
      <div>
        <if condition={this.ok}><p>Yes</p></if>
        <else><p>No</p></else>
        <for each={u of this.users} key={u.id}><li>{u.name}</li></for>
      </div>
    );
  }
}`;

    const result = belToTsx(source);
    expectTsx(result.code);

    for (const marker of ["class App", "return (", "this.ok", "<p>Yes</p>", "u.name", "render()", "}"]) {
      const sourceOffset = source.indexOf(marker);
      expect(sourceOffset).toBeGreaterThanOrEqual(0);
      const virtual = result.toVirtual(sourceOffset);
      const back = result.toSource(virtual);
      expect(back).toBe(sourceOffset);
    }
  });

  it("mapea la región generada de una directiva a su marcador XML", () => {
    const source = `<if condition={this.ok}><p>Yes</p></if><else><p>No</p></else>`;
    const result = belToTsx(source);
    expectTsx(result.code);

    const ifAt = source.indexOf("<if");
    const virtual = result.toVirtual(ifAt);
    expect(result.toSource(virtual)).toBe(ifAt);

    expect(result.markers.some((m) => m.kind === "directive")).toBe(true);
  });

  it("mapea un decorador comentado a su marcador @", () => {
    const source = `@Component()
export class Counter {
  render() { return <div />; }
}`;
    const result = belToTsx(source);

    const at = source.indexOf("@Component");
    expect(result.toSource(result.toVirtual(at))).toBe(at);
  });

  it("expone los marcadores de directivas y decoradores", () => {
    const source = `@Component()
class App {
  render() {
    return (
      <div>
        <if condition={this.ok}><p>Yes</p></if>
        <else><p>No</p></else>
      </div>
    );
  }
}`;
    const result = belToTsx(source);

    expect(result.markers.map((m) => m.s)).toEqual([
      source.indexOf("@Component"),
      source.indexOf("<if"),
      source.indexOf("<else>"),
    ]);
  });

  it("no lanza con documento vacío ni con offsets fuera de rango", () => {
    const empty = belToTsx("");
    expect(empty.code).not.toBe("");
    expect(empty.toVirtual(0)).toBe(empty.code.length);
    expect(empty.toSource(0)).toBeNull();

    const source = `<if condition={c}>x</if>`;
    const result = belToTsx(source);
    expect(result.toVirtual(-5)).toBeGreaterThanOrEqual(0);
    expect(result.toVirtual(source.length + 100)).toBeGreaterThanOrEqual(0);
    expect(result.toSource(result.code.length + 100)).toBeNull();
  });

  it("mapea la región generada final (cierre de directiva)", () => {
    const source = `<if condition={c}>x</if>`;
    const result = belToTsx(source);
    expectTsx(result.code);

    const at = source.indexOf("<if");
    const virtual = result.toVirtual(at);
    expect(result.toSource(virtual)).toBe(at);

    const lastPos = result.code.length - 1;
    expect(result.toSource(lastPos)).not.toBeNull();
  });

  it("mapea las condiciones de las directivas a su posición exacta", () => {
    const source = `<if condition={this.ok}><p>Yes</p></if><else-if condition={this.other}><p>Other</p></else-if><else><p>No</p></else>`;
    const result = belToTsx(source);
    expectTsx(result.code);

    for (const expr of ["this.ok", "this.other"]) {
      const at = source.indexOf(expr);
      expect(result.toSource(result.toVirtual(at))).toBe(at);
    }
  });

  it("mapea la expresión iterable de <for> a su posición exacta", () => {
    const source = `<for each={n of this.items} key={n}><li>Item</li></for>`;
    const result = belToTsx(source);
    expectTsx(result.code);

    const at = source.indexOf("this.items");
    expect(result.toSource(result.toVirtual(at))).toBe(at);
  });

  it("mapea la condición de <switch> y el valor de <case> a su posición exacta", () => {
    const source = `<switch value={this.kind}><case test={"a"}>x</case><default>y</default></switch>`;
    const result = belToTsx(source);
    expectTsx(result.code);

    for (const expr of ["this.kind", `"a"`]) {
      const at = source.indexOf(expr);
      expect(result.toSource(result.toVirtual(at))).toBe(at);
    }
  });
});
