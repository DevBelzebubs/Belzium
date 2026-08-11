import { expect, it } from "vitest";
import { createToken } from "../src/di/token";
import { ClassProvider, FactoryProvider, ValueProvider } from "../src/di/provider";

it("Deberia forzar el valor de tipo de token", () => {

    const API_URL =
        createToken<string>(
            "API_URL"
        );


    const provider:
        ValueProvider<string> = {

        token: API_URL,

        useValue:
            "https://api.example.com"
    };


    expect(
        provider.useValue
    ).toBe(
        "https://api.example.com"
    );
});
it("Deberia tipar class providers", () => {

    class UserService {}


    const provider:
        ClassProvider<UserService> = {

        token:
            UserService,

        useClass:
            UserService
    };


    expect(
        provider.useClass
    ).toBe(
        UserService
    );
});
it("Deberia tipar factory providers", () => {

    const API_URL =
        createToken<string>(
            "API_URL"
        );


    const provider:
        FactoryProvider<string> = {

        token:
            API_URL,

        useFactory:
            () =>
                "https://api.example.com"
    };


    expect(
        provider.useFactory()
    ).toBe(
        "https://api.example.com"
    );
});