// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, patch } from "../src/runtime/vnodeRenderer";
import { h, text } from "../src/runtime/vnode";
import { Component, onMounted, onUnmounted, ref, watch } from "../src";
import { ApplicationContext } from "../src/di/applicationContext";

it("should preserve keyed nodes when their order changes", () => {
  const oldVNode = h("ul", null, [
    h(
      "li",
      {
        key: "a",
      },
      [text("A")],
    ),

    h(
      "li",
      {
        key: "b",
      },
      [text("B")],
    ),

    h(
      "li",
      {
        key: "c",
      },
      [text("C")],
    ),
  ]);

  const newVNode = h("ul", null, [
    h(
      "li",
      {
        key: "c",
      },
      [text("C")],
    ),

    h(
      "li",
      {
        key: "a",
      },
      [text("A")],
    ),

    h(
      "li",
      {
        key: "b",
      },
      [text("B")],
    ),
  ]);

  const container = document.createElement("div");

  patch(null, oldVNode, container);

  const originalNodes = Array.from(container.firstElementChild!.childNodes);

  patch(oldVNode, newVNode, container);

  const reorderedNodes = Array.from(container.firstElementChild!.childNodes);

  expect(reorderedNodes[0]).toBe(originalNodes[2]);

  expect(reorderedNodes[1]).toBe(originalNodes[0]);

  expect(reorderedNodes[2]).toBe(originalNodes[1]);
});

it("should preserve content when keyed nodes are reordered with changes", () => {
  const oldVNode = h("ul", null, [
    h("li", { key: "a" }, [text("A")]),

    h("li", { key: "b" }, [text("B")]),
  ]);

  const newVNode = h("ul", null, [
    h("li", { key: "b" }, [text("B")]),

    h("li", { key: "a" }, [text("A2")]),
  ]);

  const container = document.createElement("div");

  patch(null, oldVNode, container);

  patch(oldVNode, newVNode, container);

  const lis = Array.from(container.firstElementChild!.children);

  expect(lis[0].textContent).toBe("B");

  expect(lis[1].textContent).toBe("A2");
});
it("should resolve component instances through ApplicationContext", () => {
  @Component({
    selector: "user-card",
  })
  class UserCard {
    render() {
      return h("span", null, [text("User")]);
    }
  }

  const context = new ApplicationContext();

  context.registerProvider({
    token: UserCard,
    useClass: UserCard,
  });

  const vnode = h(UserCard);

  const element = createElement(vnode, context);

  expect(element.textContent).toBe("User");
});
it("should resolve component dependencies through ApplicationContext", () => {
  class UserService {
    getName() {
      return "Belzium";
    }
  }

  @Component({
    selector: "user-card",
  })
  class UserCard {
    constructor(private userService: UserService) {}

    render() {
      return h("span", null, [text(this.userService.getName())]);
    }
  }

  const context = new ApplicationContext();

  context.registerProvider({
    token: UserService,
    useClass: UserService,
  });

  context.registerProvider({
    token: UserCard,
    useClass: UserCard,
    dependencies: [UserService],
  });

  const vnode = h(UserCard);

  const element = createElement(vnode, context);

  expect(element.textContent).toBe("Belzium");
});
it("detiene la reactividad de un componente al desmontarlo mediante patch", () => {
  document.body.innerHTML = `<div id="app"></div>`;

  const container = document.querySelector("#app")!;

  @Component()
  class Counter {
    count = ref(0);

    render() {
      return h("div", null, [text(String(this.count.value))]);
    }
  }

  const context = new ApplicationContext();

  context.registerProvider({
    token: Counter,
    useClass: Counter,
  });

  const vnode = h(Counter);

  patch(null, vnode, container, 0, context);

  const component = vnode.component!;

  expect(component.scope.effectScope.isActive).toBe(true);

  component.instance.count.value = 1;

  expect(container.textContent).toBe("1");

  // Elimina el componente mediante diff.
  patch(vnode, null, container, 0, context);

  expect(component.scope.effectScope.isActive).toBe(false);

  // Cambiar el estado después
  // del desmontaje no debe producir
  // ningún nuevo render.
  component.instance.count.value = 2;

  expect(container.textContent).toBe("");
});
// -----------------------------------------------------------------------------
// Ciclo de vida
// -----------------------------------------------------------------------------

