import { describe, it, expect } from "vitest";
import { reactive } from "../src/reactive/reactive";
import { effect } from "../src/reactive/effect";

describe("map", () => {

it("Deberia de reaccionar al valores map", () => {
    const state = reactive(
        new Map<string, number>()
    );

    let dummy = 0;

    effect(() => {
        dummy = state.get("count") ?? 0;
    });

    expect(dummy).toBe(0);
    state.set("count", 10);
    expect(dummy).toBe(10);
});
it("Deberia de trackear el Map.get", () => {
    const state = reactive(
        new Map<string, number>()
    );

    let dummy = 0;

    effect(() => {
        dummy = state.get("count") ?? 0;
    });

    expect(dummy).toBe(0);
    state.set("count", 10);
    expect(dummy).toBe(10);
});
it("Debe de reaccionar cuando un map key es añadido", () => {
    const state = reactive(
        new Map<string, number>()
    );

    let dummy = 0;

    effect(() => {
        dummy = state.get("count") ?? 0;
    });
    expect(dummy).toBe(0);
    state.set("count", 10);
    expect(dummy).toBe(10);
});
it("Debe de reaccionar cuando un valor en el Map cambia", () => {
    const state = reactive(
        new Map<string, number>([
            ["count", 1]
        ])
    );

    let dummy = 0;

    effect(() => {
        dummy = state.get("count") ?? 0;
    });

    expect(dummy).toBe(1);
    state.set("count", 2);
    expect(dummy).toBe(2);
});
it("No deberia de hacer trigger cuando el valor no cambia", () => {
    const state = reactive(
        new Map<string, number>([
            ["count", 1]
        ])
    );

    let runs = 0;

    effect(() => {
        state.get("count");
        runs++;
    });

    expect(runs).toBe(1);
    state.set("count", 1);
    expect(runs).toBe(1);
});
it("Debe reaccionar a Map.size", () => {
    const state = reactive(
        new Map<string, number>()
    );
    let size = 0;
    effect(() => {
        size = state.size;
    });
    expect(size).toBe(0);
    state.set("a", 1);
    expect(size).toBe(1);
    state.set("b", 2);
    expect(size).toBe(2);
});
it("Debe reaccionar a Map.has", () => {
    const state = reactive(
        new Map<string, number>()
    );

    let exists = false;

    effect(() => {
        exists = state.has("count");
    });

    expect(exists).toBe(false);
    state.set("count", 10);
    expect(exists).toBe(true);
});
it("Deberia reaccioanr cuando un Map key es eliminado", () => {
    const state = reactive(
        new Map<string, number>([
            ["count", 10]
        ])
    );

    let dummy = 0;

    effect(() => {
        dummy = state.get("count") ?? 0;
    });

    expect(dummy).toBe(10);
    state.delete("count");
    expect(dummy).toBe(0);
});
it("Deberia reaccionar a Map size cuando se elimina", () => {
    const state = reactive(
        new Map<string, number>([
            ["a", 1],
            ["b", 2]
        ])
    );

    let size = 0;

    effect(() => {
        size = state.size;
    });

    expect(size).toBe(2);
    state.delete("a");
    expect(size).toBe(1);
});
it("No deberia de disparar el trigger de iteración de map en SET", () => {
    const state = reactive(
        new Map([
            ["a", 1]
        ])
    );

    let runs = 0;

    effect(() => {
        state.size;
        runs++;
    });

    expect(runs).toBe(1);

    state.set("a", 2);
    expect(runs).toBe(1);
});
it("Debe trackear iteración de Map key", () => {
    const state = reactive(
        new Map([
            ["a", 1]
        ])
    );

    let keys: string[] = [];

    effect(() => {
        keys = [...state.keys()];
    });
    expect(keys).toEqual(["a"]);

    state.set("b", 2);
    expect(keys).toEqual([
        "a",
        "b"
    ]);
});
it("Debe trackear el valor de Map por iteración", () => {
    const state = reactive(
        new Map([
            ["a", 1]
        ])
    );

    let values: number[] = [];

    effect(() => {
        values = [...state.values()];
    });
    expect(values).toEqual([1]);
    state.set("b", 2);

    expect(values).toEqual([
        1,
        2
    ]);
});
it("Deberia reaccionar a los cambios de valor del map durante la iteración", () => {
    const state = reactive(
        new Map([
            ["a", 1]
        ])
    );

    let value = 0;

    effect(() => {
        value = [...state.values()][0];
    });

    expect(value).toBe(1);
    state.set("a", 100);
    expect(value).toBe(100);
});
it("Deberia de trackear el valor del map por iteracion", () => {
    const state = reactive(
        new Map([
            ["a", 1]
        ])
    );

    let values: number[] = [];

    effect(() => {
        values = [...state.values()];
    });

    expect(values).toEqual([1]);
    state.set("b", 2);
    expect(values).toEqual([
        1,
        2
    ]);
});
it("Debe trackear entries de map", () => {
    const state = reactive(
        new Map([
            ["a", 1]
        ])
    );

    let entries: [string, number][] = [];

    effect(() => {
        entries = [...state.entries()];
    });

    expect(entries).toEqual([
        ["a", 1]
    ]);
    state.set("b", 2);
    expect(entries).toEqual([
        ["a", 1],
        ["b", 2]
    ]);
});
it("Deberia de trackear el forEach de Map con su key real", () => {
    const state = reactive(
        new Map([
            ["a", 1]
        ])
    );

    let seen: [unknown, unknown][] = [];

    effect(() => {
        seen = [];
        state.forEach((value, key) => {
            seen.push([key, value]);
        });
    });

    expect(seen).toEqual([
        ["a", 1]
    ]);
    state.set("b", 2);
    expect(seen).toEqual([
        ["a", 1],
        ["b", 2]
    ]);
    state.set("a", 100);
    expect(seen).toEqual([
        ["a", 100],
        ["b", 2]
    ]);
});

it("Map.clear() should work and trigger ITERATE_KEY", () => {
    const state = reactive(new Map([["a", 1], ["b", 2]]));
    let size = 0;

    effect(() => {
        size = state.size;
    });

    expect(size).toBe(2);
    state.clear();
    expect(size).toBe(0);
});

it("Map.clear() should trigger per-key deps (get)", () => {
    const state = reactive(new Map([["a", 1], ["b", 2]]));

    let a = 0;
    let b = 0;

    effect(() => { a = state.get("a") ?? 0; });
    effect(() => { b = state.get("b") ?? 0; });

    expect(a).toBe(1);
    expect(b).toBe(2);

    state.clear();

    expect(a).toBe(0);
    expect(b).toBe(0);
});

it("Map.clear() should not trigger if map was empty", () => {
    const state = reactive(new Map<string, number>());
    let runs = 0;

    effect(() => {
        state.size;
        runs++;
    });

    expect(runs).toBe(1);
    state.clear();
    expect(runs).toBe(1);
});

it("Map.entries() should react to SET on existing key", () => {
    const state = reactive(new Map([["a", 1]]));
    let entries: [string, number][] = [];

    effect(() => {
        entries = [...state.entries()];
    });

    expect(entries).toEqual([["a", 1]]);
    state.set("a", 999);
    expect(entries).toEqual([["a", 999]]);
});

it("Map.get() should return reactive objects (deep reactivity)", () => {
    const state = reactive(new Map([["user", { name: "A" }]]));
    let name = "";

    effect(() => {
        name = state.get("user")!.name;
    });

    expect(name).toBe("A");
    state.get("user")!.name = "B";
    expect(name).toBe("B");
});

it("Map.get() should return primitive values as-is", () => {
    const state = reactive(new Map([["count", 42]]));
    let count = 0;

    effect(() => {
        count = state.get("count") ?? 0;
    });

    expect(count).toBe(42);
    state.set("count", 100);
    expect(count).toBe(100);
});

});
