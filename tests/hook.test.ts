// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Hook, useHook, getHookMetadata } from "../src/component/hook";
import { Component, createApp, ref } from "../src";
import { h, text } from "../src/runtime/vnode";
import { ApplicationContext } from "../src/di/applicationContext";
import { mountComponent, patch } from "../src/runtime/vnodeRenderer";

describe("Hook", () => {
  it("registra metadata @Hook", () => {
    @Hook()
    class CounterHook {
      count = ref(0);
    }

    expect(getHookMetadata(CounterHook)).toBeDefined();
  });

  it("lanza error al usar useHook fuera de un componente", () => {
    @Hook()
    class CounterHook {
      count = ref(0);
    }

    expect(() => useHook(CounterHook)).toThrow(/inside a component/i);
  });

  it("crea una instancia por componente consumidor", () => {
    const created: number[] = [];

    @Hook()
    class CounterHook {
      constructor() {
        created.push(1);
      }
    }

    @Component()
    class AppA {
      hook = useHook(CounterHook);

      render() {
        return h("div");
      }
    }

    @Component()
    class AppB {
      hook = useHook(CounterHook);

      render() {
        return h("div");
      }
    }

    const context = new ApplicationContext();
    context.register(AppA);
    context.register(AppB);

    const containerA = document.createElement("div");
    const vnodeA = h(AppA);
    mountComponent(vnodeA, containerA, context, 0);

    const containerB = document.createElement("div");
    const vnodeB = h(AppB);
    mountComponent(vnodeB, containerB, context, 0);

    expect(created).toHaveLength(2);

    const hookA = (vnodeA.component!.instance as AppA).hook;
    const hookB = (vnodeB.component!.instance as AppB).hook;

    expect(hookA).not.toBe(hookB);
  });

  it("el estado del hook re-renderiza al componente consumidor", () => {
    document.body.innerHTML = `<div id="app"></div>`;

    @Hook()
    class CounterHook {
      count = ref(0);
    }

    @Component()
    class App {
      hook = useHook(CounterHook);

      render() {
        return h("div", null, [text(String(this.hook.count.value))]);
      }
    }

    const app = createApp(App);
    app.mount("#app");

    const element = document.querySelector("#app")!;

    expect(element.textContent).toBe("0");

    const instance = app.context.resolve(App) as App;
    instance.hook.count.value = 7;

    expect(element.textContent).toBe("7");

    app.unmount();
  });

  it("ejecuta onUnmounted del hook cuando el consumidor se desmonta", () => {
    const calls: string[] = [];

    @Hook()
    class CounterHook {
      onUnmounted() {
        calls.push("hook-unmounted");
      }
    }

    @Component()
    class App {
      hook = useHook(CounterHook);

      render() {
        return h("div");
      }
    }

    const context = new ApplicationContext();
    context.register(App);

    const container = document.createElement("div");
    const vnode = h(App);

    mountComponent(vnode, container, context, 0);

    expect(calls).toEqual([]);

    patch(vnode, null, container, 0, context);

    expect(calls).toEqual(["hook-unmounted"]);
  });
});
