import { expect, it } from "vitest";
import { patch } from "../src/runtime/vnodeRenderer";
import { h } from "../src/runtime/vnode";
import { ApplicationContext } from "../src/di/applicationContext";
import { Component, output, ref } from "../src";

it("emite eventos hacia el componente padre", () => {
  let received = 0;

  @Component()
  class Child {
    valueChanged = output<number>();

    render() {
      this.valueChanged.emit(42);

      return h("div");
    }
  }

  const container = document.createElement("div");
  const context = new ApplicationContext();
  context.register(Child);

  patch(
    null,
    h(Child, {
      valueChanged: (value: number) => {
        received = value;
      }
    }),
    container,
    0,
    context
  );

  expect(received).toBe(42);
});
it("permite múltiples emisiones", () => {
  const values: number[] = [];

  const channel = output<number>();

  channel.subscribe((value) => {
    values.push(value);
  });

  channel.emit(1);

  channel.emit(2);

  channel.emit(3);

  expect(values).toEqual([1, 2, 3]);
});
it("permite cancelar una suscripción", () => {
  let calls = 0;

  const channel = output<number>();

  const unsubscribe = channel.subscribe(() => {
    calls++;
  });

  unsubscribe();

  channel.emit(1);

  expect(calls).toBe(0);
});
it("elimina automáticamente los listeners al desmontar", () => {
  let calls = 0;

  @Component()
  class Child {
    changed = output<number>();

    onUnmounted() {
      this.changed.emit(100);
    }

    render() {
      return h("div");
    }
  }

  const vnode = h(Child, {
    changed: () => {
      calls++;
    }
  });

  const container = document.createElement("div");
  const context = new ApplicationContext();
  context.register(Child);

  patch(null, vnode, container, 0, context);

  patch(vnode, null, container, 0, context);

  expect(calls).toBe(0);
});
it("permite el patrón bidireccional input-output", () => {
  const count = ref(0);

  @Component()
  class Child {
    value!: number;

    valueChange = output<number>();

    increment() {
      this.valueChange.emit(this.value + 1);
    }

    render() {
      if (this.value === 0) {
        this.increment();
      }

      return h("div");
    }
  }

  const container = document.createElement("div");
  const context = new ApplicationContext();
  context.register(Child);

  patch(
    null,
    h(Child, {
      value: count.value,
      valueChange: (value: number) => {
        count.value = value;
      }
    }),
    container,
    0,
    context
  );

  expect(count.value).toBe(1);
});