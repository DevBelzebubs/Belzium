// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  Directive,
  getDirectiveMetadata,
} from "../src/component/directive";
import { Component, createApp, isComponent } from "../src";
import { h, text } from "../src/runtime/vnode";
import { ApplicationContext } from "../src/di/applicationContext";
import { mountComponent } from "../src/runtime/vnodeRenderer";
import type { Slots } from "../src/component/slots";

describe("Directive", () => {
  it("registra metadata @Directive", () => {
    @Directive()
    class Clickable {}

    expect(getDirectiveMetadata(Clickable)).toBeDefined();
  });

  it("es considerado un componente", () => {
    @Directive()
    class Clickable {}

    expect(isComponent(Clickable)).toBe(true);
  });

  it("se renderiza como componente con props", () => {
    @Directive()
    class Clickable {
      props!: Readonly<{ enabled?: boolean }>;

      render() {
        return h("button", null, [text(String(this.props.enabled))]);
      }
    }

    const context = new ApplicationContext();
    context.register(Clickable);

    const container = document.createElement("div");
    const vnode = h(Clickable, { enabled: true });

    mountComponent(vnode, container, context, 0);

    expect(container.textContent).toBe("true");
  });

  it("recibe slots", () => {
    @Directive()
    class Card {
      slots!: Slots;

      render() {
        return h("div", null, this.slots.default?.() ?? []);
      }
    }

    const context = new ApplicationContext();
    context.register(Card);

    const container = document.createElement("div");
    const vnode = h(Card, null, [text("Hello")]);

    mountComponent(vnode, container, context, 0);

    expect(container.textContent).toBe("Hello");
  });

  it("se integra como componente raíz de una app", () => {
    document.body.innerHTML = `<div id="app"></div>`;

    @Directive()
    class Clickable {
      render() {
        return h("button", null, [text("Click")]);
      }
    }

    const app = createApp(Clickable);
    app.mount("#app");

    expect(document.querySelector("#app")!.textContent).toBe("Click");

    app.unmount();
  });
});
