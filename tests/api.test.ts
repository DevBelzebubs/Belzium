import {
    describe,
    expect,
    it,
} from "vitest";
import { Component, reactive, ref, isRef } from "../src";
import { Service } from "../src/di/decorators";
import { h, text } from "../src/runtime/vnode";


describe("Belzium public API", () => {

    it("expone los decoradores principales", () => {

        expect(Component)
            .toBeDefined();

        expect(Service)
            .toBeDefined();
    });


    it("expone Pulses", () => {

        expect(reactive)
            .toBeDefined();

        expect(ref)
            .toBeDefined();

        expect(isRef)
            .toBeDefined();
    });


    it("expone la API de VNodes", () => {

        expect(h)
            .toBeDefined();

        expect(text)
            .toBeDefined();
    });


    it("ref crea un valor reactivo", () => {

        const count =
            ref(0);

        expect(count.value)
            .toBe(0);


        count.value++;


        expect(count.value)
            .toBe(1);
    });


    it("h crea un VNode", () => {

        const vnode =
            h(
                "div",
                null,
                [
                    text("Hello"),
                ]
            );


        expect(vnode.type)
            .toBe("div");

        expect(vnode.children)
            .toHaveLength(1);
    });

});