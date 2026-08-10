# Belzium

Framework de frontend minimalista en TypeScript: **reactividad**, **componentes** y **DI** (inversión de control), sin dependencias de runtime.

- [Español](#espa%C3%B1ol)
- [English](#english)

---

## Español

### Características

- **Reactividad (estilo Vue):**
  - `reactive()`: proxies reactivos sobre objetos y colecciones (`Map`, `Set`, arrays).
  - `ref()`: variables reactivas individuales con desempaquetado automático.
  - `computed()`: valores derivados con caché y recálculo perezoso.
  - `effect()`, `watch()`, `watchEffect()`: efectos que reaccionan a los cambios.
  - `toRaw()`, `toReactive()`, `RAW`: conversión entre objetos crudos y reactivos.
  - Scheduler con cola de jobs y deduplicación (`flush: "sync" | "pre"`).
- **Componentes:**
  - `createComponentInstance()`, `setupComponent()`: ciclo de vida de una instancia.
  - `setup(props, { emit })`: función de configuración de cada componente.
  - Proxy público con desempaquetado de `ref`.
  - `provide()` / `inject()`: valores compartidos entre ancestros y descendientes.
  - `emit`: eventos hacia el componente padre (`onXxx`).
- **DI / IoC:**
  - `createApplication({ providers })`: arranque de la app con registro automático.
  - `@Service({ scope, dependencies })`: marca una clase como componente gestionado.
  - `ApplicationContext`: `register`, `registerProvider`, `registerComponent`, `createScope`, `resolve`, `has`.
  - Scopes: `SINGLETON` (por defecto), `TRANSIENT`, `SCOPED`.
  - Contextos hijo (scopes) que heredan providers de sus ancestros.
  - Detección de dependencias circulares y validación de scope.

### Requisitos

- Node.js 22+.
- TypeScript con **decoradores estándar (TC39)** — esbuild los baja usando `esbuild.target` configurado en `vitest.config.ts`.

### Empezar

```bash
npm install
npm test          # ejecuta la suite (104 tests / 14 archivos)
```

Ejecutar el ejemplo:

```bash
npx vite-node --config vitest.config.ts examples/basic-di.ts
```

Salida esperada:

```
[APP] Hola desde Belzium
```

### Ejemplo

```ts
import { createApplication } from "../src/core/application";
import { Service } from "../src/di/decorators";

@Service()
class Logger {
    log(message: string) {
        console.log(`[APP] ${message}`);
    }
}

@Service({
    dependencies: [Logger]
})
class UserService {
    constructor(private logger: Logger) {}
    hello() {
        this.logger.log("Hola desde Belzium");
    }
}

const app = createApplication({ providers: [Logger, UserService] });
const users = app.resolve(UserService);
users.hello();
```

### API

#### Reactividad

```ts
import { reactive, ref, computed, effect, watch, watchEffect, toRaw, isRef } from "./src/index";

const state = reactive({ count: 0 });
const num = ref(0);
const doubled = computed(() => num.value * 2);

effect(() => console.log(state.count));
watch(() => state.count, (next, prev) => console.log(next, prev));
watchEffect(() => console.log(num.value));
```

#### Componentes

```ts
import { createComponentInstance, setupComponent, provide, inject, getCurrentInstance } from "./src/index";

const component = {
    setup(props, { emit }) {
        const instance = getCurrentInstance();
        provide("theme", "dark");
        const theme = inject("theme", "light");
        emit("update", 1);
        return { theme };
    }
};

const instance = createComponentInstance(component, { onUpdate: (n) => console.log(n) });
setupComponent(instance);
```

#### DI

```ts
import { createApplication } from "./src/core/application";
import { Service } from "./src/di/decorators";
import { Scope } from "./src/di/scope";

@Service({ scope: Scope.SINGLETON, dependencies: [Logger] })
class UserService {
    constructor(private logger: Logger) {}
}

const app = createApplication({ providers: [UserService] });
const service = app.resolve(UserService);
```

Registro programático sin decoradores:

```ts
import { ApplicationContext } from "./src/di/applicationContext";

const context = new ApplicationContext();
context.registerProvider({
    token: UserService,
    useClass: UserService,
    dependencies: [Logger]
});
context.register(API_URL, "/api");       // ValueProvider
const child = context.createScope();      // contexto hijo (SCOPED)
```

Errores del contenedor:

- `No provider found for token`
- `Circular dependency detected`
- `SINGLETON provider cannot depend on SCOPED provider`

### Estructura del proyecto

```
src/
  reactive/      Sistema reactivo (proxies, refs, efectos, watch, scheduler)
  component/     Sistema de componentes (instancia, setup, provide/inject)
  di/            Inyección de dependencias (ApplicationContext, @Service, scopes)
  core/          Application / createApplication
  index.ts       API pública (reactividad y componentes)
tests/           Suites de tests (vitest)
examples/        Ejemplos ejecutables
```

> Nota: el DI aún no está re-exportado en `index.ts`; se importa directamente desde `src/di/` (en desarrollo).

### Tests

```bash
npx vitest run
```

---

## English

### Features

- **Reactivity (Vue-style):**
  - `reactive()`: reactive proxies over objects and collections (`Map`, `Set`, arrays).
  - `ref()`: single reactive values with automatic unwrapping.
  - `computed()`: derived values with caching and lazy recalculation.
  - `effect()`, `watch()`, `watchEffect()`: effects that react to changes.
  - `toRaw()`, `toReactive()`, `RAW`: conversion between raw and reactive objects.
  - Scheduler with a job queue and deduplication (`flush: "sync" | "pre"`).
- **Components:**
  - `createComponentInstance()`, `setupComponent()`: instance lifecycle.
  - `setup(props, { emit })`: configuration function per component.
  - Public proxy with `ref` unwrapping.
  - `provide()` / `inject()`: values shared between ancestors and descendants.
  - `emit`: events to the parent component (`onXxx`).
- **DI / IoC:**
  - `createApplication({ providers })`: app bootstrap with automatic registration.
  - `@Service({ scope, dependencies })`: marks a class as a managed component.
  - `ApplicationContext`: `register`, `registerProvider`, `registerComponent`, `createScope`, `resolve`, `has`.
  - Scopes: `SINGLETON` (default), `TRANSIENT`, `SCOPED`.
  - Child contexts (scopes) inheriting providers from their ancestors.
  - Circular dependency detection and scope validation.

### Requirements

- Node.js 22+.
- TypeScript with **standard decorators (TC39)** — esbuild lowers them using the `esbuild.target` set in `vitest.config.ts`.

### Getting started

```bash
npm install
npm test          # runs the suite (104 tests / 14 files)
```

Run the example:

```bash
npx vite-node --config vitest.config.ts examples/basic-di.ts
```

Expected output:

```
[APP] Hola desde Belzium
```

### Example

```ts
import { createApplication } from "../src/core/application";
import { Service } from "../src/di/decorators";

@Service()
class Logger {
    log(message: string) {
        console.log(`[APP] ${message}`);
    }
}

@Service({
    dependencies: [Logger]
})
class UserService {
    constructor(private logger: Logger) {}
    hello() {
        this.logger.log("Hello from Belzium");
    }
}

const app = createApplication({ providers: [Logger, UserService] });
const users = app.resolve(UserService);
users.hello();
```

### API

#### Reactivity

```ts
import { reactive, ref, computed, effect, watch, watchEffect, toRaw, isRef } from "./src/index";

const state = reactive({ count: 0 });
const num = ref(0);
const doubled = computed(() => num.value * 2);

effect(() => console.log(state.count));
watch(() => state.count, (next, prev) => console.log(next, prev));
watchEffect(() => console.log(num.value));
```

#### Components

```ts
import { createComponentInstance, setupComponent, provide, inject, getCurrentInstance } from "./src/index";

const component = {
    setup(props, { emit }) {
        const instance = getCurrentInstance();
        provide("theme", "dark");
        const theme = inject("theme", "light");
        emit("update", 1);
        return { theme };
    }
};

const instance = createComponentInstance(component, { onUpdate: (n) => console.log(n) });
setupComponent(instance);
```

#### DI

```ts
import { createApplication } from "./src/core/application";
import { Service } from "./src/di/decorators";
import { Scope } from "./src/di/scope";

@Service({ scope: Scope.SINGLETON, dependencies: [Logger] })
class UserService {
    constructor(private logger: Logger) {}
}

const app = createApplication({ providers: [UserService] });
const service = app.resolve(UserService);
```

Programmatic registration without decorators:

```ts
import { ApplicationContext } from "./src/di/applicationContext";

const context = new ApplicationContext();
context.registerProvider({
    token: UserService,
    useClass: UserService,
    dependencies: [Logger]
});
context.register(API_URL, "/api");       // ValueProvider
const child = context.createScope();      // child context (SCOPED)
```

Container errors:

- `No provider found for token`
- `Circular dependency detected`
- `SINGLETON provider cannot depend on SCOPED provider`

### Project structure

```
src/
  reactive/      Reactive system (proxies, refs, effects, watch, scheduler)
  component/     Component system (instance, setup, provide/inject)
  di/            Dependency injection (ApplicationContext, @Service, scopes)
  core/          Application / createApplication
  index.ts       Public API (reactivity and components)
tests/           Test suites (vitest)
examples/        Runnable examples
```

> Note: the DI is not yet re-exported from `index.ts`; it is imported directly from `src/di/` (work in progress).

### Tests

```bash
npx vitest run
```