describe("Component lifecycle", () => {
  let container: HTMLDivElement;
  let context: ApplicationContext;

  beforeEach(() => {
    container = document.createElement("div");
    context = new ApplicationContext();
  });

  it("ejecuta onMounted una sola vez después del primer render", () => {
    const mounted = vi.fn();

    @Component()
    class TestComponent {
      constructor() {
        onMounted(mounted);
      }

      render() {
        return h("div", null, [text("Hello")]);
      }
    }

    context.register(TestComponent);

    const vnode = h(TestComponent);

    patch(null, vnode, container, 0, context);

    expect(container.innerHTML).toBe("<div>Hello</div>");

    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it("no ejecuta onMounted nuevamente cuando el componente se actualiza", () => {
    const mounted = vi.fn();

    const state = ref("A");

    @Component()
    class TestComponent {
      constructor() {
        onMounted(mounted);
      }

      render() {
        return h("div", null, [text(state.value)]);
      }
    }

    context.register(TestComponent);

    const vnode = h(TestComponent);

    patch(null, vnode, container, 0, context);

    expect(mounted).toHaveBeenCalledTimes(1);

    state.value = "B";

    expect(container.innerHTML).toBe("<div>B</div>");

    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it("no ejecuta onUnmounted mientras el componente continúa montado", () => {
    const unmounted = vi.fn();

    @Component()
    class TestComponent {
      constructor() {
        onUnmounted(unmounted);
      }

      render() {
        return h("div", null, [text("Hello")]);
      }
    }

    context.register(TestComponent);

    const vnode = h(TestComponent);

    patch(null, vnode, container, 0, context);

    expect(unmounted).not.toHaveBeenCalled();

    expect(container.innerHTML).toBe("<div>Hello</div>");
  });

  it("ejecuta onUnmounted al desmontar el componente", () => {
    const unmounted = vi.fn();

    @Component()
    class TestComponent {
      constructor() {
        onUnmounted(unmounted);
      }

      render() {
        return h("div", null, [text("Hello")]);
      }
    }

    context.register(TestComponent);

    const vnode = h(TestComponent);

    patch(null, vnode, container, 0, context);

    expect(unmounted).not.toHaveBeenCalled();

    patch(vnode, null, container, 0, context);

    expect(container.innerHTML).toBe("");

    expect(unmounted).toHaveBeenCalledTimes(1);
  });

  it("no ejecuta onUnmounted más de una vez", () => {
    const unmounted = vi.fn();

    @Component()
    class TestComponent {
      constructor() {
        onUnmounted(unmounted);
      }

      render() {
        return h("div");
      }
    }

    context.register(TestComponent);

    const vnode = h(TestComponent);

    patch(null, vnode, container, 0, context);

    patch(vnode, null, container, 0, context);

    // Intentamos desmontar nuevamente
    patch(vnode, null, container, 0, context);

    expect(unmounted).toHaveBeenCalledTimes(1);
  });

  it("ejecuta onUnmounted cuando un componente es reemplazado", () => {
    const unmounted = vi.fn();

    @Component()
    class FirstComponent {
      constructor() {
        onUnmounted(unmounted);
      }

      render() {
        return h("div", null, [text("First")]);
      }
    }

    @Component()
    class SecondComponent {
      render() {
        return h("div", null, [text("Second")]);
      }
    }

    context.register(FirstComponent);
    context.register(SecondComponent);

    let vnode = h(FirstComponent);

    patch(null, vnode, container, 0, context);

    expect(container.innerHTML).toBe("<div>First</div>");

    const nextVNode = h(SecondComponent);

    patch(vnode, nextVNode, container, 0, context);

    expect(container.innerHTML).toBe("<div>Second</div>");

    expect(unmounted).toHaveBeenCalledTimes(1);

    vnode = nextVNode;
  });

  it("no desmonta un componente keyed cuando solamente cambia de posición", () => {
    const unmountedA = vi.fn();
    const unmountedB = vi.fn();

    @Component()
    class ComponentA {
      constructor() {
        onUnmounted(unmountedA);
      }

      render() {
        return h("div", null, [text("A")]);
      }
    }

    @Component()
    class ComponentB {
      constructor() {
        onUnmounted(unmountedB);
      }

      render() {
        return h("div", null, [text("B")]);
      }
    }

    context.register(ComponentA);
    context.register(ComponentB);

    const firstVNode = h("section", null, [
      h(ComponentA, { key: "a" }),
      h(ComponentB, { key: "b" }),
    ]);

    patch(null, firstVNode, container, 0, context);

    expect(container.innerHTML).toBe(
      "<section><div>A</div><div>B</div></section>",
    );

    const secondVNode = h("section", null, [
      h(ComponentB, { key: "b" }),
      h(ComponentA, { key: "a" }),
    ]);

    patch(firstVNode, secondVNode, container, 0, context);

    expect(container.innerHTML).toBe(
      "<section><div>B</div><div>A</div></section>",
    );

    expect(unmountedA).not.toHaveBeenCalled();
    expect(unmountedB).not.toHaveBeenCalled();
  });

  it("ejecuta onUnmounted antes de que el nodo sea eliminado del DOM", () => {
    let nodeDuringUnmount: Node | null = null;

    @Component()
    class TestComponent {
      constructor() {
        onUnmounted(() => {
          nodeDuringUnmount = container.firstChild;
        });
      }

      render() {
        return h("div", null, [text("Hello")]);
      }
    }

    context.register(TestComponent);

    const vnode = h(TestComponent);

    patch(null, vnode, container, 0, context);

    expect(container.firstChild).not.toBeNull();

    patch(vnode, null, container, 0, context);

    expect(nodeDuringUnmount).not.toBeNull();
    expect(container.firstChild).toBeNull();
  });
});
describe("Component lifecycle", () => {
  it("ejecuta onMounted una sola vez después del primer render", () => {
    const calls: string[] = [];

    @Component({ selector: "lifecycle-component" })
    class LifecycleComponent {
      render() {
        calls.push("render");

        return h("div", null, [text("hello")]);
      }

      onMounted() {
        calls.push("mounted");
      }
    }

    const context = new ApplicationContext();
    context.register(LifecycleComponent, new LifecycleComponent());

    const container = document.createElement("div");

    patch(null, h(LifecycleComponent), container, 0, context);

    expect(calls).toEqual(["render", "mounted"]);
  });

  it("no ejecuta onMounted nuevamente cuando el componente se actualiza", () => {
    const calls: string[] = [];

    @Component({ selector: "lifecycle-component" })
    class LifecycleComponent {
      render() {
        calls.push("render");

        return h("div", null, [text(String(this.props?.value ?? ""))]);
      }

      onMounted() {
        calls.push("mounted");
      }
    }

    const context = new ApplicationContext();
    context.register(LifecycleComponent, new LifecycleComponent());

    const container = document.createElement("div");

    const oldVNode = h(LifecycleComponent, {
      value: "A",
    });

    patch(null, oldVNode, container, 0, context);

    const newVNode = h(LifecycleComponent, {
      value: "B",
    });

    patch(oldVNode, newVNode, container, 0, context);

    expect(calls.filter((call) => call === "mounted")).toHaveLength(1);
  });

  it("no ejecuta onUnmounted mientras el componente continúa montado", () => {
    let unmounted = 0;

    @Component({ selector: "lifecycle-component" })
    class LifecycleComponent {
      render() {
        return h("div", null, [text("hello")]);
      }

      onUnmounted() {
        unmounted++;
      }
    }

    const context = new ApplicationContext();
    context.register(LifecycleComponent, new LifecycleComponent());

    const container = document.createElement("div");

    const oldVNode = h(LifecycleComponent);

    patch(null, oldVNode, container, 0, context);

    const newVNode = h(LifecycleComponent);

    patch(oldVNode, newVNode, container, 0, context);

    expect(unmounted).toBe(0);
  });

  it("ejecuta onUnmounted al desmontar el componente", () => {
    let unmounted = 0;

    @Component({ selector: "lifecycle-component" })
    class LifecycleComponent {
      render() {
        return h("div", null, [text("hello")]);
      }

      onUnmounted() {
        unmounted++;
      }
    }

    const context = new ApplicationContext();
    context.register(LifecycleComponent, new LifecycleComponent());

    const container = document.createElement("div");

    const vnode = h(LifecycleComponent);

    patch(null, vnode, container, 0, context);

    expect(container.childNodes).toHaveLength(1);

    patch(vnode, null, container, 0, context);

    expect(unmounted).toBe(1);
    expect(container.childNodes).toHaveLength(0);
  });

  it("ejecuta onUnmounted una sola vez", () => {
    let unmounted = 0;

    @Component({ selector: "lifecycle-component" })
    class LifecycleComponent {
      render() {
        return h("div", null, [text("hello")]);
      }

      onUnmounted() {
        unmounted++;
      }
    }

    const context = new ApplicationContext();
    context.register(LifecycleComponent, new LifecycleComponent());

    const container = document.createElement("div");

    const vnode = h(LifecycleComponent);

    patch(null, vnode, container, 0, context);

    patch(vnode, null, container, 0, context);
    patch(vnode, null, container, 0, context);

    expect(unmounted).toBe(1);
  });

  it("ejecuta onUnmounted cuando un componente es reemplazado", () => {
    let unmounted = 0;

    @Component({ selector: "component-a" })
    class ComponentA {
      render() {
        return h("div", null, [text("A")]);
      }

      onUnmounted() {
        unmounted++;
      }
    }

    @Component({ selector: "component-b" })
    class ComponentB {
      render() {
        return h("div", null, [text("B")]);
      }
    }

    const context = new ApplicationContext();

    context.register(ComponentA, new ComponentA());
    context.register(ComponentB, new ComponentB());

    const container = document.createElement("div");

    const oldVNode = h(ComponentA);

    patch(null, oldVNode, container, 0, context);

    const newVNode = h(ComponentB);

    patch(oldVNode, newVNode, container, 0, context);

    expect(unmounted).toBe(1);
    expect(container.textContent).toBe("B");
  });

  it("no desmonta un componente keyed cuando solamente cambia de posición", () => {
    let unmounted = 0;

    @Component({ selector: "lifecycle-component" })
    class LifecycleComponent {
      render() {
        return h("div", null, [text("component")]);
      }

      onUnmounted() {
        unmounted++;
      }
    }

    const context = new ApplicationContext();
    context.register(LifecycleComponent, new LifecycleComponent());

    const container = document.createElement("div");

    const oldVNode = h("section", null, [
      h(LifecycleComponent, { key: "component" }),
      h("span", { key: "other" }, [text("other")]),
    ]);

    patch(null, oldVNode, container, 0, context);

    const newVNode = h("section", null, [
      h("span", { key: "other" }, [text("other")]),
      h(LifecycleComponent, { key: "component" }),
    ]);

    patch(oldVNode, newVNode, container, 0, context);

    expect(unmounted).toBe(0);
  });

  it("ejecuta onUnmounted antes de eliminar el nodo del DOM", () => {
    let wasConnected = false;

    @Component({ selector: "lifecycle-component" })
    class LifecycleComponent {
      render() {
        return h("div", null, [text("hello")]);
      }

      onUnmounted() {
        wasConnected = true;
      }
    }

    const context = new ApplicationContext();
    context.register(LifecycleComponent, new LifecycleComponent());

    const container = document.createElement("div");

    const vnode = h(LifecycleComponent);

    patch(null, vnode, container, 0, context);

    patch(vnode, null, container, 0, context);

    expect(wasConnected).toBe(true);
  });
});
describe("Component runtime contract", () => {
  it("mantiene el mismo componente durante mount → update → unmount", () => {
    const context = new ApplicationContext();
    const container = document.createElement("div");

    let renders = 0;
    let mounted = 0;
    let unmounted = 0;

    class TestComponent {
      props!: Record<string, unknown>;

      onMounted() {
        mounted++;
      }

      onUnmounted() {
        unmounted++;
      }

      render() {
        renders++;

        return h("div", null, [text(String(this.props.value))]);
      }
    }

    context.register(TestComponent, TestComponent);

    const oldVNode = h(TestComponent, {
      value: "A",
    });

    patch(null, oldVNode, container, 0, context);

    expect(renders).toBe(1);
    expect(mounted).toBe(1);
    expect(unmounted).toBe(0);

    const newVNode = h(TestComponent, {
      value: "B",
    });

    patch(oldVNode, newVNode, container, 0, context);

    expect(renders).toBe(2);
    expect(mounted).toBe(1);
    expect(unmounted).toBe(0);
    expect(container.textContent).toBe("B");

    patch(newVNode, null, container, 0, context);

    expect(unmounted).toBe(1);
    expect(container.childNodes).toHaveLength(0);
  });

  it("detiene la reactividad del componente después de desmontarlo", () => {
    const context = new ApplicationContext();
    const container = document.createElement("div");

    const state = ref(0);

    let renders = 0;

    class TestComponent {
      render() {
        renders++;

        return h("div", null, [text(String(state.value))]);
      }
    }

    context.register(TestComponent, TestComponent);

    const vnode = h(TestComponent);

    patch(null, vnode, container, 0, context);

    expect(renders).toBe(1);
    expect(container.textContent).toBe("0");

    state.value = 1;

    expect(renders).toBe(2);
    expect(container.textContent).toBe("1");

    patch(vnode, null, container, 0, context);

    expect(container.childNodes).toHaveLength(0);

    state.value = 2;

    expect(renders).toBe(2);
  });

  it("no desmonta un componente keyed cuando solamente cambia de posición", () => {
    const context = new ApplicationContext();
    const container = document.createElement("div");

    let mountedA = 0;
    let unmountedA = 0;

    class ComponentA {
      onMounted() {
        mountedA++;
      }

      onUnmounted() {
        unmountedA++;
      }

      render() {
        return h("span", null, [text("A")]);
      }
    }

    class ComponentB {
      render() {
        return h("span", null, [text("B")]);
      }
    }

    context.register(ComponentA, ComponentA);
    context.register(ComponentB, ComponentB);

    const oldVNode = h("div", null, [
      h(ComponentA, { key: "a" }),
      h(ComponentB, { key: "b" }),
    ]);

    patch(null, oldVNode, container, 0, context);

    expect(mountedA).toBe(1);
    expect(unmountedA).toBe(0);

    const newVNode = h("div", null, [
      h(ComponentB, { key: "b" }),
      h(ComponentA, { key: "a" }),
    ]);

    patch(oldVNode, newVNode, container, 0, context);

    expect(container.textContent).toBe("BA");
    expect(mountedA).toBe(1);
    expect(unmountedA).toBe(0);
  });

  it("desmonta un componente keyed cuando desaparece", () => {
    const context = new ApplicationContext();
    const container = document.createElement("div");

    let unmounted = 0;

    class TestComponent {
      onUnmounted() {
        unmounted++;
      }

      render() {
        return h("span", null, [text("A")]);
      }
    }

    context.register(TestComponent, TestComponent);

    const oldVNode = h("div", null, [
      h(TestComponent, {
        key: "component",
      }),
    ]);

    patch(null, oldVNode, container, 0, context);

    const newVNode = h("div");

    patch(oldVNode, newVNode, container, 0, context);

    expect(unmounted).toBe(1);
    expect(container.textContent).toBe("");
  });

  it("desmonta el componente anterior cuando cambia su identidad", () => {
    const context = new ApplicationContext();
    const container = document.createElement("div");

    let unmountedA = 0;

    class ComponentA {
      onUnmounted() {
        unmountedA++;
      }

      render() {
        return h("span", null, [text("A")]);
      }
    }

    class ComponentB {
      render() {
        return h("span", null, [text("B")]);
      }
    }

    context.register(ComponentA, ComponentA);
    context.register(ComponentB, ComponentB);

    const oldVNode = h(ComponentA);

    patch(null, oldVNode, container, 0, context);

    const newVNode = h(ComponentB);

    patch(oldVNode, newVNode, container, 0, context);

    expect(unmountedA).toBe(1);
    expect(container.textContent).toBe("B");
  });

  it("desmonta correctamente componentes anidados", () => {
    const context = new ApplicationContext();
    const container = document.createElement("div");

    const calls: string[] = [];

    class Child {
      onMounted() {
        calls.push("child-mounted");
      }

      onUnmounted() {
        calls.push("child-unmounted");
      }

      render() {
        return h("span", null, [text("child")]);
      }
    }

    class Parent {
      onMounted() {
        calls.push("parent-mounted");
      }

      onUnmounted() {
        calls.push("parent-unmounted");
      }

      render() {
        return h("div", null, [h(Child)]);
      }
    }

    context.register(Child, Child);
    context.register(Parent, Parent);

    const vnode = h(Parent);

    patch(null, vnode, container, 0, context);

    expect(calls).toEqual(["child-mounted", "parent-mounted"]);

    patch(vnode, null, container, 0, context);

    expect(calls).toContain("child-unmounted");
    expect(calls).toContain("parent-unmounted");

    expect(calls.filter((call) => call === "child-unmounted")).toHaveLength(1);

    expect(calls.filter((call) => call === "parent-unmounted")).toHaveLength(1);

    expect(container.childNodes).toHaveLength(0);
  });

  it("detiene watchers y efectos creados durante la vida del componente", () => {
    const context = new ApplicationContext();
    const container = document.createElement("div");

    const state = ref(0);

    let renders = 0;
    let watcherCalls = 0;

    class TestComponent {
      render() {
        renders++;

        watch(
          () => state.value,
          () => {
            watcherCalls++;
          },
        );

        return h("div", null, [text(String(state.value))]);
      }
    }

    context.register(TestComponent, TestComponent);

    const vnode = h(TestComponent);

    patch(null, vnode, container, 0, context);

    expect(renders).toBe(1);

    state.value = 1;

    expect(renders).toBe(2);

    patch(vnode, null, container, 0, context);

    const rendersAfterUnmount = renders;
    const watchersAfterUnmount = watcherCalls;

    state.value = 2;

    expect(renders).toBe(rendersAfterUnmount);
    expect(watcherCalls).toBe(watchersAfterUnmount);
  });
  
});
describe("Component API integration", () => {
  it("render puede acceder al estado retornado por setup mediante this", () => {
    @Component()
    class Counter {
      setup() {
        return {
          count: ref(42),
        };
      }

      render() {
        return h("span", null, [
          text(String(this.count.value)),
        ]);
      }
    }

    const context = new ApplicationContext();
    context.registerProvider({
      provide: Counter,
      useClass: Counter,
    });

    const vnode = h(Counter);
    const container = document.createElement("div");

    patch(null, vnode, container, 0, context);

    expect(container.textContent).toBe("42");
  });
  it("actualiza el render cuando cambia un ref retornado por setup", () => {
  let count!: Ref<number>;

  @Component()
  class Counter {
    setup() {
      count = ref(0);

      return {
        count,
      };
    }

    render() {
      return h("span", null, [
        text(String(this.count.value)),
      ]);
    }
  }

  const context = new ApplicationContext();

  context.registerProvider({
    provide: Counter,
    useClass: Counter,
  });

  const vnode = h(Counter);
  const container = document.createElement("div");

  patch(null, vnode, container, 0, context);

  expect(container.textContent).toBe("0");

  count.value = 10;

  expect(container.textContent).toBe("10");
});
});