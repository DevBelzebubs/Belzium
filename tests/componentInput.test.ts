import { it, expect } from "vitest";
import { Component } from "../src";
import { h } from "../src/runtime/vnode";
import { patch } from "../src/runtime/vnodeRenderer";

it("asigna el valor inicial del input", () => {
  let received = -1;

  @Component()
  class Child {
    Input() value!: number;

    render() {
      received = this.value;

      return h("div");
    }
  }

  patch(
    null,
    h(Child, {
      value: 10,
    }),
    container,
    0,
    context,
  );

  expect(received).toBe(10);
});
it("actualiza el valor del input", () => {
  let received = -1;

  @Component()
  class Child {
    Input() value!: number;

    render() {
      received = this.value;

      return h("div");
    }
  }

  const oldVNode = h(Child, {
    value: 10,
  });

  patch(
    null,
    oldVNode,
    container,
    0,
    context,
  );

  const newVNode = h(Child, {
    value: 20,
  });

  patch(
    oldVNode,
    newVNode,
    container,
    0,
    context,
  );

  expect(received).toBe(20);
});