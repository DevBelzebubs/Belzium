// @vitest-environment jsdom

import { expect, it } from "vitest";
import { createElement, patch } from "../src/runtime/vnodeRenderer";
import { h, text } from "../src/runtime/vnode";
import { Component, ref } from "../src";
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
