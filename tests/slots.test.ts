import { it, expect } from "vitest";
import { Component, useSlots } from "../src";
import type { Slots } from "../src";
import { h, text } from "../src/runtime/vnode";
import { patch } from "../src/runtime/vnodeRenderer";
import { ApplicationContext } from "../src/di/applicationContext";

it("recibe el slot default", () => {
  let received: unknown;

  @Component()
  class Card {
    setup() {
      received = useSlots().default;
    }

    render() {
      return h("div");
    }
  }

  const context = new ApplicationContext();
  context.registerProvider({
    provide: Card,
    useClass: Card,
  });
  const container = document.createElement("div");

  // montar Card con slot default...
  patch(null, h(Card, null, [text("body")]), container, 0, context);

  expect(received).toBeTypeOf("function");
});
it("permite múltiples slots nombrados", () => {
  let slots: Slots | undefined;

  @Component()
  class Card {
    setup() {
      slots = useSlots();
    }

    render() {
      return h("div");
    }
  }

  const context = new ApplicationContext();
  context.registerProvider({
    provide: Card,
    useClass: Card,
  });
  const container = document.createElement("div");

  patch(
    null,
    h(
      Card,
      {
        slots: {
          header: () => [h("h1", null, [text("Header")])],
          footer: () => [h("footer", null, [text("Footer")])],
        },
      },
      [text("body")],
    ),
    container,
    0,
    context,
  );

  expect(slots?.header).toBeTypeOf("function");
  expect(slots?.default).toBeTypeOf("function");
  expect(slots?.footer).toBeTypeOf("function");
});
it("un slot se evalúa al renderizarlo", () => {
  let executions = 0;

  const slot = () => {
    executions++;

    return [
      h("span", null, [
        text("content"),
      ]),
    ];
  };

  let slots: Slots | undefined;

  @Component()
  class Card {
    setup() {
      slots = useSlots();
    }

    render() {
      return h("div");
    }
  }

  const context = new ApplicationContext();
  context.registerProvider({
    provide: Card,
    useClass: Card,
  });
  const container = document.createElement("div");

  patch(null, h(Card, { slots: { default: slot } }), container, 0, context);

  // La función del slot no se evalúa al montar:
  expect(executions).toBe(0);

  // Se evalúa cuando el componente la consume:
  slots?.default?.();

  expect(executions).toBe(1);
});
