import {
    describe,
    expect,
    it
} from "vitest";
import { createToken, InjectionToken } from "../src/di/token";
import { ApplicationContext } from "../src/di/applicationContext";
import { Service } from "../src/di/decorators";


describe("InjectionToken", () => {

    it("Deberia crear un token único", () => {

        const tokenA =
            createToken<string>(
                "API_URL"
            );

        const tokenB =
            createToken<string>(
                "API_URL"
            );

        expect(tokenA)
            .not.toBe(tokenB);
    });
it("Deberia resolver un token tipado a través de un factory provider", () => {

    interface ApiClient {
        url: string;
    }

    const API_URL =
        createToken<string>(
            "API_URL"
        );

    const API_CLIENT =
        createToken<ApiClient>(
            "API_CLIENT"
        );


    const context =
        new ApplicationContext();


    context.register(
        API_URL,
        "https://api.example.com"
    );


    context.registerProvider({

        token: API_CLIENT,

        useFactory: (
            url: string
        ): ApiClient => ({
            url
        }),

        dependencies: [
            API_URL
        ]
    });


    const client =
        context.resolve(API_CLIENT);


    expect(client.url)
        .toBe(
            "https://api.example.com"
        );
});
it("Deberia resolver múltiples dependencias factory", () => {

    const API_URL =
        createToken<string>(
            "API_URL"
        );

    const API_KEY =
        createToken<string>(
            "API_KEY"
        );

    const API_CLIENT =
        createToken<{
            url: string;
            key: string;
        }>(
            "API_CLIENT"
        );


    const context =
        new ApplicationContext();


    context.register(
        API_URL,
        "https://api.example.com"
    );

    context.register(
        API_KEY,
        "secret"
    );


    context.registerProvider({

        token: API_CLIENT,

        useFactory: (
            url: string,
            key: string
        ) => ({
            url,
            key
        }),

        dependencies: [
            API_URL,
            API_KEY
        ]
    });


    const client =
        context.resolve(API_CLIENT);


    expect(client).toEqual({
        url: "https://api.example.com",
        key: "secret"
    });
});
it("Deberia preservar la descripción del token", () => {

    const token =
        createToken<string>(
            "API_URL"
        );

    expect(token.description)
        .toBe("API_URL");
});
it("Deberia crear un token único con la misma descripción", () => {
    const tokenA =
        createToken<string>(
            "API_URL"
        );
    const tokenB =
        createToken<string>(
            "API_URL"
        );

    expect(tokenA)
        .not.toBe(tokenB);
});
it("Deberia resolver la clase a través de una clase abstracta", () => {

    interface Logger {
        log(message: string): void;
    }


    class ConsoleLogger
        implements Logger {

        log(message: string) {
            console.log(message);
        }
    }


    const LOGGER =
        createToken<Logger>(
            "LOGGER"
        );


    const context =
        new ApplicationContext();


    context.registerProvider({
        token: LOGGER,
        useClass: ConsoleLogger
    });


    const logger =
        context.resolve(LOGGER);


    expect(logger)
        .toBeInstanceOf(
            ConsoleLogger
        );
});
it("Debe inyectar una implementación a través de un token abstracto", () => {

    interface Logger {
        log(message: string): void;
    }


    class ConsoleLogger
        implements Logger {

        log(message: string) {
            console.log(message);
        }
    }


    const LOGGER =
        createToken<Logger>(
            "LOGGER"
        );


    @Service({
        dependencies: [
            LOGGER
        ]
    })
    class UserService {

        constructor(
            public logger: Logger
        ) {}
    }


    const context =
        new ApplicationContext();


    context.registerProvider({
        token: LOGGER,
        useClass: ConsoleLogger
    });


    context.registerComponent(
        UserService
    );


    const service =
        context.resolve(
            UserService
        );


    expect(service.logger)
        .toBeInstanceOf(
            ConsoleLogger
        );
});
it("Deberia resolver un token abstracto a través de un factory", () => {

    interface Logger {
        log(message: string): void;
    }


    const LOGGER =
        createToken<Logger>(
            "LOGGER"
        );


    const context =
        new ApplicationContext();


    context.registerProvider({
        token: LOGGER,

        useFactory: (): Logger => ({
            log(message: string) {
                console.log(message);
            }
        })
    });


    const logger =
        context.resolve(LOGGER);


    expect(logger)
        .toBeDefined();

    expect(typeof logger.log)
        .toBe("function");
});
it("Deberia crear tokens tipados", () => {

        const API_URL =
            createToken<string>(
                "API_URL"
            );


        expect(
            API_URL
        ).toBeInstanceOf(
            InjectionToken
        );


        expect(
            API_URL.description
        ).toBe(
            "API_URL"
        );
    });
});