import { describe, it, expect} from 'vitest';
import { RAW, reactive } from '../src/reactive/reactive';
import { effect } from '../src/reactive/effect';
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
it("Debe exponer el objeto crudo a través de RAW", () => {
    const raw = {
        count: 0
    };

    const state = reactive(raw);

    expect((state as any)[RAW]).toBe(raw);
});
it("Debe exponer objetos anidados crudos a través de RAW", () => {
    const raw = {
        user: {
            name: "Juan"
        }
    };
    const state = reactive(raw);
    expect(
        (state.user as any)[RAW]
    ).toBe(raw.user);
});
});
