import { describe, it, expect} from 'vitest';
import { reactive } from '../src/reactive/reactive';
import { effect } from '../src/reactive/effect';
import { computed } from '../src/reactive/computed';
import { watch } from '../src/reactive/watch';
import { ref } from '../src/reactive/ref';
import { toRaw } from '../src/reactive/reactiveContext';

describe('reactive', () => {
    it('deberia de crear un objeto reactivo', () => { // Test 1
        const state = reactive({ count: 0 });
        expect(state.count).toBe(0);
        state.count++; // Deberia de disparar el efecto y actualizar el valor
        expect(state.count).toBe(1);
    });
    it("Deberia de volver a ejecutar el efecto cuando cambia la dependencia", () => { // Test 2
    const state = reactive({
        count: 0
    });
    let dummy = 0;

    effect(() => { 
        dummy = state.count; // El efecto se ejecuta y asigna el valor de state.count
    });
    expect(dummy).toBe(0);
    state.count = 10;
    expect(dummy).toBe(10);
    });
    it("Deberia de no ejecutar efectos innecesariamente", () => { // Test 3
    const state = reactive({
        count: 0,
        name: "Juan"
    });
    let countRuns = 0;
    let nameRuns = 0;
    effect(() => {
        state.count;
        countRuns++;
    });
    effect(() => {
        state.name;
        nameRuns++;
    });
    expect(countRuns).toBe(1);
    expect(nameRuns).toBe(1);
    state.count++;
    expect(countRuns).toBe(2);
    expect(nameRuns).toBe(1);
    });
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
it("Deberia de crear una variable reactiva", () => {

    const count = ref(0);

    let dummy = 0;

    effect(() => {
        dummy = count.value;
    });

    expect(dummy).toBe(0);

    count.value = 1;

    expect(dummy).toBe(1);
});
it("Deberia reaccionar profundamente a objetos embebidos", () => {

    const state = reactive({
        user: {
            name: "Juan"
        }
    });

    let dummy = "";

    effect(() => {
        dummy = state.user.name;
    });

    expect(dummy).toBe("Juan");

    state.user.name = "Pedro";

    expect(dummy).toBe("Pedro");
});
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
it("Deberia de reaccionar a propiedades eliminadas", () => {
    const state = reactive<{ name?: string }>({
        name: "Juan"
    });

    let dummy = "";

    effect(() => {
        dummy = state.name ?? "Unknown";
    });

    expect(dummy).toBe("Juan");

    delete state.name;

    expect(dummy).toBe("Unknown");
});
it("Deberia de disparar los efectos de iteracion cuando la propiedad es eliminada", () => {
    const state = reactive<{ name: string; age?: number }>({
        name: "Juan",
        age: 21
    });

    let keys: string[] = [];

    effect(() => {
        keys = Object.keys(state);
    });

    expect(keys).toEqual([
        "name",
        "age"
    ]);

    delete state.age;

    expect(keys).toEqual([
        "name"
    ]);
});
it("Deberia de trackear el objeto en la iteración", () => {
    const state = reactive<Record<string, unknown>>({
        name: "Juan"
    });

    let keys: string[] = [];

    effect(() => {
        keys = Object.keys(state);
    });

    expect(keys).toEqual([
        "name"
    ]);

    state.age = 21;
    expect(keys).toEqual([
        "name",
        "age"
    ]);
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
it("No deberia de crear un proxy desde un proxy", () => {
    const raw = {
        count: 0
    };

    const state =
        reactive(raw);
    const again =
        reactive(state);
    expect(again)
        .toBe(state);
});
it("Deberia de retornar el objeto crudo", () => {
    const raw = {
        count: 0
    };

    const state =
        reactive(raw);

    expect(
        toRaw(state)
    ).toBe(raw);
});
});
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