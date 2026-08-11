// @vitest-environment jsdom

import {
    describe,
    it,
    expect
} from "vitest";
import { Component, ref } from "../src";
import { ComponentRenderer } from "../src/runtime/componentRenderer";


describe("ComponentRenderer", () => {

    it("Deberia renderizar un componente", () => {

        @Component({
            selector: "counter"
        })
        class Counter {

            count =
                ref(0);
            render() {
                return `
                    <button>
                        ${this.count.value}
                    </button>
                `;
            }
        }


        const instance =
            new Counter();


        const element =
            document.createElement(
                "div"
            );
        const renderer =
            new ComponentRenderer();

        renderer.mount(
            Counter,
            instance,
            element
        );


        expect(
            element.innerHTML
        ).toContain("0");
    });
    it("Deberia actualizar el dom cuando el estado cambia", () => {

    @Component({
        selector: "counter"
    })
    class Counter {

        count =
            ref(0);


        render() {

            return `
                <span>
                    ${this.count.value}
                </span>
            `;
        }
    }


    const instance =
        new Counter();


    const element =
        document.createElement(
            "div"
        );


    const renderer =
        new ComponentRenderer();


    renderer.mount(
        Counter,
        instance,
        element
    );


    expect(
        element.innerHTML
    ).toContain("0");


    instance.count.value = 10;


    expect(
        element.innerHTML
    ).toContain("10");
});
it("Deberia parar de reaccionar despues de destruirse", () => {

    @Component({
        selector: "counter"
    })
    class Counter {

        count =
            ref(0);


        render() {

            return `${this.count.value}`;
        }
    }


    const instance =
        new Counter();


    const element =
        document.createElement(
            "div"
        );


    const renderer =
        new ComponentRenderer();


    const mounted =
        renderer.mount(
            Counter,
            instance,
            element
        );


    expect(
        element.innerHTML
    ).toBe("0");


    mounted.dispose();


    instance.count.value = 10;


    expect(
        element.innerHTML
    ).toBe("0");
});
});