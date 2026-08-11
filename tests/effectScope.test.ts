// Tests del ciclo de vida de EffectScope.

import { describe, expect, it } from "vitest";
import { ref, effect } from "../src";
import { effectScope } from "../src/reactive/effectScope";
describe("EffectScope", () => {
  it("crea un scope activo", () => {
    const scope = effectScope();

    expect(scope.isActive).toBe(true);
  });

  it("registra y detiene un efecto", () => {
    const scope = effectScope();

    const state = ref(0);

    let executions = 0;

    const reactiveEffect = effect(() => {
      executions++;

      state.value;
    });

    scope.add(reactiveEffect);

    expect(executions).toBe(1);

    state.value++;

    expect(executions).toBe(2);

    scope.stop();

    expect(scope.isActive).toBe(false);

    state.value++;

    // El efecto ya no debe ejecutarse.
    expect(executions).toBe(2);
  });

  it("detiene todos los efectos del scope", () => {
    const scope = effectScope();

    const first = ref(0);

    const second = ref(0);

    let firstExecutions = 0;
    let secondExecutions = 0;

    const firstEffect = effect(() => {
      firstExecutions++;

      first.value;
    });

    const secondEffect = effect(() => {
      secondExecutions++;

      second.value;
    });

    scope.add(firstEffect);
    scope.add(secondEffect);

    expect(firstExecutions).toBe(1);

    expect(secondExecutions).toBe(1);

    first.value++;
    second.value++;

    expect(firstExecutions).toBe(2);

    expect(secondExecutions).toBe(2);

    scope.stop();

    first.value++;
    second.value++;

    expect(firstExecutions).toBe(2);

    expect(secondExecutions).toBe(2);
  });

  it("detener un scope dos veces es seguro", () => {
    const scope = effectScope();

    const state = ref(0);

    let executions = 0;

    const reactiveEffect = effect(() => {
      executions++;

      state.value;
    });

    scope.add(reactiveEffect);

    scope.stop();
    scope.stop();

    state.value++;

    expect(executions).toBe(1);

    expect(scope.isActive).toBe(false);
  });

  it("detiene inmediatamente un efecto añadido a un scope inactivo", () => {
    const scope = effectScope();

    scope.stop();

    const state = ref(0);

    let executions = 0;

    const reactiveEffect = effect(() => {
      executions++;

      state.value;
    });

    scope.add(reactiveEffect);

    expect(executions).toBe(1);

    state.value++;

    // add() debe haber detenido
    // inmediatamente el efecto.
    expect(executions).toBe(1);
  });

  it("libera las referencias a los efectos después de stop", () => {
    const scope = effectScope();

    const state = ref(0);

    const reactiveEffect = effect(() => {
      state.value;
    });

    scope.add(reactiveEffect);

    scope.stop();
    // Verificamos que el scope no vuelve a aceptar efectos activos.
    expect(scope.isActive).toBe(false);
  });
  it("registra automáticamente efectos creados dentro de run", () => {
    const scope = effectScope();

    const state = ref(0);

    let executions = 0;

    scope.run(() => {
      effect(() => {
        executions++;

        state.value;
      });
    });

    expect(executions).toBe(1);

    state.value++;

    expect(executions).toBe(2);

    scope.stop();

    state.value++;

    // El efecto creado dentro
    // del scope ya está detenido.
    expect(executions).toBe(2);
  });
  it("restaura correctamente el scope anterior después de scopes anidados", () => {
    const parent = effectScope();

    const child = effectScope();

    const parentState = ref(0);

    const childState = ref(0);

    let parentExecutions = 0;
    let childExecutions = 0;

    parent.run(() => {
      effect(() => {
        parentExecutions++;

        parentState.value;
      });

      child.run(() => {
        effect(() => {
          childExecutions++;

          childState.value;
        });
      });

      effect(() => {
        parentExecutions++;

        parentState.value;
      });
    });

    expect(parentExecutions).toBe(2);

    expect(childExecutions).toBe(1);

    child.stop();

    childState.value++;

    expect(childExecutions).toBe(1);

    parentState.value++;

    expect(parentExecutions).toBe(4);
  });
});
