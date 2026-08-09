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
    it("should rerun effect when dependency changes", () => { // Test 2
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
    it("should only trigger effects for their dependencies", () => { // Test 3
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
});