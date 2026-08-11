import {
    describe,
    expect,
    it
} from "vitest";
import { Application, createApplication } from "../src/core/application";
import { Service } from "../src/di/decorators";
import { ApplicationContext } from "../src/di/applicationContext";
import { Bean, Component, Configuration, createApp, ref } from "../src";
import { createToken } from "../src/di/token";
import { Scope } from "../src/di/scope";
import { h, text } from "../src/runtime/vnode";




describe("Application", () => {

    it("Deberia crear la app", () => {

        const app =
            createApplication();

        expect(app)
            .toBeInstanceOf(Application);
    });


    it("Deberia registrar los providers de la app", () => {

        @Service()
        class UserRepository {}


        @Service({
            dependencies: [
                UserRepository
            ]
        })
        class UserService {

            constructor(
                public repository:
                    UserRepository
            ) {}
        }


        const app =
            createApplication({
                providers: [
                    UserRepository,
                    UserService
                ]
            });


        const service =
            app.resolve(
                UserService
            );


        expect(service)
            .toBeInstanceOf(UserService);


        expect(service.repository)
            .toBeInstanceOf(
                UserRepository
            );
    });


    it("Deberia exponer el contexto de la app", () => {

        const app =
            createApplication();

        expect(app.context)
            .toBeInstanceOf(
                ApplicationContext
            );
    });
it("Deberia iniciar configuraciones", () => {

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


        const app =
            new Application({

                providers: [
                    AppConfig
                ]
            });


        expect(
            app.resolve<string>(
                API_URL
            )
        ).toBe(
            "https://api.example.com"
        );
    });
    it("Deberia usar los servicios de bootstrap", () => {

    @Service()
    class UserService {

        getName() {
            return "Juan";
        }
    }


    const app =
        new Application({

            providers: [
                UserService
            ]
        });


    const service =
        app.resolve<UserService>(
            UserService
        );


    expect(service)
        .toBeInstanceOf(
            UserService
        );


    expect(
        service.getName()
    ).toBe("Juan");
});
it("Deberia inyectar dependencias del service", () => {

    const LOGGER =
        createToken<{
            log(message: string): void;
        }>("LOGGER");


    @Service({
        dependencies: [
            LOGGER
        ]
    })
    class UserService {

        constructor(
            private logger: {
                log(message: string): void;
            }
        ) {}


        test() {

            this.logger.log(
                "hello"
            );
        }
    }


    const logger = {

        log() {}
    };
    const app =
        new Application({
            providers: [
                {
                    token: LOGGER,

                    useValue: logger
                },

                UserService
            ]
        });


    const service =
        app.resolve<UserService>(
            UserService
        );


    expect(service)
        .toBeInstanceOf(
            UserService
        );
});
it("Deberia respetar el service scope", () => {

    @Service({
        scope: Scope.SCOPED
    })
    class RequestService {}


    const app =
        new Application({

            providers: [
                RequestService
            ]
        });


    const scopeA =
        app.context.createScope();

    const scopeB =
        app.context.createScope();


    const a1 =
        scopeA.resolve(
            RequestService
        );

    const a2 =
        scopeA.resolve(
            RequestService
        );

    const b1 =
        scopeB.resolve(
            RequestService
        );


    expect(a1)
        .toBe(a2);

    expect(a1)
        .not.toBe(b1);
});
it("Deberia resolver las dependencias usando class tokens", () => {

    @Service()
    class UserRepository {

        findUser() {
            return "Juan";
        }
    }


    @Service({
        dependencies: [
            UserRepository
        ]
    })
    class UserService {

        constructor(
            private repository: UserRepository
        ) {}


        getUser() {
            return this.repository.findUser();
        }
    }


    const app =
        new Application({

            providers: [
                UserRepository,
                UserService
            ]
        });


    const service =
        app.resolve<UserService>(
            UserService
        );


    expect(
        service.getUser()
    ).toBe("Juan");
});
it("Deberia compartir dependencias entre instancias", () => {

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


    @Service({
        dependencies: [
            UserRepository
        ]
    })
    class AdminService {

        constructor(
            public repository: UserRepository
        ) {}
    }


    const app =
        new Application({

            providers: [
                UserRepository,
                UserService,
                AdminService
            ]
        });


    const userService =
        app.resolve<UserService>(
            UserService
        );

    const adminService =
        app.resolve<AdminService>(
            AdminService
        );


    expect(
        userService.repository
    ).toBe(
        adminService.repository
    );
});
it("Deberia resolver grafos de dependencias profundos", () => {

    @Service()
    class Database {}


    @Service({
        dependencies: [
            Database
        ]
    })
    class UserRepository {

        constructor(
            public database: Database
        ) {}
    }


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


    const app =
        new Application({

            providers: [
                Database,
                UserRepository,
                UserService
            ]
        });


    const service =
        app.resolve<UserService>(
            UserService
        );


    expect(
        service.repository
    ).toBeInstanceOf(
        UserRepository
    );


    expect(
        service.repository.database
    ).toBeInstanceOf(
        Database
    );
});
it("Deberia detectar dependencias circulares", () => {

    const SERVICE_A =
        createToken("SERVICE_A");

    const SERVICE_B =
        createToken("SERVICE_B");


    @Service({
        token: SERVICE_A,
        dependencies: [
            SERVICE_B
        ]
    })
    class ServiceA {}


    @Service({
        token: SERVICE_B,
        dependencies: [
            SERVICE_A
        ]
    })
    class ServiceB {}


    const app =
        new Application({

            providers: [
                ServiceA,
                ServiceB
            ]
        });


    expect(() =>
        app.resolve(
            SERVICE_A
        )
    ).toThrow(
        /Circular dependency detected/
    );
});
it("Deberia registrar un service usando un token explícito", () => {

    const USER_REPOSITORY =
        createToken<UserRepository>(
            "USER_REPOSITORY"
        );


    @Service({
        token: USER_REPOSITORY
    })
    class UserRepository {

        findUser() {
            return "Juan";
        }
    }


    const app =
        new Application({
            providers: [
                UserRepository
            ]
        });


    const repository =
        app.resolve(
            USER_REPOSITORY
        );


    expect(repository)
        .toBeInstanceOf(
            UserRepository
        );


    expect(
        repository.findUser()
    ).toBe("Juan");
});
it("Deberia inyectar un token usando un service explícito", () => {

    const USER_REPOSITORY =
        createToken<UserRepository>(
            "USER_REPOSITORY"
        );


    @Service({
        token: USER_REPOSITORY
    })
    class UserRepository {

        findUser() {
            return "Juan";
        }
    }


    @Service({
        dependencies: [
            USER_REPOSITORY
        ]
    })
    class UserService {

        constructor(
            private repository: UserRepository
        ) {}


        getUser() {
            return this.repository.findUser();
        }
    }


    const app =
        new Application({
            providers: [
                UserRepository,
                UserService
            ]
        });


    const service =
        app.resolve(UserService);


    expect(
        service.getUser()
    ).toBe("Juan");
});

});
describe("createApp", () => {

    it("crea una aplicación Belzium", () => {

        @Component()
        class App {

            render() {
                return h(
                    "div",
                    null,
                    [
                        text("Hello Belzium"),
                    ],
                );
            }
        }

        const app =
            createApp(App);

        expect(app)
            .toBeDefined();

        expect(app.context)
            .toBeDefined();
    });


    it("monta el componente raíz", () => {

        document.body.innerHTML =
            `<div id="app"></div>`;


        @Component()
        class App {

            render() {
                return h(
                    "div",
                    null,
                    [
                        text("Hello Belzium"),
                    ],
                );
            }
        }


        const app =
            createApp(App);

        app.mount("#app");


        const element =
            document.querySelector("#app");


        expect(element?.innerHTML)
            .toBe(
                "<div>Hello Belzium</div>"
            );
    });


    it("acepta un Element directamente", () => {

        const root =
            document.createElement("div");


        @Component()
        class App {

            render() {
                return h(
                    "span",
                    null,
                    [
                        text("Belzium"),
                    ],
                );
            }
        }


        const app =
            createApp(App);

        app.mount(root);


        expect(root.innerHTML)
            .toBe(
                "<span>Belzium</span>"
            );
    });


    it("rechaza un selector inexistente", () => {

        @Component()
        class App {

            render() {
                return h("div");
            }
        }


        const app =
            createApp(App);


        expect(() => {
            app.mount("#does-not-exist");
        }).toThrow(
            "Mount target not found"
        );
    });


    it("no permite montar dos veces", () => {

        document.body.innerHTML =
            `<div id="app"></div>`;


        @Component()
        class App {

            render() {
                return h("div");
            }
        }


        const app =
            createApp(App);


        app.mount("#app");


        expect(() => {
            app.mount("#app");
        }).toThrow(
            "Application is already mounted"
        );
    });


    it("permite desmontar la aplicación", () => {

        document.body.innerHTML =
            `<div id="app"></div>`;


        @Component()
        class App {

            render() {
                return h(
                    "div",
                    null,
                    [
                        text("Hello"),
                    ],
                );
            }
        }


        const app =
            createApp(App);


        app.mount("#app");

        app.unmount();


        const element =
            document.querySelector("#app");


        expect(element?.innerHTML)
            .toBe("");
    });
it("detiene el efecto reactivo al desmontar", () => {

    document.body.innerHTML =
        `<div id="app"></div>`;

    @Component()
    class App {

        count = ref(0);

        render() {
            return h(
                "div",
                null,
                [
                    text(
                        String(this.count.value)
                    ),
                ],
            );
        }
    }

    const app =
        createApp(App);

    app.mount("#app");

    const element =
        document.querySelector("#app");

    expect(element?.textContent)
        .toBe("0");

    app.unmount();

    expect(element?.innerHTML)
        .toBe("");
});
it("detiene la reactividad del componente al desmontar", () => {

    document.body.innerHTML =
        `<div id="app"></div>`;

    let renderCount = 0;

    @Component()
    class App {

        count = ref(0);

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
                ],
            );
        }
    }

    const app =
        createApp(App);

    app.mount("#app");

    // El render inicial debe ejecutarse
    // exactamente una vez.
    expect(renderCount)
        .toBe(1);


    // Recuperamos la instancia creada
    // por el ApplicationContext.
    const instance =
        app.context.resolve(App);


    // El componente está montado,
    // por lo que cambiar el Ref
    // debe provocar otro render.
    instance.count.value = 1;

    expect(renderCount)
        .toBe(2);


    const element =
        document.querySelector("#app");

    expect(element?.textContent)
        .toBe("1");


    // Desmontamos la aplicación.
    app.unmount();


    // Guardamos el número de renders
    // después del desmontaje.
    const rendersAfterUnmount =
        renderCount;


    // Cambiar el estado después de unmount
    // NO debe volver a ejecutar render().
    instance.count.value = 2;


    expect(renderCount)
        .toBe(rendersAfterUnmount);


    // El DOM debe permanecer desmontado.
    expect(element?.innerHTML)
        .toBe("");
});
});