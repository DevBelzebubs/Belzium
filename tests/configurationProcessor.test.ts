import { expect, it } from "vitest";
import { Bean, Configuration } from "../src";
import { ApplicationContext } from "../src/di/applicationContext";
import { ConfigurationProcessor } from "../src/di/configurationProcessor";
import { createToken } from "../src/di/token";
import { Scope } from "../src/di/scope";

it("Deberia registar métodos @Bean en la App", () => {
    @Configuration()
    class AppConfig {

        @Bean()
        apiUrl() {

            return "https://api.example.com";
        }
    }


    const context =
        new ApplicationContext();


    const processor = new ConfigurationProcessor();


    processor.process(
        new AppConfig(),
        context
    );


    const apiUrl =
        context.resolve<string>(
            "apiUrl"
        );

    expect(apiUrl)
        .toBe(
            "https://api.example.com"
        );
});
it("Deberia preservar una instancia de la configuración de esto", () => {

    @Configuration()
    class AppConfig {

        private baseUrl =
            "https://api.example.com";


        @Bean()
        apiUrl() {

            return this.baseUrl;
        }
    }


    const context =
        new ApplicationContext();


    const processor =
        new ConfigurationProcessor();


    processor.process(
        new AppConfig(),
        context
    );


    expect(
        context.resolve<string>(
            "apiUrl"
        )
    ).toBe(
        "https://api.example.com"
    );
});
it("Deberia inyectar dependencias de bean", () => {

    const API_URL =
        createToken<string>(
            "API_URL"
        );


    const API_CLIENT =
        createToken<{
            url: string;
        }>(
            "API_CLIENT"
        );


    @Configuration()
    class AppConfig {

        @Bean({
            token: API_URL
        })
        apiUrl() {

            return "https://api.example.com";
        }


        @Bean({
            token: API_CLIENT,
            dependencies: [
                API_URL
            ]
        })
        apiClient(
            apiUrl: string
        ) {

            return {
                url: apiUrl
            };
        }
    }


    const context =
        new ApplicationContext();


    const processor =
        new ConfigurationProcessor();


    processor.process(
        new AppConfig(),
        context
    );


    const client =
        context.resolve(
            API_CLIENT
        );


    expect(client.url)
        .toBe(
            "https://api.example.com"
        );
});
it("Deberia inyectar múltiples dependencias bean", () => {

    const API_URL =
        createToken<string>(
            "API_URL"
        );

    const API_KEY =
        createToken<string>(
            "API_KEY"
        );

    const CONFIG =
        createToken<{
            url: string;
            key: string;
        }>(
            "CONFIG"
        );


    @Configuration()
    class AppConfig {

        @Bean({
            token: API_URL
        })
        apiUrl() {
            return "https://api.example.com";
        }


        @Bean({
            token: API_KEY
        })
        apiKey() {
            return "secret";
        }


        @Bean({
            token: CONFIG,

            dependencies: [
                API_URL,
                API_KEY
            ]
        })
        config(
            url: string,
            key: string
        ) {

            return {
                url,
                key
            };
        }
    }


    const context =
        new ApplicationContext();


    new ConfigurationProcessor()
        .process(
            new AppConfig(),
            context
        );


    expect(
        context.resolve(CONFIG)
    ).toEqual({

        url:
            "https://api.example.com",

        key:
            "secret"
    });
});
it("Deberia crear beans singleton por defecto", () => {

    const API_CLIENT =
        createToken<object>(
            "API_CLIENT"
        );


    @Configuration()
    class AppConfig {

        @Bean({
            token: API_CLIENT
        })
        apiClient() {

            return {};
        }
    }


    const context =
        new ApplicationContext();


    context.registerConfiguration(
        AppConfig
    );


    const first =
        context.resolve(API_CLIENT);

    const second =
        context.resolve(API_CLIENT);


    expect(first)
        .toBe(second);
});
it("Deberia crear beans scoped", () => {

    const REQUEST_CONTEXT =
        createToken<object>(
            "REQUEST_CONTEXT"
        );


    @Configuration()
    class AppConfig {

        @Bean({
            token: REQUEST_CONTEXT,
            scope: Scope.SCOPED
        })
        requestContext() {

            return {};
        }
    }


    const root =
        new ApplicationContext();

    root.registerConfiguration(
        AppConfig
    );


    const scopeA =
        root.createScope();

    const scopeB =
        root.createScope();


    const first =
        scopeA.resolve(
            REQUEST_CONTEXT
        );

    const second =
        scopeA.resolve(
            REQUEST_CONTEXT
        );

    const third =
        scopeB.resolve(
            REQUEST_CONTEXT
        );


    expect(first)
        .toBe(second);

    expect(first)
        .not.toBe(third);
});