// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  Store,
  useStore,
  resetStores,
  getStoreMetadata,
} from "../src/store";
import { Component, createApp, effect } from "../src";
import { h, text } from "../src/runtime/vnode";

describe("Store", () => {
  it("registra metadata @Store", () => {
    @Store()
    class CounterStore {
      count = 0;
    }

    expect(getStoreMetadata(CounterStore)).toBeDefined();
  });

  it("lanza error al usar una clase sin @Store", () => {
    class NotAStore {
      count = 0;
    }

    expect(() => useStore(NotAStore)).toThrow(/not a store/i);
  });

  it("retorna la misma instancia para el mismo store (singleton global)", () => {
    @Store()
    class CounterStore {
      count = 0;
    }

    const first = useStore(CounterStore);
    const second = useStore(CounterStore);

    expect(first).toBe(second);
  });

  it("no requiere IoC: se puede usar sin ningún contexto", () => {
    @Store()
    class CounterStore {
      count = 0;
    }

    const store = useStore(CounterStore);
    store.count = 5;

    expect(store.count).toBe(5);
  });

  it("los campos son reactivos: un effect se re-ejecuta al cambiar", () => {
    @Store()
    class CounterStore {
      count = 0;
    }

    const store = useStore(CounterStore);
    const seen: number[] = [];

    effect(() => {
      seen.push(store.count);
    });

    expect(seen).toEqual([0]);

    store.count = 1;

    expect(seen).toEqual([0, 1]);
  });

  it("re-renderiza un componente que lee el store", () => {
    document.body.innerHTML = `<div id="app"></div>`;

    @Store()
    class CounterStore {
      count = 0;
    }

    @Component()
    class App {
      store = useStore(CounterStore);

      render() {
        return h("div", null, [text(String(this.store.count))]);
      }
    }

    const app = createApp(App);
    app.mount("#app");

    const element = document.querySelector("#app")!;

    expect(element.textContent).toBe("0");

    useStore(CounterStore).count = 3;

    expect(element.textContent).toBe("3");
  });

  it("resetStores limpia las instancias", () => {
    @Store()
    class CounterStore {
      count = 10;
    }

    useStore(CounterStore).count = 99;
    resetStores();

    const fresh = useStore(CounterStore);

    expect(fresh.count).toBe(10);
  });
});
