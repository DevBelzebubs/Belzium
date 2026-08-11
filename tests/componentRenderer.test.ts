// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { Component, ref } from "../src";
import { ComponentRenderer } from "../src/runtime/componentRenderer";
import { h, text } from "../src/runtime/vnode";
import { ApplicationContext } from "../src/di/applicationContext";

describe("ComponentRenderer", () => {
  it("Deberia renderizar un componente", () => {
    @Component({
      selector: "counter",
    })
    class Counter {
      count = ref(0);
      render() {
        return h("button", null, [text(String(this.count.value))]);
      }
    }

    const instance = new Counter();

    const element = document.createElement("div");
    const renderer = new ComponentRenderer();

    renderer.mount(Counter, instance, element);

    expect(element.innerHTML).toContain("0");
  });

  it("Deberia actualizar el dom cuando el estado cambia", () => {
    @Component({
      selector: "counter",
    })
    class Counter {
      count = ref(0);

      render() {
        return h("span", null, [text(String(this.count.value))]);
      }
    }

    const instance = new Counter();

    const element = document.createElement("div");

    const renderer = new ComponentRenderer();

    renderer.mount(Counter, instance, element);

    expect(element.innerHTML).toContain("0");

    instance.count.value = 10;

    expect(element.innerHTML).toContain("10");
  });

  it("Deberia parar de reaccionar despues de destruirse", () => {
    @Component({
      selector: "counter",
    })
    class Counter {
      count = ref(0);

      render() {
        return text(String(this.count.value));
      }
    }

    const instance = new Counter();

    const element = document.createElement("div");

    const renderer = new ComponentRenderer();

    const mounted = renderer.mount(Counter, instance, element);

    expect(element.innerHTML).toBe("0");

    mounted.dispose();

    instance.count.value = 10;

    expect(element.innerHTML).toBe("0");
  });

  it("Deberia actualizar el DOM con Pulses y VNodes", () => {
    @Component({
      selector: "counter",
    })
    class Counter {
      count = ref(0);

      render() {
        return h("span", null, [text(String(this.count.value))]);
      }
    }

    const instance = new Counter();

    const element = document.createElement("div");

    const renderer = new ComponentRenderer();

    const mounted = renderer.mount(Counter, instance, element);

    // Render inicial
    expect(element.textContent).toBe("0");

    // Modificación reactiva
    instance.count.value = 10;

    // El Pulse dispara el render nuevamente
    // y el renderer actualiza solamente el nodo necesario
    expect(element.textContent).toBe("10");

    mounted.dispose();
  });

  it("Debe preservar el DOM actual durate las actualizaciones reactivas", () => {
    @Component({
      selector: "counter",
    })
    class Counter {
      count = ref(0);

      render() {
        return h(
          "div",
          {
            class: "counter",
          },
          [text(String(this.count.value))],
        );
      }
    }

    const instance = new Counter();

    const container = document.createElement("section");

    const renderer = new ComponentRenderer();

    renderer.mount(Counter, instance, container);

    const originalElement = container.firstElementChild;

    instance.count.value = 1;

    expect(container.firstElementChild).toBe(originalElement);

    expect(container.textContent).toBe("1");
  });
  it("should update a component through its own Pulse effect", () => {
    @Component({
      selector: "counter",
    })
    class Counter {
      count = ref(0);

      render() {
        return h("span", null, [text(String(this.count.value))]);
      }
    }

    const context = new ApplicationContext();

    context.registerProvider({
      token: Counter,
      useClass: Counter,
    });

    const instance = context.resolve(Counter);

    const container = document.createElement("div");

    const renderer = new ComponentRenderer(context);

    const mounted = renderer.mount(Counter, instance, container);

    expect(container.textContent).toBe("0");

    instance.count.value = 42;

    expect(container.textContent).toBe("42");

    mounted.dispose();
  });
  it("should preserve the component root DOM node during updates", () => {
    @Component({
      selector: "counter",
    })
    class Counter {
      count = ref(0);

      render() {
        return h(
          "div",
          {
            class: "counter",
          },
          [text(String(this.count.value))],
        );
      }
    }

    const context = new ApplicationContext();

    context.registerProvider({
      token: Counter,
      useClass: Counter,
    });

    const instance = context.resolve(Counter);

    const container = document.createElement("section");

    const renderer = new ComponentRenderer(context);

    renderer.mount(Counter, instance, container);

    const originalElement = container.firstElementChild;

    instance.count.value = 1;

    expect(container.firstElementChild).toBe(originalElement);
  });
  it("detiene la reactividad del componente al hacer dispose", () => {
    document.body.innerHTML = `<div id="app"></div>`;

    const container = document.querySelector("#app")!;

    let renderCount = 0;

    @Component()
    class Counter {
      count = ref(0);

      render() {
        renderCount++;

        return h("div", null, [text(String(this.count.value))]);
      }
    }

    const context = new ApplicationContext();

    context.registerProvider({
      token: Counter,
      useClass: Counter,
    });

    const instance = context.resolve(Counter);

    const renderer = new ComponentRenderer(context);

    const mounted = renderer.mount(Counter, instance, container);

    // Render inicial.
    expect(renderCount).toBe(1);

    // La modificación reactiva
    // debe provocar otro render.
    instance.count.value = 1;

    expect(renderCount).toBe(2);

    expect(container.textContent).toBe("1");

    // Desmontamos el componente.
    mounted.dispose();

    const rendersAfterDispose = renderCount;

    // Cambiar el estado después
    // de dispose NO debe renderizar.
    instance.count.value = 2;

    expect(renderCount).toBe(rendersAfterDispose);
  });
});
