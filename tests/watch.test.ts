import { describe, expect, it } from "vitest";
import { reactive } from "../src";
import { watch, watchEffect } from "../src/reactive/watch";

describe("watchEffect", () => {

    it("Deberia correr inmediatamente", () => {
        const state = reactive({
            count: 0
        });

        let dummy = 0;

        watchEffect(() => {
            dummy = state.count;
        });

        expect(dummy).toBe(0);
    });
it("Deberia volver a correr cuando cambian sus dependencias", () => {
    const state = reactive({
        count: 0
    });
    let dummy = 0;

    watchEffect(() => {
        dummy = state.count;
    });

    state.count = 10;
    expect(dummy).toBe(10);
});
it("Deberia ser detenible", () => {
    const state = reactive({
        count: 0
    });

    let dummy = 0;

    const watcher = watchEffect(() => {
        dummy = state.count;
    });

    expect(dummy).toBe(0);

    state.count = 1;

    expect(dummy).toBe(1);
    watcher.stop();
    state.count = 2;
    expect(dummy).toBe(1);
});
it("Deberia mirar a una fuente", () => {
    const state = reactive({
        count: 0
    });

    let newValue = 0;
    let oldValue = 0;

    watch(
        () => state.count,
        (newVal, oldVal) => {
            newValue = newVal;
            oldValue = oldVal;
        }
    );

    state.count = 5;

    expect(newValue).toBe(5);
    expect(oldValue).toBe(0);
});
it("Deberia actualizar el valor antiguo por cada cambio", () => {
    const state = reactive({
        count: 0
    });

    const changes: Array<[number, number]> = [];
    watch(
        () => state.count,
        (newValue, oldValue) => {
            changes.push([
                newValue,
                oldValue
            ]);
        }
    );
    state.count = 1;
    state.count = 2;
    state.count = 3;

    expect(changes).toEqual([
        [1, 0],
        [2, 1],
        [3, 2]
    ]);
});
it("Deberia dejar de mirar", () => {
    const state = reactive({
        count: 0
    });

    let calls = 0;

    const watcher = watch(
        () => state.count,
        () => {
            calls++;
        }
    );

    state.count = 1;
    expect(calls).toBe(1);
    watcher.stop();
    state.count = 2;
    expect(calls).toBe(1);
});
it("Deberia de hacer flush de manera sincrónica", () => {
    const state = reactive({
        count: 0
    });
    let calls = 0;

    watch(
        () => state.count,
        () => {
            calls++;
        },
        {
            flush: "sync"
        }
    );

    state.count++;
    expect(calls).toBe(1);
});
it("Deberia de hacer flush de manera asíncrónica", async () => {
    const state = reactive({
        count: 0
    });
    let calls = 0;

    watch(
        () => state.count,
        () => {
            calls++;
        },
        {
            flush: "pre"
        }
    );
    state.count++;
    expect(calls).toBe(0);
    await Promise.resolve();
    expect(calls).toBe(1);
});
it("Deberia deduplicar jobs en cola", async () => {
    const state = reactive({
        count: 0
    });
    let calls = 0;
    watch(
        () => state.count,
        () => {
            calls++;
        },
        {
            flush: "pre"
        }
    );

    state.count++;
    state.count++;
    state.count++;

    expect(calls).toBe(0);
    await Promise.resolve();
    expect(calls).toBe(1);
});
});