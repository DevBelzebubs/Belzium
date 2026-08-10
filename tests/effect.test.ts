import { describe, it, expect } from "vitest";
import { reactive } from "../src/reactive/reactive";
import { effect } from "../src/reactive/effect";

describe("effect", () => {

it("Deberia de no trigger cuando el valor no cambia", () => {
    const state = reactive({
        count: 0
    });
    let runs = 0;
    effect(() => {
        state.count;
        runs++;
    });
    expect(runs).toBe(1);
    state.count = 1;
    expect(runs).toBe(2);
    state.count = 1;
    expect(runs).toBe(2);
});
it("Deberia de reaccionar a cambios en multiples propiedades", () => {
    const state = reactive({
        count: 0,
        name: "Juan"
    });
    let dummy = "";
    effect(() => {
        dummy = `${state.name}: ${state.count}`;
    });
    expect(dummy).toBe("Juan: 0");
    state.count = 1;
    expect(dummy).toBe("Juan: 1");
    state.name = "Pedro";
    expect(dummy).toBe("Pedro: 1");
});
it("Deberia de manejar efectos anidados", () => {
    const state = reactive({
        outer: 0,
        inner: 0
    });
    let outerRuns = 0;
    let innerRuns = 0;
    effect(() => {
        state.outer;
        outerRuns++;

        effect(() => {
            state.inner;
            innerRuns++;
        });

        state.outer;
    });
    expect(outerRuns).toBe(1);
    expect(innerRuns).toBe(1);
});
it("Deberia de restaurar el efecto padre después del efecto anidado", () => {
    const state = reactive({
        outer: 0,
        inner: 0
    });
    let outerValue = 0;

    effect(() => {
        state.outer;

        effect(() => {
            state.inner;
        });

        outerValue = state.outer;
    });
    state.outer = 1;
    expect(outerValue).toBe(1);
});
it("Deberia de limpiar dependencias obsoletas", () => {
    const state = reactive({
        condition: true,
        a: 10,
        b: 20
    });

    let dummy = 0;
    effect(() => {
        if (state.condition) {
            dummy = state.a;
        } else {
            dummy = state.b;
        }
    });

    expect(dummy).toBe(10);
    state.condition = false;
    expect(dummy).toBe(20);
    state.a = 100;
    expect(dummy).toBe(20);
});
it("Deberia de prevenir la ejecución recursiva del efecto", () => {
    const state = reactive({
        count: 0
    });
    let runs = 0;

    effect(() => {
        runs++;

        if (state.count < 1) {
            state.count++;
        }
    });
    expect(state.count).toBe(1);
    expect(runs).toBe(1);
});
it("Deberia parar un efecto", () => {
    const state = reactive({
        count: 0
    });

    let dummy = 0;

    const runner = effect(() => {
        dummy = state.count;
    });

    expect(dummy).toBe(0);

    state.count = 1;

    expect(dummy).toBe(1);

    runner.stop();

    state.count = 2;

    expect(dummy).toBe(1);
});
it("Deberia remover los efectos de cada dependencia", () => {
    const state = reactive({
        a: 1,
        b: 2
    });

    let dummy = 0;

    const runner = effect(() => {
        dummy = state.a + state.b;
    });

    expect(dummy).toBe(3);

    runner.stop();

    state.a = 10;
    state.b = 20;

    expect(dummy).toBe(3);
});

});
