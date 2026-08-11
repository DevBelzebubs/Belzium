import { Configuration } from "../src";
import { createApplication } from "../src/core/application";
import { Service } from "../src/di/decorators";

@Service()
class Logger {
    log(message: string) {
        console.log(
            `[APP] ${message}`
        );
    }
}
@Service({
    dependencies: [
        Logger
    ]
})
class UserService{
    constructor(private logger: Logger) {}
    hello() {
        this.logger.log("Hola desde Belzium");
    }
}
const app = createApplication({providers: [Logger,UserService]});
const users = app.resolve(UserService);
users.hello();