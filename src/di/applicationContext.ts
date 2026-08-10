import { componentToProvider } from "./metadata";
import { Provider } from "./provider";
import { Scope } from "./scope";
import type { InjectionToken } from "./token";

export class ApplicationContext {

    // =========================================================
    // REGISTRO BY JD (ING. DIBUJITO)
    // =========================================================
    private providers =
        new Map<InjectionToken, Provider>();
    // Instancias creadas dentro de ESTE contexto

    // Se utiliza principalmente para SCOPED

    // SINGLETON utiliza el instances del contexto raíz
    // TRANSIENT no utiliza ningún cache
    private instances = new Map<InjectionToken, unknown>();

    // =========================================================
    // RESOLUCIÓN
    // =========================================================

    // Tokens que actualmente están siendo resueltos

    // Sirve para detectar dependencias circulares:

    // A -> B -> A

    // En lugar de provocar una recursión infinita,
    // lanzamos Circular dependency detected
    private resolving = new Set<InjectionToken>();


    // =========================================================
    // CONTEXTO
    // =========================================================

    // Si existe parent, este contexto es un contexto hijo

    // Esto permite:

    // RootContext
    //      |
    //      ├── ChildContext
    //      |
    //      └── ChildContext

    // Los hijos pueden acceder a providers de sus padres
    constructor(
        private parent?: ApplicationContext
    ) {}


    // =========================================================
    // REGISTRO DE PROVIDERS
    // =========================================================

    // Registra directamente un valor

    // Ejemplo:

    // context.register(API_URL, "/api");

    // Internamente se transforma en un ValueProvider.
    register<T>(token: InjectionToken<T>,value: T): void {
        this.providers.set(token, {token,useValue: value});
    }

    // Registra una definición de provider

    // context.registerProvider({
    //     token: UserService,
    //     useClass: UserService
    // });
    registerProvider<T>(provider: Provider<T>): void {
        this.providers.set(provider.token,provider);
    }


    // =========================================================
    // CONTEXTOS HIJOS
    // =========================================================

    // Crea un nuevo contexto hijo

    // El hijo puede acceder a providers registrados
    // en este contexto y en sus ancestros

    // Se utilizará posteriormente para implementar
    // scopes asociados al árbol de componentes
    createScope(): ApplicationContext {
        return new ApplicationContext(this);
    }


    // =========================================================
    // BÚSQUEDA DE PROVIDERS
    // =========================================================

    // Busca un provider comenzando por el contexto actual
    //
    // Si no existe aquí, sube por la cadena de padres:

    // Child
    //   |
    //   ▼
    // Parent
    //   |
    //   ▼
    // Root

    // Importante:
    // buscar un provider NO significa crear su instancia
    private findProvider(token: InjectionToken): Provider | undefined {

        const provider = this.providers.get(token);

        if (provider) return provider;
        
        return this.parent?.findProvider(token);
    }


    // =========================================================
    // CONTEXTO RAÍZ
    // =========================================================

    // Obtiene el contexto raíz.

    // Los SINGLETON pertenecen al root,
    // independientemente de dónde se haga resolve().

    // Ejemplo:

    // root.resolve(Service)
    // child.resolve(Service)

    // Ambos reciben la misma instancia singleton.
    private getRoot(): ApplicationContext {

        if (!this.parent) return this;
        

        return this.parent.getRoot();
    }
    // =========================================================
    // SCOPE
    // =========================================================

    // Obtiene el scope de un provider.

    // Si no se especifica scope, utilizamos SINGLETON como comportamiento por defecto.

    // ValueProvider también se considera SINGLETON, representa un valor ya creado
    private getScope(token: InjectionToken): Scope {
        const provider = this.findProvider(token);
        if (!provider) { throw new Error(`No provider found for token`);
        }

        if ("useValue" in provider) {
            return Scope.SINGLETON;
        }

        return provider.scope ?? Scope.SINGLETON;
    }
    private validateDependencyScope(ownerToken: InjectionToken,ownerScope: Scope,dependencyToken: InjectionToken): void {
        const dependencyScope = this.getScope(dependencyToken);
        if (ownerScope === Scope.SINGLETON && dependencyScope === Scope.SCOPED){
            throw new Error(`Invalid dependency scope: ` + `SINGLETON provider cannot depend on SCOPED provider`);
        }
    }


    // =========================================================
    // RESOLUCIÓN DE DEPENDENCIAS
    // =========================================================

    // Resuelve un token

    // Flujo general:

