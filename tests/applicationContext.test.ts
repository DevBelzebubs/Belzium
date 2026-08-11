import { describe, it, expect } from "vitest";
import { ApplicationContext } from "../src/di/applicationContext";
import { Scope } from "../src/di/scope";
import { Service } from "../src/di/decorators";
import { createToken } from "../src/di/token";
import { Bean, Configuration } from "../src";

describe("ApplicationContext", () => {

it("Deberia registrar y resolver una dependencia", () => {
    const context = new ApplicationContext();

    const service = {
        name: "UserService"
    };

    context.register(
        "userService",
        service
    );

    expect(
        context.resolve("userService")
    ).toBe(service);
});
it("Deberia saber cuando un proveedor existe", () => {
    const context = new ApplicationContext();

    const service = {};

    context.register(
        "service",
        service
    );

    expect(
        context.has("service")
    ).toBe(true);

    expect(
        context.has("missing")
    ).toBe(false);
});
it("Deberia de usar clases como tokens de inyección", () => {
    class UserService {}

    const context =
        new ApplicationContext();

    const service =
        new UserService();

    context.register(
        UserService,
        service
    );

    expect(
        context.resolve(UserService)
    ).toBe(service);
});
it("Debe crearse singleton automáticamente", () => {
    class UserService {}

    const context =
        new ApplicationContext();

    context.registerProvider({
        token: UserService,
        useClass: UserService
    });

    const a =
        context.resolve(UserService);

    const b =
        context.resolve(UserService);

    expect(a).toBe(b);
});
it("Deberia resolver una dependencia de clases", () => {
    class UserRepository {}
    class UserService {
        constructor(
            public repository: UserRepository
        ) {}
    }

    const context =
        new ApplicationContext();

    context.registerProvider({
        token: UserRepository,
        useClass: UserRepository
    });

    context.registerProvider({
        token: UserService,
        useClass: UserService,
        dependencies: [
            UserRepository
        ]
    });

    const service =
        context.resolve(UserService);

    expect(service).toBeInstanceOf(
        UserService
    );

    expect(service.repository)
        .toBeInstanceOf(UserRepository);
});
it("Deberia resolver múltiples dependencias", () => {
    class Logger {}

    class UserRepository {}

    class UserService {
        constructor(
            public repository: UserRepository,
            public logger: Logger
        ) {}
    }

    const context =
        new ApplicationContext();

    context.registerProvider({
        token: Logger,
        useClass: Logger
    });

    context.registerProvider({
        token: UserRepository,
        useClass: UserRepository
    });

    context.registerProvider({
        token: UserService,
        useClass: UserService,
        dependencies: [
            UserRepository,
            Logger
        ]
    });

    const service =
        context.resolve(UserService);

    expect(service.repository)
        .toBeInstanceOf(UserRepository);

    expect(service.logger)
        .toBeInstanceOf(Logger);
});
it("Deberia rehusar dependencias como singletons", () => {
    class UserRepository {}

    class UserService {
        constructor(
            public repository: UserRepository
        ) {}
    }

    const context =
        new ApplicationContext();

    context.registerProvider({
        token: UserRepository,
        useClass: UserRepository
    });

    context.registerProvider({
        token: UserService,
        useClass: UserService,
        dependencies: [
            UserRepository
        ]
    });

    const first =
        context.resolve(UserService);

    const second =
        context.resolve(UserService);

    expect(first).toBe(second);

    expect(first.repository)
        .toBe(second.repository);
});
it("Deberia detectar dependencias circulares", () => {
    class ServiceA {}

    class ServiceB {}

    const context =
        new ApplicationContext();

    context.registerProvider({
        token: ServiceA,
        useClass: ServiceA,
        dependencies: [
            ServiceB
        ]
    });

    context.registerProvider({
        token: ServiceB,
        useClass: ServiceB,
        dependencies: [
            ServiceA
        ]
    });

    expect(() =>
        context.resolve(ServiceA)
    ).toThrow(
        "Circular dependency detected"
    );
});
it("Deberia resolver proveedores singleton", () => {
    class Service {}

    const context =
        new ApplicationContext();

    context.registerProvider({
        token: Service,
        useClass: Service,
        scope: Scope.SINGLETON
    });

    expect(
        context.resolve(Service)
    ).toBe(
        context.resolve(Service)
    );
});
it("Deberia crear instancias transient", () => {
    class Service {}

    const context =
        new ApplicationContext();

    context.registerProvider({
        token: Service,
        useClass: Service,
        scope: Scope.TRANSIENT
    });

    const a =
        context.resolve(Service);

    const b =
        context.resolve(Service);

    expect(a).not.toBe(b);
});
it("Deberia crear una instancia scoped por context", () => {
    class Service {}

    const context =
        new ApplicationContext();

    context.registerProvider({
        token: Service,
        useClass: Service,
        scope: Scope.SCOPED
    });

    const childA =
        context.createScope();

    const childB =
        context.createScope();

    const a1 =
        childA.resolve(Service);

    const a2 =
        childA.resolve(Service);

    const b =
        childB.resolve(Service);

    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
});
it("Deberia compartir las instancias de singleton entre scopes", () => {
    class Service {}

    const context =
        new ApplicationContext();

    context.registerProvider({
        token: Service,
        useClass: Service
    });

    const child =
        context.createScope();

    expect(
        context.resolve(Service)
    ).toBe(
        child.resolve(Service)
    );
});
it("Deberia resolver dependencias scoped sin el scoped actual", () => {
    class Repository {}

    class Service {
        constructor(
            public repository: Repository
        ) {}
    }

    const root =
        new ApplicationContext();

    root.registerProvider({
        token: Repository,
        useClass: Repository,
        scope: Scope.SCOPED
    });

    root.registerProvider({
        token: Service,
        useClass: Service,
        scope: Scope.SCOPED,
        dependencies: [
            Repository
        ]
    });

    const childA =
        root.createScope();

    const childB =
        root.createScope();

    const serviceA =
        childA.resolve(Service);

    const serviceB =
        childB.resolve(Service);

    expect(
        serviceA.repository
    ).not.toBe(
        serviceB.repository
    );
});
it("Deberia rechazar una dependencia de singleton en un proveedor scoped", () => {

    class RequestContext {}

    class AuthService {
        constructor(
            public requestContext: RequestContext
        ) {}
    }

    const context =
        new ApplicationContext();

    context.registerProvider({
        token: RequestContext,
        useClass: RequestContext,
        scope: Scope.SCOPED
    });

    context.registerProvider({
        token: AuthService,
        useClass: AuthService,
        dependencies: [
            RequestContext
        ],
        scope: Scope.SINGLETON
    });

    expect(() =>
        context.resolve(AuthService)
    ).toThrow(
        "SINGLETON provider cannot depend on SCOPED provider"
    );
});
it("Deberia permitir un proveedor scoped en un singleton", () => {

    class Database {}

    class RequestService {
        constructor(
            public database: Database
        ) {}
    }

    const context =
        new ApplicationContext();

    context.registerProvider({
        token: Database,
        useClass: Database,
        scope: Scope.SINGLETON
    });

    context.registerProvider({
        token: RequestService,
        useClass: RequestService,
        dependencies: [
            Database
        ],
        scope: Scope.SCOPED
    });

    const child =
        context.createScope();

    const service =
        child.resolve(RequestService);

    expect(service.database)
        .toBeInstanceOf(Database);
});
it("Deberia resolver un provider factory", () => {
    const API_URL =
        Symbol("API_URL");

    const context =
        new ApplicationContext();
    context.register(
        API_URL,
        "https://api.example.com"
    );
    const API_CLIENT =
        Symbol("API_CLIENT");
    context.registerProvider({
        token: API_CLIENT,
        useFactory: (
            url: string
        ) => ({
            url
        }),
        dependencies: [
            API_URL
        ]
    });
    const client =
        context.resolve<{
            url: string
        }>(
            API_CLIENT
        );
    expect(client.url)
        .toBe(
            "https://api.example.com"
        );
});
it("Deberia cachear los factorys de providers singleton", () => {
    const TOKEN =
        Symbol("TOKEN");

    let executions = 0;
    const context =
        new ApplicationContext();

    context.registerProvider({
        token: TOKEN,
        useFactory: () => {

            executions++;

            return {
                id: executions
            };
        },
        scope: Scope.SINGLETON
    });

    const first =
        context.resolve(TOKEN);

    const second =
        context.resolve(TOKEN);

    expect(first)
        .toBe(second);
    expect(executions)
        .toBe(1);
});
it("Deberia describir tokens faltantes", () => {

    const context =
        new ApplicationContext();

    const API_URL =
        createToken<string>(
            "API_URL"
        );

    expect(() =>
        context.resolve(API_URL)
    ).toThrow(
        `No provider found for token "API_URL"`
    );
});
it("Deberia compartir instancias de singleton mediante scopes", () => {

    class SingletonService {}

    const context =
        new ApplicationContext();


    context.registerProvider({
        token: SingletonService,
        useClass: SingletonService,
        scope: Scope.SINGLETON
    });


    const scope =
        context.createScope();


    const rootInstance =
        context.resolve(
            SingletonService
        );

    const scopedInstance =
        scope.resolve(
            SingletonService
        );


    expect(scopedInstance)
        .toBe(rootInstance);
});
it("Deberia crear diferentes instancias scoped para diferentes scopes", () => {

    class ScopedService {}

    const context =
        new ApplicationContext();


    context.registerProvider({
        token: ScopedService,
        useClass: ScopedService,
        scope: Scope.SCOPED
    });


    const scopeA =
        context.createScope();

    const scopeB =
        context.createScope();


    const instanceA =
        scopeA.resolve(
            ScopedService
        );

    const instanceB =
        scopeB.resolve(
            ScopedService
        );


    expect(instanceA)
        .not.toBe(instanceB);
});
it("Deberia reusar instancias scoped adentro del mismo scope", () => {

    class ScopedService {}

    const context =
        new ApplicationContext();


    context.registerProvider({
        token: ScopedService,
        useClass: ScopedService,
        scope: Scope.SCOPED
    });


    const scope =
        context.createScope();


    const first =
        scope.resolve(
            ScopedService
        );

    const second =
        scope.resolve(
            ScopedService
        );


    expect(first)
        .toBe(second);
});
it("Deberia rechazar dependencia de singleton en un provider scoped", () => {

    const SCOPED =
        createToken<object>(
            "SCOPED"
        );


    class SingletonService {

        constructor(
            public dependency: object
        ) {}
    }


    const context =
        new ApplicationContext();


    context.registerProvider({

        token: SCOPED,

        useFactory: () => ({}),

        scope: Scope.SCOPED
    });


    context.registerProvider({

        token: SingletonService,

        useClass: SingletonService,

        dependencies: [
            SCOPED
        ],

        scope: Scope.SINGLETON
    });


    expect(() =>
        context.resolve(
            SingletonService
        )
    ).toThrow(
        /cannot depend on SCOPED provider/i
    );
});
it("Deberia rechazar singleton indirecto a dependencias scoped", () => {

    const SCOPED =
        createToken<object>(
            "SCOPED"
        );


    const SINGLETON_B =
        createToken<object>(
            "SINGLETON_B"
        );


    class SingletonA {

        constructor(
            public dependency: object
        ) {}
    }


    const context =
        new ApplicationContext();


    context.registerProvider({

        token: SCOPED,

        useFactory: () => ({}),

        scope: Scope.SCOPED
    });


    context.registerProvider({

        token: SINGLETON_B,

        useFactory: (
            dependency
        ) => ({
            dependency
        }),

        dependencies: [
            SCOPED
        ],

        scope: Scope.SINGLETON
    });


    context.registerProvider({

        token: SingletonA,

        useClass: SingletonA,

        dependencies: [
            SINGLETON_B
        ],

        scope: Scope.SINGLETON
    });


    expect(() =>
        context.resolve(
            SingletonA
        )
    ).toThrow(
        /scoped dependency/i
    );
});
it("Deberia registrar configuración de clases", () => {

    const API_URL =
        createToken<string>(
            "API_URL"
        );


    @Configuration()
    class AppConfig {

        @Bean({
            token: API_URL
        })
        apiUrl() {

            return "https://api.example.com";
        }
    }


    const context =
        new ApplicationContext();


    context.registerConfiguration(
        AppConfig
    );


    expect(
        context.resolve(API_URL)
    ).toBe(
        "https://api.example.com"
    );
});
it("Deberia rechazar clases sin @Configuración", () => {

    class NotConfiguration {}


    const context =
        new ApplicationContext();


    expect(() =>
        context.registerConfiguration(
            NotConfiguration
        )
    ).toThrow(
        /not marked with @Configuration/i
    );
});
});
