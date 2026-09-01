import { describe, it, expect } from "vitest";
import { reactive } from "../src/reactive/reactive";
import { effect } from "../src/reactive/effect";

describe("array", () => {

it("Deberia de reaccionar al cambio de indice de manera reactiva", () => {
    const state = reactive({
        items: [1, 2, 3]
    });

    let dummy = 0;

    effect(() => {
        dummy = state.items[0];
    });

    expect(dummy).toBe(1);

    state.items[0] = 10;

    expect(dummy).toBe(10);
});
it("Deberia de reaccionar a la longitud del array", () => {
    const state = reactive({
        items: [1, 2, 3]
    });

    let length = 0;

    effect(() => {
        length = state.items.length;
    });

    expect(length).toBe(3);

    state.items.push(4);

    expect(length).toBe(4);
});
it("Deberia de reaccionar a los cambios de índices en arrays", () => {
    const state = reactive({
        items: [1, 2, 3]
    });

    let dummy = 0;

    effect(() => {
        dummy = state.items[0];
    });

    expect(dummy).toBe(1);
    state.items[0] = 10;
    expect(dummy).toBe(10);
});
it("Deberia de reaccionar dinamicamente cuando se añaden índices", () => {
    const state = reactive<number[]>([]);

    let dummy = 0;

    effect(() => {
        dummy = state[0] ?? 0;
    });

    expect(dummy).toBe(0);
    state[0] = 10;
    expect(dummy).toBe(10);
});
it("Deberia reaccionar al length del array", () => {
    const state = reactive([1, 2, 3]);

    let length = 0;

    effect(() => {
        length = state.length;
    });

    expect(length).toBe(3);

    state.push(4);

    expect(length).toBe(4);
});
it("Deberia de ejecutar el trigger de length cuando se añade un index", () => {
    const state = reactive([1, 2, 3]);

    let length = 0;

    effect(() => {
        length = state.length;
    });

    expect(length).toBe(3);

    state[3] = 4;
    expect(length).toBe(4);
});
it("Deberia reaccionar a pop", () => {
    const state = reactive([1, 2, 3]);
    let length = 0;
    effect(() => {
        length = state.length;
    });

    state.pop();

    expect(length).toBe(2);
});
it("Deberia de hacer trigger a los índices afectados por los cambios de length", () => {
    const state = reactive([
        1,
        2,
        3,
        4
    ]);

    let dummy = 0;
    effect(() => {
        dummy = state[3] ?? 0;
    });
    expect(dummy).toBe(4);

    state.length = 2;

    expect(dummy).toBe(0);
});
it("Deberia de hacer trigger a los índices afectados por los cambios de length", () => {
    const state = reactive([
        1,
        2,
        3,
        4
    ]);

    let firstRuns = 0;
    let thirdRuns = 0;

    effect(() => {
        state[0];
        firstRuns++;
    });

    effect(() => {
        state[3];
        thirdRuns++;
    });

    expect(firstRuns).toBe(1);
    expect(thirdRuns).toBe(1);

    state.length = 2;

    expect(firstRuns).toBe(1);
    expect(thirdRuns).toBe(2);
});

it("Deberia de reaccionar a la reduccion de length en iteraciones (Object.keys)", () => {
    const state = reactive([1, 2, 3]);

    let keys = 0;

    effect(() => {
        keys = Object.keys(state).length;
    });

    expect(keys).toBe(3);

    state.length = 1;

    expect(keys).toBe(1);
});

});