    // resolve(Token)
    //       |
    //       ▼
    // buscar Provider
    //       |
    //       ▼
    // determinar Scope
    //       |
    //       ├── SINGLETON -> cache del Root
    //       |
    //       ├── SCOPED    -> cache del contexto actual
    //       |
    //       └── TRANSIENT -> no utiliza cache
    //       |
    //       ▼
    // resolver dependencias
    //       |
    //       ▼
    // createInstance()
    //       |
    //       ▼
    // guardar instancia según Scope
    //       |
    //       ▼
    // devolver instancia
    resolve<T>(token: InjectionToken<T>): T {

        // -----------------------------------------------------
        // 1. Buscar el provider
        // -----------------------------------------------------

        const provider = this.findProvider(token);

        if (!provider) {throw new Error(`No provider found for token`);
        }


        // -----------------------------------------------------
        // 2. ValueProvider
        // -----------------------------------------------------

        // Los valores ya están creados.
        if ("useValue" in provider) {
            return provider.useValue as T;
        }


        // -----------------------------------------------------
        // 3. Determinar Scope
        // -----------------------------------------------------

        const scope = this.getScope(token);

        // -----------------------------------------------------
        // 4. Buscar instancia Singleton
        // -----------------------------------------------------

        // Los SINGLETON se almacenan en el RootContext
        if (scope === Scope.SINGLETON) {
            const root = this.getRoot();

            const existing = root.instances.get(token);

            if (existing) return existing as T;
            
        }


        // -----------------------------------------------------
        // 5. Buscar instancia Scoped
        // -----------------------------------------------------

        // Los SCOPED pertenecen al contexto actual.
        if (scope === Scope.SCOPED) {
            const existing = this.instances.get(token);

            if (existing) return existing as T;
            
        }


        // -----------------------------------------------------
        // 6. Detectar dependencia circular
        // -----------------------------------------------------

        // Ejemplo:

        // A -> B -> A

        // Cuando intentemos resolver A por segunda vez, el token ya estará dentro de resolving
        if (this.resolving.has(token)) {
            throw new Error(`Circular dependency detected`);
        }

        this.resolving.add(token);

        try {

            // -------------------------------------------------
            // 7. Crear instancia
            // -------------------------------------------------

            const instance =this.createInstance(token,provider);


            // -------------------------------------------------
            // 8. Guardar según Scope
            // -------------------------------------------------

            // SINGLETON -> RootContext
            if (scope === Scope.SINGLETON) {

                const root = this.getRoot();

                root.instances.set(token,instance);
            }


            // SCOPED -> contexto actual
            if (scope === Scope.SCOPED) {

                this.instances.set(token,instance);
            }


            // TRANSIENT no se almacena

            // -------------------------------------------------
            // 9. Devolver instancia
            // -------------------------------------------------

            return instance as T;

        } finally {

            // Independientemente de si la resolución tuvo éxito o lanzó un error, eliminamos el token del stack de resolución
            this.resolving.delete(token);
        }
    }


    // =========================================================
    // CREACIÓN DE INSTANCIAS
    // =========================================================

    // Construye una instancia de un ClassProvider

    // Ejemplo:

    // UserService(
    //     UserRepository,
    //     Logger
    // )

    // Primero resuelve:

    // UserRepository
    // Logger

    // Y posteriormente ejecuta:

    // new UserService(
    //     repository,
    //     logger
    // )
    private createInstance<T>(token: InjectionToken<T>,provider: Extract<Provider<T>,{ useClass: unknown }>): T {
        const dependencies = provider.dependencies ?? [];
        const ownerScope = provider.scope ?? Scope.SINGLETON;
        // Resolver recursivamente cada dependencia.
        const resolvedDependencies =
        dependencies.map(
            dependency => {this.validateDependencyScope(token,ownerScope,dependency);
                return this.resolve(dependency);
            }
        );
        // Crear la instancia utilizando
        // las dependencias resueltas
        return new provider.useClass(...resolvedDependencies);
    }
    // =========================================================
    // EXISTENCIA DEL PROVIDER
    // =========================================================

    // Comprueba si existe un provider en este contexto
    has(token: InjectionToken): boolean {
        if (this.providers.has(token)) return true;
        return this.parent?.has(token) ?? false;
    }
    registerComponent<T>(target: new (...args: any[]) => T): void {
        const provider = componentToProvider(target);
        this.registerProvider(provider);
    }
    registerComponents(components: Array<new (...args: any[]) => any>): void{
        for (const component of components) {
            this.registerComponent(component);
        }
    }
}