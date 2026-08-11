import { describe, expect, it } from "vitest";
import { Service } from "../src/di/decorators";
import { ComponentType, getComponentMetadata, getMetadata } from "../src/di/metadata";
import { Scope } from "../src/di/scope";
import { ApplicationContext } from "../src/di/applicationContext";
import { Bean, Configuration } from "../src";
import { BEAN_METADATA, type BeanMetadata } from "../src/di/decorators/bean";
import { CONFIGURATION_METADATA } from "../src/di/decorators/configuration";



describe("@Service", () => {
    it("Deberia de registrar el metadata del service", () => {

        @Service()
        class UserService {}

        const metadata =
            getComponentMetadata(
                UserService
            );

        expect(metadata).toBeDefined();

        expect(metadata?.token)
            .toBe(UserService);

        expect(metadata?.type)
            .toBe(ComponentType.SERVICE);

        expect(metadata?.scope)
            .toBe(Scope.SINGLETON);
    });


    it("Deberia permitir configurar el scope del service", () => {

        @Service({
            scope: Scope.SCOPED
        })
        class UserService {}

        const metadata =
            getComponentMetadata(
                UserService
            );

        expect(metadata?.scope)
            .toBe(Scope.SCOPED);
    });
it("Deberia resolver dependencias de un componente con decorador", () => {

    @Service()
    class UserRepository {}

    @Service({
        dependencies: [
            UserRepository
        ]
    })
    class UserService {

        constructor(
            public repository: UserRepository
        ) {}
    }

    const context =
        new ApplicationContext();

    context.registerComponent(
        UserRepository
    );

    context.registerComponent(
        UserService
    );

    const service =
        context.resolve(UserService);

    expect(service)
        .toBeInstanceOf(UserService);

    expect(service.repository)
        .toBeInstanceOf(UserRepository);
});
it("Deberia registrar un componente con decorador", () => {

    @Service()
    class UserService {}

    const context =
        new ApplicationContext();

    context.registerComponent(
        UserService
    );

    const service =
        context.resolve(UserService);

    expect(service)
        .toBeInstanceOf(UserService);
});
describe("@Configuration", () => {

    it("Deberia marcar una clase como configuración", () => {
        @Configuration()
        class AppConfig {}
        expect(getMetadata(CONFIGURATION_METADATA, AppConfig)).toBe(true);
    });
});
});
describe("@Bean", () => {

    it("Deberia registrar metadatos de Bean", () => {

        @Configuration()
        class AppConfig {

            @Bean()
            apiUrl() {
                return "https://api.example.com";
            }

            @Bean()
            anotherBean() {
                return {};
            }
        }


        const metadata =
            getMetadata<BeanMetadata[]>(
                BEAN_METADATA,
                AppConfig
            );


        expect(metadata)
            .toHaveLength(2);


        expect(metadata![0].propertyKey)
            .toBe("apiUrl");


        expect(metadata![1].propertyKey)
            .toBe("anotherBean");
    });
});