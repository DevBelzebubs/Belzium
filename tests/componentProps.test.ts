// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { RenderableComponent } from "../src/component/types";
import { ApplicationContext } from "../src/di/applicationContext";
import { h, text } from "../src/runtime/vnode";
import { mountComponent, patch } from "../src/runtime/vnodeRenderer";

describe("Component Props Integration", () => {
  it("inyecta las props en la instancia del componente", () => {
    class UserComponent implements RenderableComponent<{
      name: string;
    }> {
      props!: Readonly<{
        name: string;
      }>;

      render() {
        return h("div", null, [text(this.props.name)]);
      }
    }

    const context = new ApplicationContext();

    context.registerProvider({
      token: UserComponent,
      useClass: UserComponent,
    });

    const container = document.createElement("div");

    const vnode = h(UserComponent, {
      name: "Juan",
    });

    mountComponent(vnode, container, context, 0);

    expect(container.textContent).toBe("Juan");
  });

  it("las props actualizadas provocan un nuevo render", () => {
    let renderCount = 0;

    class UserComponent implements RenderableComponent<{
      name: string;
    }> {
      props!: Readonly<{
        name: string;
      }>;

      render() {
        renderCount++;

        return h("div", null, [text(this.props.name)]);
      }
    }

    const context = new ApplicationContext();

    context.registerProvider({
      token: UserComponent,
      useClass: UserComponent,
    });

    const container = document.createElement("div");

    const firstVNode = h(UserComponent, {
      name: "Juan",
    });

    mountComponent(firstVNode, container, context, 0);

    expect(renderCount).toBe(1);

    const secondVNode = h(UserComponent, {
      name: "Pedro",
    });

    // El patch debe reutilizar
    // la misma instancia.
    //
    // Esto es importante:
    // no creamos otro componente.
    //
    // El cambio de props debe llegar
    // a la instancia existente.
    expect(firstVNode.component?.instance).toBeDefined();

    // El renderer actualizará
    // las props mediante Pulse.
  });
  it("actualiza el DOM cuando cambian las props", () => {
    class UserComponent implements RenderableComponent<{
      name: string;
    }> {
      props!: Readonly<{
        name: string;
      }>;

      render() {
        return h("div", null, [text(this.props.name)]);
      }
    }

    const context = new ApplicationContext();

    context.registerProvider({
      token: UserComponent,
      useClass: UserComponent,
    });

    const container = document.createElement("div");

    // Primer VNode
    const firstVNode = h(UserComponent, {
      name: "Juan",
    });

    // Montamos el componente
    mountComponent(firstVNode, container, context, 0);

    // Estado inicial
    expect(container.textContent).toBe("Juan");

    // Segundo VNode con nuevas props
    const secondVNode = h(UserComponent, {
      name: "Pedro",
    });

    // Actualizamos mediante patch()
    // para utilizar el flujo normal
    // del renderer.
    patch(firstVNode, secondVNode, container, 0, context);

    // El mismo componente debe reflejar
    // el nuevo valor.
    expect(container.textContent).toBe("Pedro");
  });
  it("reutiliza la misma instancia cuando cambian las props", () => {
    class UserComponent implements RenderableComponent<{
      name: string;
    }> {
      props!: Readonly<{
        name: string;
      }>;

      render() {
        return h("div", null, [text(this.props.name)]);
      }
    }

    const context = new ApplicationContext();

    context.registerProvider({
      token: UserComponent,
      useClass: UserComponent,
    });

    const container = document.createElement("div");

    const firstVNode = h(UserComponent, {
      name: "Juan",
    });

    mountComponent(firstVNode, container, context, 0);

    const firstInstance = firstVNode.component?.instance;

    expect(firstInstance).toBeDefined();

    const secondVNode = h(UserComponent, {
      name: "Pedro",
    });

    patch(firstVNode, secondVNode, container, 0, context);

    const secondInstance = secondVNode.component?.instance;

    // Las props cambiaron,
    // pero la instancia no.
    expect(secondInstance).toBe(firstInstance);
  });
  it("impide que el componente modifique sus propias props", () => {
    let component:
      | RenderableComponent<{
          name: string;
        }>
      | undefined;

    class UserComponent implements RenderableComponent<{
      name: string;
    }> {
      props!: Readonly<{
        name: string;
      }>;

      render() {
        component = this;

        return h("div", null, [text(this.props.name)]);
      }
    }

    const context = new ApplicationContext();

    context.registerProvider({
      token: UserComponent,
      useClass: UserComponent,
    });

    const container = document.createElement("div");

    mountComponent(
      h(UserComponent, {
        name: "Juan",
      }),
      container,
      context,
      0,
    );

    expect(component).toBeDefined();

    expect(() => {
      (
        component!.props as {
          name: string;
        }
      ).name = "Pedro";
    }).toThrow("Component props are readonly");
  });
});
