import { describe, it, expect } from "vitest";
import {
  Component,
  createComponentInstance,
  inject,
  provide,
  setupComponent,
} from "../src/component/component";

describe("injection", () => {
  it("Deberia proveer e inya ectar un valor", () => {
    const service = {
      name: "API",
    };

    let injected;

    const App = {
      setup() {
        provide("api", service);
        return {};
      },
    };

    const Child = {
      setup() {
        injected = inject("api");

        return {};
      },
    };
    const app = createComponentInstance(App);

    setupComponent(app);

    const child = createComponentInstance(Child, {}, app);
    setupComponent(child);
    expect(injected).toBe(service);
  });
  it("Deberia poder sobreescribir proveedores padres de los proveedores hijos", () => {
    const parentService = {
      name: "parent",
    };

    const childService = {
      name: "child",
    };

    let injected;

    const App = {
      setup() {
        provide("service", parentService);

        return {};
      },
    };

    const Child = {
      setup() {
        provide("service", childService);

        return {};
      },
    };

    const GrandChild = {
      setup() {
        injected = inject("service");

        return {};
      },
    };

    const app = createComponentInstance(App);

    setupComponent(app);

    const child = createComponentInstance(Child, {}, app);

    setupComponent(child);

    const grandChild = createComponentInstance(GrandChild, {}, child);

    setupComponent(grandChild);

    expect(injected).toBe(childService);
  });
  it("Deberia usar el valor por defecto cuando no hay inyección", () => {
    const fallback = {
      name: "fallback",
    };

    let injected;

    const App = {
      setup() {
        injected = inject("missing", fallback);

        return {};
      },
    };

    const instance = createComponentInstance(App);

    setupComponent(instance);

    expect(injected).toBe(fallback);
  });
  it("inject recupera un valor proporcionado por el componente padre", () => {
    const key = Symbol("theme");

    let injected: string | undefined;

    @Component()
    class Parent {
      setup() {
        provide(key, "dark");
      }
    }

    @Component()
    class Child {
      setup() {
        injected = inject(key);
      }
    }

    const parent = createComponentInstance(Parent, {});
    setupComponent(parent);

    const child = createComponentInstance(Child, {});
    child.parent = parent;

    setupComponent(child);

    expect(injected).toBe("dark");
  });
  it("inject utiliza el valor por defecto cuando no existe el token", () => {
    const key = Symbol("missing");

    let injected: string | undefined;

    @Component()
    class App {
      setup() {
        injected = inject(key, "fallback");
      }
    }

    const instance = createComponentInstance(App, {});
    setupComponent(instance);

    expect(injected).toBe("fallback");
  });
  it("inject utiliza el valor por defecto cuando no existe el token", () => {
    const key = Symbol("missing");

    let injected: string | undefined;

    @Component()
    class App {
      setup() {
        injected = inject(key, "fallback");
      }
    }

    const instance = createComponentInstance(App, {});
    setupComponent(instance);

    expect(injected).toBe("fallback");
  });
});
