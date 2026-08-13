import { expect, it } from "vitest";
import { patch } from "../src/runtime/vnodeRenderer";
import { h, text } from "../src/runtime/vnode";
import { ApplicationContext } from "../src/di/applicationContext";
import { Component, input, output, ref } from "../src";

it("recibe la prop del padre como input reactivo", () => {
  @Component()
  class Card {
    title = input<string>();

    render() {
      return h("div", null, [text(this.title.value)]);
    }
  }

  const context = new ApplicationContext();
  context.register(Card);
  const container = document.createElement("div");

  patch(null, h(Card, { title: "Hola" }), container, 0, context);

  expect(container.textContent).toBe("Hola");
});
it("actualiza el input cuando cambian las props", () => {
  @Component()
  class Counter {
    count = input<number>();

    render() {
      return h("div", null, [text(String(this.count.value))]);
    }
  }

  const context = new ApplicationContext();
  context.register(Counter);
  const container = document.createElement("div");

  const firstVNode = h(Counter, { count: 1 });

  patch(null, firstVNode, container, 0, context);

  expect(container.textContent).toBe("1");

  const secondVNode = h(Counter, { count: 2 });

  patch(firstVNode, secondVNode, container, 0, context);

  expect(container.textContent).toBe("2");
});
it("permite el patrón bidireccional input-output", () => {
  const count = ref(0);

  @Component()
  class Child {
    value = input<number>();

    valueChange = output<number>();

    increment() {
      this.valueChange.emit(this.value.value + 1);
    }

    render() {
      if (this.value.value === 0) {
        this.increment();
      }

      return h("div");
    }
  }

  const context = new ApplicationContext();
  context.register(Child);
  const container = document.createElement("div");

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
it("funciona como contenedor standalone", () => {
  const channel = input<number>();

  channel.value = 5;

  expect(channel.value).toBe(5);

  channel.value = 10;

  expect(channel.value).toBe(10);
});
