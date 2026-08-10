import { describe, it, expect } from "vitest";
import { reactive } from "../src/reactive/reactive";
import { effect } from "../src/reactive/effect";
import { computed } from "../src/reactive/computed";

describe("computed", () => {

    it("Deberia de evaluar lazy", () => {
        const state = reactive({
            count: 1
        });

        let runs = 0;

        const doubled = computed(() => {
            runs++;

            return state.count * 2;
        });
        expect(runs).toBe(0);
        expect(doubled.value).toBe(2);
        expect(runs).toBe(1);
        expect(doubled.value).toBe(2);
        expect(runs).toBe(1);
    });
    it("Deberia de invalidar cuando las dependencias cambian", () => {
    const state = reactive({
        count: 1
    });

    let runs = 0;

    const doubled = computed(() => {
        runs++;

        return state.count * 2;
    });
    expect(doubled.value).toBe(2);
    expect(runs).toBe(1);

    state.count = 2;
    expect(runs).toBe(1);
    expect(doubled.value).toBe(4);
    expect(runs).toBe(2);
});
it("Deberia de ser reactivo adentro de un effect", () => {
    const state = reactive({
        count: 1
    });

    const doubled = computed(() => state.count * 2);

    let dummy = 0;

    effect(() => {
        dummy = doubled.value;
    });

    expect(dummy).toBe(2);

    state.count = 5;

    expect(dummy).toBe(10);
});
it("Debe recalcular cuando sea necesario", () => {
    const state = reactive({
        count: 1
    });
    let computedRuns = 0;
    let effectRuns = 0;
    const doubled = computed(() => {
        computedRuns++;

        return state.count * 2;
    });
    effect(() => {
        effectRuns++;
        doubled.value;
    });
    expect(computedRuns).toBe(1);
    expect(effectRuns).toBe(1);
    state.count = 2;
    expect(computedRuns).toBe(2);
    expect(effectRuns).toBe(2);
});
it("No deberia de notificar cuando está dirty", () => {
    const state = reactive({
        a: 1,
        b: 2
    });
    let computedRuns = 0;
    let effectRuns = 0;
    const total = computed(() => {
        computedRuns++;

        return state.a + state.b;
    });
    effect(() => {
        effectRuns++;
        total.value;
    });
    expect(total.value).toBe(3);
    state.a = 10;
    state.b = 20;
    expect(effectRuns).toBe(3);
    expect(total.value).toBe(30);
    expect(computedRuns).toBe(3);
});

});
