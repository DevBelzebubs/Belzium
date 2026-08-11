// Tests del ciclo de vida de ComponentScope.

import {
    describe,
    expect,
    it,
} from "vitest";
import { ComponentScope } from "../src/component/componentScope";

describe("ComponentScope", () => {

    it("comienza en estado created", () => {

        const scope =
            new ComponentScope();

        expect(scope.lifecycleState)
            .toBe("created");
    });


    it("ejecuta onMount al montar", () => {

        const scope =
            new ComponentScope();

        let executions = 0;

        scope.onMount(() => {
            executions++;
        });

        scope.mount();

        expect(executions)
            .toBe(1);

        expect(scope.lifecycleState)
            .toBe("mounted");
    });


    it("ejecuta onUpdate después de una actualización", () => {

        const scope =
            new ComponentScope();

        let executions = 0;

        scope.onUpdate(() => {
            executions++;
        });

        scope.mount();

        scope.update();
        scope.update();

        expect(executions)
            .toBe(2);
    });


    it("ejecuta onUnmount antes de detener el scope reactivo", () => {

        const scope =
            new ComponentScope();

        let executed = false;

        scope.onUnmount(() => {
            executed = true;
        });

        scope.mount();
        scope.unmount();

        expect(executed)
            .toBe(true);

        expect(scope.lifecycleState)
            .toBe("unmounted");

        expect(scope.effectScope.isActive)
            .toBe(false);
    });


    it("unmount es idempotente", () => {

        const scope =
            new ComponentScope();

        let executions = 0;

        scope.onUnmount(() => {
            executions++;
        });

        scope.mount();

        scope.unmount();
        scope.unmount();

        expect(executions)
            .toBe(1);
    });


    it("no ejecuta onUpdate después de unmount", () => {

        const scope =
            new ComponentScope();

        let executions = 0;

        scope.onUpdate(() => {
            executions++;
        });

        scope.mount();

        scope.unmount();
        scope.update();

        expect(executions)
            .toBe(0);
    });


    it("ejecuta efectos dentro de su EffectScope", () => {

        const scope =
            new ComponentScope();

        let executions = 0;

        scope.run(() => {
            // El test solamente comprueba
            // que el código puede ejecutarse
            // dentro del scope del componente.
            executions++;
        });

        expect(executions)
            .toBe(1);
    });


    it("no permite registrar onMount después del montaje", () => {

        const scope =
            new ComponentScope();

        scope.mount();

        expect(() => {
            scope.onMount(() => {});
        }).toThrow(
            "Cannot register onMount after component mount",
        );
    });


    it("no permite registrar hooks después del desmontaje", () => {

        const scope =
            new ComponentScope();

        scope.mount();
        scope.unmount();

        expect(() => {
            scope.onUpdate(() => {});
        }).toThrow(
            "Cannot register onUpdate after component unmount",
        );

        expect(() => {
            scope.onUnmount(() => {});
        }).toThrow(
            "Cannot register onUnmount after component unmount",
        );
    });
});