// @vitest-environment jsdom

import { expect, it } from "vitest";
import { patch } from "../src/runtime/vnodeRenderer";
import { h, text } from "../src/runtime/vnode";

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
