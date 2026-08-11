import { describe, it, expect } from "vitest";
import { isRef, ref } from "../src/reactive/ref";
import { effect } from "../src/reactive/effect";

describe("ref", () => {
  it("Deberia de crear una variable reactiva", () => {
    const count = ref(0);

    let dummy = 0;

    effect(() => {
      dummy = count.value;
    });

    expect(dummy).toBe(0);

    count.value = 1;

    expect(dummy).toBe(1);
  });
  it("actualiza su valor", () => {
    const count = ref(0);

    count.value = 10;

    expect(count.value).toBe(10);
  });

  it("es identificado por isRef()", () => {
    const count = ref(0);

    expect(isRef(count)).toBe(true);
  });

  it("no considera objetos normales como Ref", () => {
    expect(
      isRef({
        value: 10,
      }),
    ).toBe(false);
  });

  it("no considera null como Ref", () => {
    expect(isRef(null)).toBe(false);
  });

  it("no considera primitivas como Ref", () => {
    expect(isRef(10)).toBe(false);

    expect(isRef("hello")).toBe(false);

    expect(isRef(true)).toBe(false);
  });

  it("mantiene la identidad del Ref", () => {
    const count = ref(0);

    const original = count;

    count.value++;

    expect(count).toBe(original);
  });

  it("no dispara dependencias si el valor no cambia", () => {
    const count = ref(0);

    let executions = 0;

    effect(() => {
      executions++;

      count.value;
    });

    expect(executions).toBe(1);

    count.value = 0;

    expect(executions).toBe(1);
  });

  it("dispara dependencias cuando cambia el valor", () => {
    const count = ref(0);

    let executions = 0;

    effect(() => {
      executions++;

      count.value;
    });

    expect(executions).toBe(1);

    count.value = 1;

    expect(executions).toBe(2);
  });

  it("pasa correctamente el nuevo valor al effect", () => {
    const count = ref(0);

    let result = 0;

    effect(() => {
      result = count.value;
    });

    expect(result).toBe(0);

    count.value = 42;

    expect(result).toBe(42);
  });

  it("funciona con valores complejos", () => {
    const user = ref({
      name: "Juan",
    });

    expect(user.value.name).toBe("Juan");

    user.value = {
      name: "Pedro",
    };

    expect(user.value.name).toBe("Pedro");
  });

  it("permite almacenar otro Ref como valor", () => {
    const inner = ref(10);

    const outer = ref(inner);

    expect(outer.value).toBe(inner);

    expect(outer.value.value).toBe(10);
  });
});
