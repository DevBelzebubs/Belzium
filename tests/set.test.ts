import { describe, it, expect } from "vitest";
import { reactive } from "../src/reactive/reactive";
import { effect } from "../src/reactive/effect";

describe("set", () => {

it("Debe reaccionar a set.has", () => {
    const state = reactive(
        new Set<number>()
    );

    let exists = false;

    effect(() => {
        exists = state.has(10);
    });

    expect(exists).toBe(false);
    state.add(10);
    expect(exists).toBe(true);
});
it("Debe reaccionar cuando un valor set es añadido", () => {
    const state = reactive(
        new Set<number>()
    );
    let exists = false;
    effect(() => {
        exists = state.has(10);
    });
    expect(exists).toBe(false);
    state.add(10);
    expect(exists).toBe(true);
});
it("No deberia de disparar 2 veces", () => {
    const state = reactive(
        new Set<number>([10])
    );
    let runs = 0;
    effect(() => {
        state.has(10);
        runs++;
    });
    expect(runs).toBe(1);

    state.add(10);

    expect(runs).toBe(1);
});
it("Deberia reaccionar cuando un valor set es eliminado", () => {
    const state = reactive(
        new Set<number>([10])
    );

    let exists = false;

    effect(() => {
        exists = state.has(10);
    });

    expect(exists).toBe(true);

    state.delete(10);

    expect(exists).toBe(false);
});
it("Deberia reaccionar a set.size", () => {
    const state = reactive(
        new Set<number>()
    );

    let size = 0;

    effect(() => {
        size = state.size;
    });

    expect(size).toBe(0);

    state.add(10);

    expect(size).toBe(1);

    state.add(20);
    expect(size).toBe(2);
    state.delete(10);
    expect(size).toBe(1);
});
it("Deberia reaccionar a la iteración de la una variable set", () => {
    const state = reactive(
        new Set<number>([1])
    );

    let values: number[] = [];

    effect(() => {
        values = [...state.values()];
    });

    expect(values).toEqual([1]);
    state.add(2);
    expect(values).toEqual([1, 2]);
});
it("Deberia reaccionar a la iteración del set key", () => {
    const state = reactive(
        new Set<number>([1])
    );

    let values: number[] = [];

    effect(() => {
        values = [...state.keys()];
    });

    expect(values).toEqual([1]);
    state.add(2);
    expect(values).toEqual([1, 2]);
});

});
