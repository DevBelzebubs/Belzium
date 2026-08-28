// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Component, createApp, ref } from "../src";
import { h, text } from "../src/runtime/vnode";

describe("onUpdated", () => {
  it("se ejecuta después de cada actualización, no en el montaje inicial", () => {
    document.body.innerHTML = `<div id="app"></div>`;

    let updatedCalls = 0;

    @Component()
    class App {
      count = ref(0);

      onUpdated() {
        updatedCalls++;
      }

      render() {
        return h("div", null, [text(String(this.count.value))]);
      }
    }

    const app = createApp(App);
    app.mount("#app");

    // El montaje inicial NO debe disparar onUpdated.
    expect(updatedCalls).toBe(0);

    const instance = app.context.resolve(App) as App;
    instance.count.value = 1;

    expect(updatedCalls).toBe(1);
    expect(document.querySelector("#app")!.textContent).toBe("1");

    app.unmount();
  });

  it("observa el DOM ya actualizado", () => {
    document.body.innerHTML = `<div id="app"></div>`;

    let seen = "";

    @Component()
    class App {
      count = ref(0);

      onUpdated() {
        seen = document.querySelector("#app")!.textContent ?? "";
      }

      render() {
        return h("div", null, [text(String(this.count.value))]);
      }
    }

    const app = createApp(App);
    app.mount("#app");

    const instance = app.context.resolve(App) as App;
    instance.count.value = 2;

    expect(seen).toBe("2");

    app.unmount();
  });
});
