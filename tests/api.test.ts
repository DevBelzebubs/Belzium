import {
    reactive,
    effect,
    computed
} from "../src";

import {
    describe,
    expect,
    it
} from "vitest";

describe("API publica", () => {

    it("Deberia exponer la api publica", () => {

        const state = reactive({
            count: 1
        });

        const doubled =
            computed(() =>
                state.count * 2
            );

        let result = 0;

        effect(() => {
            result = doubled.value;
        });

        expect(result).toBe(2);
        state.count = 5;
        expect(result).toBe(10);
    });
});