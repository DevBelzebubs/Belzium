import { describe, it, expect} from 'vitest';
import { reactive } from '../src/reactive/reactive';
import { effect } from '../src/reactive/effect';

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
});