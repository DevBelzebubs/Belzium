// @vitest-environment jsdom

import {
    describe,
    it,
    expect
} from "vitest";
import { h, text } from "../src/runtime/vnode";
import { createElement, patch } from "../src/runtime/vnodeRenderer";


describe("VNode renderer", () => {

    it("Deberia crear un elemento", () => {

        const vnode =
            h(
                "div",
                {
                    id: "app"
                },
                [
                    text("Hello")
                ]
            );


        const element =
            createElement(vnode) as Element;


        expect(
            element.nodeName
        ).toBe("DIV");


        expect(
            element.getAttribute("id")
        ).toBe("app");


        expect(
            element.textContent
        ).toBe("Hello");
    });
    it("Deberia bindear eventos", () => {

        let clicked = false;


        const vnode =
            h(
                "button",
                {
                    onClick: () => {
                        clicked = true;
                    }
                },
                [
                    text("Click")
                ]
            );


        const button =
            createElement(vnode) as HTMLButtonElement;


        button.click();


        expect(clicked)
            .toBe(true);
    });
    it("Deberia de actualizar el texto sin reemplazar el elemento", () => {

    const oldVNode =
        h(
            "div",
            null,
            [
                text("Hello")
            ]
        );


    const newVNode =
        h(
            "div",
            null,
            [
                text("World")
            ]
        );


    const container =
        document.createElement("div");


    patch(
        null,
        oldVNode,
        container
    );


    const originalElement =
        container.firstChild;


    patch(
        oldVNode,
        newVNode,
        container
    );


    expect(
        container.textContent
    ).toBe("World");


    expect(
        container.firstChild
    ).toBe(originalElement);
});
it("Deberia actualizar props", () => {

    const oldVNode =
        h(
            "div",
            {
                id: "old"
            }
        );


    const newVNode =
        h(
            "div",
            {
                id: "new",
                title: "Belzium"
            }
        );


    const container =
        document.createElement("div");


    patch(
        null,
        oldVNode,
        container
    );


    patch(
        oldVNode,
        newVNode,
        container
    );


    const element =
        container.firstElementChild!;


    expect(
        element.getAttribute("id")
    ).toBe("new");


    expect(
        element.getAttribute("title")
    ).toBe("Belzium");
});
it("Deberia quitar el hijo antiguo", () => {

    const oldVNode =
        h(
            "div",
            null,
            [
                text("A"),
                text("B")
            ]
        );


    const newVNode =
        h(
            "div",
            null,
            [
                text("A")
            ]
        );


    const container =
        document.createElement("div");


    patch(
        null,
        oldVNode,
        container
    );


    patch(
        oldVNode,
        newVNode,
        container
    );


    expect(
        container.textContent
    ).toBe("A");


    expect(
        container.firstElementChild
            ?.childNodes.length
    ).toBe(1);
});
});
