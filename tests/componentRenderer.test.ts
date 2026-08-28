// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { Component, ref, UI, onMounted, isComponent } from "../src";
import type { Ref } from "../src";
import type { Slots } from "../src/component/slots";
import { ComponentRenderer } from "../src/runtime/componentRenderer";
import { h, text, createTextVNode } from "../src/runtime/vnode";
import { ApplicationContext } from "../src/di/applicationContext";
import { ComponentScope } from "../src/component/componentScope";
import { patch } from "../src/runtime/vnodeRenderer";

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

    renderer.mount(Counter, instance, element).dispose();

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

    const mounted = renderer.mount(Counter, instance, element);

    expect(element.innerHTML).toContain("0");

    instance.count.value = 10;

    expect(element.innerHTML).toContain("10");

    mounted.dispose();
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

    const mounted = renderer.mount(Counter, instance, container);

    const originalElement = container.firstElementChild;

    instance.count.value = 1;

    expect(container.firstElementChild).toBe(originalElement);

    expect(container.textContent).toBe("1");

    mounted.dispose();
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

    const mounted = renderer.mount(Counter, instance, container);

    const originalElement = container.firstElementChild;

    instance.count.value = 1;

    expect(container.firstElementChild).toBe(originalElement);

    mounted.dispose();
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
  it("ejecuta el lifecycle del componente", () => {
    document.body.innerHTML = `<div id="app"></div>`;

    const container = document.querySelector("#app")!;

    const lifecycle: string[] = [];

    @Component()
    class Counter {
      count = ref(0);

      render() {
        lifecycle.push("render");

        return h("div", null, [text(String(this.count.value))]);
      }
    }

    const context = new ApplicationContext();

    context.registerProvider({
      token: Counter,
      useClass: Counter,
    });

    const instance = context.resolve(Counter);

    const scope = new ComponentScope();

    scope.onMount(() => {
      lifecycle.push("mount");
    });

    scope.onUpdate(() => {
      lifecycle.push("update");
    });

    const renderer = new ComponentRenderer(context);

    const mounted = renderer.mount(Counter, instance, container);

    // El renderer utiliza su propio
    // ComponentScope.
    expect(mounted.scope).toBeDefined();

    mounted.dispose();
  });
  it("renders a UI component", () => {
  @UI()
  class Button {
    render() {
      return h("button", null, [
        createTextVNode("Click"),
      ]);
    }
  }

  const context = new ApplicationContext();

  context.register(Button, new Button());

  const container = document.createElement("div");

  patch(
    null,
    h(Button),
    container,
    0,
    context,
  );

  expect(container.textContent).toBe("Click");
});
it("supports props in a UI component", () => {
  @UI()
  class Button {
    props!: Readonly<{ label?: string }>;

    render() {
      return h("button", null, [
        createTextVNode(
          String(this.props.label),
        ),
      ]);
    }
  }

  const context = new ApplicationContext();

  context.register(Button, new Button());

  const container = document.createElement("div");

  patch(
    null,
    h(Button, {
      label: "Save",
    }),
    container,
    0,
    context,
  );

  expect(container.textContent).toBe("Save");
});
it("updates when reactive state changes", () => {
  const counter = ref(0);

  @UI()
  class Counter {
    render() {
      return h("span", null, [
        createTextVNode(
          String(counter.value),
        ),
      ]);
    }
  }

  const context = new ApplicationContext();

  context.register(
    Counter,
    new Counter(),
  );

  const container = document.createElement("div");

  patch(
    null,
    h(Counter),
    container,
    0,
    context,
  );

  expect(container.textContent).toBe("0");

  counter.value++;

  expect(container.textContent).toBe("1");
});
it("supports setup in a UI component", () => {
  @UI()
  class Counter {
    count!: Ref<number>;

    setup() {
      const count = ref(5);

      return {
        count,
      };
    }

    render() {
      return h("span", null, [
        createTextVNode(
          String(this.count.value),
        ),
      ]);
    }
  }

  const context = new ApplicationContext();

  context.register(
    Counter,
    new Counter(),
  );

  const container = document.createElement("div");

  patch(
    null,
    h(Counter),
    container,
    0,
    context,
  );

  expect(container.textContent).toBe("5");
});
it("supports lifecycle hooks", () => {
  let mounted = false;

  @UI()
  class TestComponent {
    setup() {
      onMounted(() => {
        mounted = true;
      });
    }

    render() {
      return h("div");
    }
  }

  const context = new ApplicationContext();

  context.register(
    TestComponent,
    new TestComponent(),
  );

  const container = document.createElement("div");

  patch(
    null,
    h(TestComponent),
    container,
    0,
    context,
  );

  expect(mounted).toBe(true);
});
it("uses the same runtime as Component", () => {
  @UI()
  class Button {
    render() {
      return h("button");
    }
  }

  expect(
    isComponent(Button),
  ).toBe(true);
});
it("applies UI variants", () => {
  @UI({
    variants: {
      primary: {
        class: "primary"
      }
    }
  })
  class Button {
    variant!: Record<string, unknown>;

    render() {
      return h(
        "button",
        {
          class: this.variant.class
        },
        []
      );
    }
  }

  const context = new ApplicationContext();

  context.register(Button, new Button());

  const container = document.createElement("div");

  patch(
    null,
    h(Button, {
      variant: "primary"
    }),
    container,
    0,
    context
  );

  expect(
    (container.firstChild as Element)?.attributes.getNamedItem("class")?.value
  ).toBe("primary");
});
it("renders named slots", () => {
  @UI()
  class Card {
    slots!: Slots;

    render() {
      return h("div", {}, [
        h(
          "header",
          {},
          this.slots.header?.() ?? []
        ),

        h(
          "main",
          {},
          this.slots.default?.() ?? []
        )
      ]);
    }
  }

  const context = new ApplicationContext();

  context.register(Card, new Card());

  const container = document.createElement("div");

  patch(
    null,
    h(Card, {
      slots: {
        header: () => [
          createTextVNode("Header")
        ],

        default: () => [
          createTextVNode("Body")
        ]
      }
    }),
    container,
    0,
    context
  );

  expect(container.textContent).toBe(
    "HeaderBody"
  );
});
});
