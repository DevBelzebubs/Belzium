// @vitest-environment jsdom

import {
    describe,
    expect,
    it,
} from "vitest";
import { ref } from "../src";
import { RenderableComponent } from "../src/component/types";
import { ApplicationContext } from "../src/di/applicationContext";
import { h, text, TEXT_NODE } from "../src/runtime/vnode";
import { mountComponent, patch } from "../src/runtime/vnodeRenderer";


describe("Component Reactivity", () => {

    it("actualiza el DOM cuando cambia un Ref utilizado durante render()", () => {
        class CounterComponent
            implements RenderableComponent {

            count =
                ref(0);


            render() {

                return h(
                    "div",
                    null,
                    [
                        text(
                            String(
                                this.count.value
                            )
                        ),
                    ]
                );
            }
        }


        const context =
            new ApplicationContext();


        // Registramos el componente en IoC
        context.registerProvider({
            token: CounterComponent,
            useClass: CounterComponent,
        });


        const container =
            document.createElement("div");


        // VNode inicial
        const vnode =
            h(CounterComponent);


        // Montamos el componente
        mountComponent(
            vnode,
            container,
            context,
            0
        );


        // El render inicial debe utilizar
        // el valor inicial del Ref.
        expect(
            container.textContent
        ).toBe("0");


        // Recuperamos la misma instancia
        // creada por ApplicationContext.
        const instance =
            vnode.component?.instance as CounterComponent;


        expect(instance)
            .toBeDefined();


        // Modificamos el estado reactivo.
        instance.count.value = 1;


        // Pulse debe haber ejecutado
        // nuevamente render() y patch().
        expect(
            container.textContent
        ).toBe("1");
    });


    it("reutiliza la misma instancia cuando el estado cambia", () => {

        class CounterComponent
            implements RenderableComponent {

            count =
                ref(0);


            render() {

                return h(
                    "div",
                    null,
                    [
                        text(
                            String(
                                this.count.value
                            )
                        ),
                    ]
                );
            }
        }


        const context =
            new ApplicationContext();


        context.registerProvider({
            token: CounterComponent,
            useClass: CounterComponent,
        });


        const container =
            document.createElement("div");


        const vnode =
            h(CounterComponent);


        mountComponent(
            vnode,
            container,
            context,
            0
        );


        const firstInstance =
            vnode.component?.instance;


        expect(firstInstance)
            .toBeDefined();


        const instance =
            firstInstance as CounterComponent;


        instance.count.value++;


        const secondInstance =
            vnode.component?.instance;


        // El estado cambia, pero el componente
        // no debe ser reconstruido.
        expect(secondInstance)
            .toBe(firstInstance);


        expect(
            container.textContent
        ).toBe("1");
    });


    it("vuelve a ejecutar render cuando cambia una dependencia utilizada por el componente", () => {

        let renderCount =
            0;


        class CounterComponent
            implements RenderableComponent {

            count =
                ref(0);


            render() {

                renderCount++;


                return h(
                    "div",
                    null,
                    [
                        text(
                            String(
                                this.count.value
                            )
                        ),
                    ]
                );
            }
        }


        const context =
            new ApplicationContext();


        context.registerProvider({
            token: CounterComponent,
            useClass: CounterComponent,
        });


        const container =
            document.createElement("div");


        const vnode =
            h(CounterComponent);


        mountComponent(
            vnode,
            container,
            context,
            0
        );


        // Render inicial
        expect(renderCount)
            .toBe(1);


        const instance =
            vnode.component?.instance as CounterComponent;


        instance.count.value = 10;


        // El cambio debe provocar
        // exactamente otro render.
        expect(renderCount)
            .toBe(2);


        expect(
            container.textContent
        ).toBe("10");
    });


    it("no vuelve a renderizar cuando el Ref recibe el mismo valor", () => {

        let renderCount =
            0;


        class CounterComponent
            implements RenderableComponent {

            count =
                ref(0);


            render() {

                renderCount++;


                return h(
                    "div",
                    null,
                    [
                        text(
                            String(
                                this.count.value
                            )
                        ),
                    ]
                );
            }
        }


        const context =
            new ApplicationContext();


        context.registerProvider({
            token: CounterComponent,
            useClass: CounterComponent,
        });


        const container =
            document.createElement("div");


        const vnode =
            h(CounterComponent);


        mountComponent(
            vnode,
            container,
            context,
            0
        );


        const instance =
            vnode.component?.instance as CounterComponent;


        expect(renderCount)
            .toBe(1);


        // Mismo valor → RefImpl no dispara
        // triggerEffect().
        instance.count.value = 0;


        expect(renderCount)
            .toBe(1);


        expect(
            container.textContent
        ).toBe("0");
    });

});
describe("Component lifecycle - reactividad después de unmount", () => {
  it("no vuelve a ejecutar render cuando cambia un estado reactivo después del unmount", () => {
    const calls: string[] = [];

    class ReactiveComponent {
      count = ref(0);

      render() {
        calls.push(`render:${this.count.value}`);

        return {
          type: "div",
          props: {},
          children: [
            {
              type: TEXT_NODE,
              text: String(this.count.value),
              children: [],
            },
          ],
        };
      }

      onMounted() {
        calls.push("mounted");
      }

      onUnmounted() {
        calls.push("unmounted");
      }
    }

    const context = new ApplicationContext();

    context.register(ReactiveComponent, new ReactiveComponent());

    const container = document.createElement("div");

    const vnode = {
      type: ReactiveComponent,
      props: {},
      children: [],
    };
    patch(null, vnode, container, 0, context);

    expect(calls).toEqual([
      "render:0",
      "mounted",
    ]);

    const instance = context.resolve(ReactiveComponent);

    // El componente está montado y debe reaccionar normalmente.
    instance.count.value++;

    expect(calls).toEqual([
      "render:0",
      "mounted",
      "render:1",
    ]);

    // Desmontamos el componente.
    patch(vnode, null, container, 0, context);

    expect(calls).toEqual([
      "render:0",
      "mounted",
      "render:1",
      "unmounted",
    ]);

    expect(container.childNodes).toHaveLength(0);

    // Cambiamos nuevamente el estado DESPUÉS del unmount.
    instance.count.value++;

    // El efecto del componente debe haber sido detenido.
    expect(calls).toEqual([
      "render:0",
      "mounted",
      "render:1",
      "unmounted",
    ]);

    // Otro cambio tampoco debe reactivar el componente.
    instance.count.value++;

    expect(calls).toEqual([
      "render:0",
      "mounted",
      "render:1",
      "unmounted",
    ]);
  });
});

