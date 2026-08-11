// @vitest-environment jsdom

import {
    describe,
    it,
    expect
} from "vitest";
import { Component } from "../src";
import { Renderer } from "../src/runtime/renderer";


describe("Renderer", () => {

    it("Deberia montar un componente", () => {

        @Component({
            selector: "user-card"
        })
        class UserCard {}


        const element =
            document.createElement(
                "div"
            );


        const instance =
            new UserCard();


        const renderer =
            new Renderer();


        const mounted =
            renderer.mount(
                UserCard,
                element,
                instance
            );


        expect(
            mounted.instance
        ).toBe(instance);


        expect(
            mounted.element
        ).toBe(element);


        expect(
            mounted.metadata.selector
        ).toBe(
            "user-card"
        );
    });
});