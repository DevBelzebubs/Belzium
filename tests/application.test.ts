import {
    describe,
    expect,
    it
} from "vitest";
import { Application, createApplication } from "../src/core/application";
import { Service } from "../src/di/decorators";
import { ApplicationContext } from "../src/di/applicationContext";




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

});