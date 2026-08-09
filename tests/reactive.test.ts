import { describe, it, expect} from 'vitest';
import { reactive } from '../src/reactive/reactive';
import { effect } from '../src/reactive/effect';
import { computed } from '../src/reactive/computed';
import { watch } from '../src/reactive/watch';
import { ref } from '../src/reactive/ref';

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