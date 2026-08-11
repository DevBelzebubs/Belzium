import { describe, it, expect } from "vitest";
import { ref, type Ref } from "../src/reactive/ref";
import { Component, createComponentInstance, getCurrentInstance, setupComponent } from "../src/component/component";
import { getComponentMetadata } from "../src/component/metadata";

describe("component", () => {

it("Deberia de crear la instancia de un componente", () => {
    const App = {};

    const instance =
        createComponentInstance(App);

    expect(instance.type)
        .toBe(App);

    expect(instance.props)
        .toEqual({});

    expect(instance.setupState)
        .toEqual({});
});
it("Deberia ejecutarse el setup de un componente", () => {
    const App = {
        setup() {
            return {
                message: "Hello"
            };
        }
    };
    const instance = createComponentInstance(App);
    setupComponent(instance);
    expect(instance.setupState.message).toBe("Hello");
});
it("Debe emitir eventos de componentes", () => {
    let received = 0;

    const Child = {};

    const instance =
        createComponentInstance(
            Child,
            {
                onChange: (
                    value: number
                ) => {
                    received = value;
                }
            }
        );

    instance.emit(
        "change",
        42
    );

    expect(received)
        .toBe(42);
});
it("Deberia de proveer emits a través del context del setup", () => {
    let received = 0;
    const Child = {
        setup(props: Record<string, unknown>, { emit }: { emit: (event: string, ...args: unknown[]) => void }) {
            emit(
                "change",
                100
            );
            return {};
        }
    };
    const instance =
        createComponentInstance(
            Child,
            {
                onChange: (
                    value: number
                ) => {
                    received = value;
                }
            }
        );
    setupComponent(instance);
    expect(received)
        .toBe(100);
});
it("Deberia exponerse la instancia actual del componente", () => {
    let current = null;

    const App = {
        setup() {
            current =
                getCurrentInstance();

            return {};
        }
    };

    const instance =
        createComponentInstance(App);

    setupComponent(instance);

    expect(current)
        .toBe(instance);
});
it("Deberia limpiar la instancia actual después del setup", () => {
    const App = {
        setup() {
            return {};
        }
    };
    const instance =createComponentInstance(App);
    setupComponent(instance);

    expect(getCurrentInstance()).toBe(null);
});
it("Deberia de exponer el estado de un setup a través de un proxy de un componente", () => {
    const App = {
        setup() {
            return {
                count: 10
            };
        }
    };

    const instance =
        createComponentInstance(App);

    setupComponent(instance);

    expect(
        instance.proxy.count
    ).toBe(10);
});
it("Deberia de exponerse los props a través del proxy del componente", () => {
    const App = {};
    const instance =
        createComponentInstance(
            App,
            {
                title: "Hello"
            }
        );

    expect(
        instance.proxy.title
    ).toBe("Hello");
});
it("Deberia priorizar el estado del setup por encima de los props", () => {
    const App = {
        setup() {
            return {
                title: "setup"
            };
        }
    };

    const instance =
        createComponentInstance(
            App,
            {
                title: "props"
            }
        );

    setupComponent(instance);

    expect(
        instance.proxy.title
    ).toBe("setup");
});
it("Deberia desempaquetar refs del proxy del componente", () => {
    const App = {
        setup() {
            return {
                count: ref(10)
            };
        }
    };

    const instance =
        createComponentInstance(App);

    setupComponent(instance);

    expect(
        instance.proxy.count
    ).toBe(10);
});
it("Deberia actualizar ref a través del proxy del componente", () => {
    const App = {
        setup() {
            return {
                count: ref(10)
            };
        }
    };

    const instance =
        createComponentInstance(App);

    setupComponent(instance);

    instance.proxy.count = 20;

    expect(
        (instance.setupState.count as Ref<number>).value
    ).toBe(20);

    expect(
        instance.proxy.count
    ).toBe(20);
});
it("No deberia de desempaquetar valores normales", () => {
    const App = {
        setup() {
            return {
                count: 10
            };
        }
    };

    const instance =
        createComponentInstance(App);

    setupComponent(instance);

    expect(
        instance.proxy.count
    ).toBe(10);
});
it("Deberia registrar metadata el componente", () => {
        @Component({
            selector: "user-card"
        })
        class UserCard {}


        const metadata =
            getComponentMetadata(
                UserCard
            );


        expect(metadata)
            .toBeDefined();
        expect(metadata?.selector)
            .toBe("user-card");


        expect(metadata?.type)
            .toBe(UserCard);
    });
});
