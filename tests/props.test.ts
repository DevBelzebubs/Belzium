import { describe, expect, it } from "vitest";
import { createProps, updateProps } from "../src/component/props";



describe("Component Props", () => {

    it("crea props con sus valores iniciales", () => {

        const props =
            createProps({
                name: "Juan",
                age: 21,
            });

        expect(props.readonly.name)
            .toBe("Juan");

        expect(props.readonly.age)
            .toBe(21);
    });


    it("mantiene las props como readonly", () => {

        const props =
            createProps({
                name: "Juan",
            });

        expect(() => {

            (
                props.readonly as {
                    name: string;
                }
            ).name = "Pedro";

        }).toThrow(
            "Component props are readonly"
        );
    });


    it("actualiza una prop existente", () => {

        const props =
            createProps({
                name: "Juan",
            });

        updateProps(
            props.target,
            {
                name: "Pedro",
            }
        );

        expect(props.readonly.name)
            .toBe("Pedro");
    });


    it("agrega una nueva prop", () => {

        const props =
            createProps({
                name: "Juan",
            });

        updateProps(
            props.target,
            {
                name: "Juan",
                age: 21,
            }
        );

        expect((props.readonly as Record<string, unknown>).age)
            .toBe(21);
    });


    it("elimina una prop que ya no existe", () => {

        const props =
            createProps({
                name: "Juan",
                age: 21,
            });

        updateProps(
            props.target,
            {
                name: "Juan",
            }
        );

        expect(
            "age" in props.readonly
        ).toBe(false);
    });


    it("mantiene la identidad del objeto reactivo", () => {

        const props =
            createProps({
                name: "Juan",
            });

        const original =
            props.readonly;

        updateProps(
            props.target,
            {
                name: "Pedro",
            }
        );

        expect(props.readonly)
            .toBe(original);

        expect(props.readonly.name)
            .toBe("Pedro");
    });


    it("no permite eliminar props desde el componente", () => {

        const props =
            createProps({
                name: "Juan",
            });

        expect(() => {

            delete (
                props.readonly as {
                    name?: string;
                }
            ).name;

        }).toThrow(
            "Component props are readonly"
        );
    });

});