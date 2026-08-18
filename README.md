# Belzium (Alpha)

Framework frontend minimalista en TypeScript con compiler propio (`.bel`), reactividad, componentes, DI/IoC y extensión VSCode — cero dependencias de runtime.

- [Español](#español)
- [English](#english)

---

## Español

### Características

- **Reactividad (estilo Vue):**
  - `reactive()`: proxies reactivos sobre objetos y colecciones (`Map`, `Set`, arrays).
  - `ref()`: variables reactivas individuales con desempaquetado automático.
  - `computed()`: valores derivados con caché y recálculo perezoso.
  - `effect()`, `watch()`, `watchEffect()`: efectos que reaccionan a los cambios.
  - `toRaw()`, `toReactive()`: conversión entre objetos crudos y reactivos.
  - Scheduler con cola de jobs y deduplicación (`flush: "sync" | "pre"`).
- **Componentes:**
  - `@Component()`, `@UI()`: decoradores para declarar componentes.
  - `setup(props, { emit })`: función de configuración de cada componente.
  - Proxy público con desempaquetado de `ref`.
  - `provide()` / `inject()`: valores compartidos entre ancestros y descendientes.
  - `useSlots()`: acceso al contenido de slots.
  - `input()` / `output()`: props reactivas y emisión de eventos al padre.
  - Lifecycle: `onMounted()`, `onUnmounted()`, `onUpdated()`.
- **DI / IoC:**
  - `createApplication({ providers })`: arranque de la app con registro automático.
  - `@Service({ scope, dependencies })`: marca una clase como componente gestionado.
  - `@Configuration()` / `@Bean()`: configuración declarativa estilo Spring.
  - `ApplicationContext`: `register`, `registerProvider`, `registerComponent`, `createScope`, `resolve`, `has`.
  - Scopes: `SINGLETON` (por defecto), `TRANSIENT`, `SCOPED`.
  - Detección de dependencias circulares y validación de scope.
- **Stores (estado global reactivo):**
  - `@Store()`: marca una clase como store global sin IoC.
  - `useStore(StoreClass)`: retorna una instancia singleton reactiva.
  - `resetStores()`: limpia todas las instancias (útil en tests).
- **Hooks (lógica reutilizable):**
  - `@Hook()`: marca una clase como hook de componentes.
  - `useHook(HookClass)`: crea una instancia nueva por componente consumidor.
  - Sus métodos `onMounted`/`onUnmounted` se enlazan al ciclo de vida del componente.
- **Directivas personalizadas:**
  - `@Directive()`: marca una clase como directiva reutilizable en templates.
  - Uso en `.bel`: `@clickable (enabled) { ... }` compila a `h(Clickable, { enabled }, [...])`.
- **Compiler `.bel` → TypeScript:**
  - JSX a llamadas `h()` / `text()`.
  - `@if` / `@else` / `@else if` a expresiones ternarias.
  - `@for (item of items; key)` a `.map()` con VNodes keyados.
  - `@switch` / `@case` / `@default` a IIFE con `switch`.
  - Directivas custom PascalCase a componentes.
  - Auto-inyección de imports del runtime.
- **Extensión VSCode:**
  - Syntax highlighting para `.bel` (decoradores, directivas, keywords).
  - IntelliSense: completions, hover, go-to-definition.
  - Diagnostics (syntactic + semantic).
  - Semantic tokens y folding ranges.
- **VNodes:**
  - `h()`, `text()`, `createTextVNode()`.
  - Diffing y patching de árbol virtual.
  - `isSameVNode()` para comparación por tipo + key.

### Requisitos

- Node.js 22+.
- TypeScript con **decoradores estándar (TC39)**.

### Empezar rápido

```bash
npm install
npm test          # ejecuta la suite (337 tests / 36 archivos)
```

### Ejemplos

#### Componente `.bel`

```bel
@import { ref } from "belzium";

@Component()
class Counter {
  count = ref(0);
  items = [1, 2, 3];

  template() {
    return (
      <div>
        <h1>Conteo: {this.count.value}</h1>
        @if (this.count.value >= 3) {
          <p>Grande</p>
        } @else {
          <p>Pequeño</p>
        }
        <ul>
          @for (n of this.items; n) {
            <li>Item {n}</li>
          }
        </ul>
        <button onClick={() => this.count.value++}>+1</button>
      </div>
    );
  }
}
```

#### Equivalente en TypeScript

```ts
import { Component, ref, h, text, createApp } from "belzium";

@Component()
class Counter {
  count = ref(0);
  items = [1, 2, 3];

  render() {
    return h("div", null, [
      h("h1", null, [text(`Conteo: ${this.count.value}`)]),
      ...(this.count.value >= 3
        ? [h("p", null, [text("Grande")])]
        : [h("p", null, [text("Pequeño")])]),
      h("ul", null, [
        ...this.items.map((n) =>
          h("li", { key: n }, [text(`Item ${n}`)])
        ),
      ]),
      h("button", { onClick: () => this.count.value++ }, [text("+1")]),
    ]);
  }
}

createApp(Counter).mount(document.body);
```

### API

#### Reactividad

```ts
import { reactive, ref, computed, effect, watch, watchEffect, toRaw, isRef } from "belzium";

const state = reactive({ count: 0 });
const num = ref(0);
const doubled = computed(() => num.value * 2);

effect(() => console.log(state.count));
watch(() => state.count, (next, prev) => console.log(next, prev));
watchEffect(() => console.log(num.value));
```

#### Componentes

```ts
import {
  Component, createComponentInstance, setupComponent,
  getCurrentInstance, provide, inject, useSlots,
  onMounted, onUnmounted, onUpdated,
} from "belzium";

@Component()
class MyComponent {
  theme = "dark";

  render() {
    return h("div", null, [text(this.theme)]);
  }
}
```

#### DI / IoC

```ts
import { createApp, Service, Configuration, Bean, ApplicationContext } from "belzium";

@Service()
class Logger {
  log(msg: string) { console.log(`[APP] ${msg}`); }
}

@Service({ dependencies: [Logger] })
class UserService {
  constructor(private logger: Logger) {}
  hello() { this.logger.log("Hola desde Belzium"); }
}

// Con createApp (runtime):
const app = createApp(MyRootComponent);
app.mount(document.body);

// Con createApplication (solo DI):
const ctx = new ApplicationContext();
ctx.registerProvider({ useClass: UserService, dependencies: [Logger] });
const users = ctx.resolve(UserService);
```

#### Stores

```ts
import { Store, useStore, resetStores, ref } from "belzium";

@Store()
class CounterStore {
  count = ref(0);
}

// En cualquier componente:
const store = useStore(CounterStore);
store.count.value++; // reactiva, re-renderiza componentes que la lean

// En tests:
resetStores();
```

#### Hooks

```ts
import { Hook, useHook, onMounted, ref } from "belzium";

@Hook()
class Timer {
  elapsed = ref(0);
  onMounted() { /* se ejecuta al montar el componente consumidor */ }
  onUnmounted() { /* se ejecuta al desmontar */ }
}

// Dentro de un componente:
const timer = useHook(Timer);
console.log(timer.elapsed.value);
```

#### Directivas

```ts
import { Directive, h, text } from "belzium";

@Directive()
class Clickable {
  props!: Readonly<{ enabled?: boolean }>;

  render() {
    return h("button", null, [text(String(this.props.enabled))]);
  }
}
```

Uso en template `.bel`: `@clickable (this.isEnabled) { <span>Click</span> }`

#### VNodes

```ts
import { h, text, createTextVNode, isSameVNode } from "belzium";

const vnode = h("div", { class: "card" }, [
  text("Hello"),
  h("span", null, [text("World")]),
]);

isSameVNode(vnode, h("div", null, [])); // true (mismo tipo, sin key)
```

### Compiler `.bel`

El compiler transforma archivos `.bel` (TypeScript + JSX + directivas Belzium) en TypeScript válido:

| Sintaxis `.bel` | Salida |
|-----------------|--------|
| `<div>` | `h("div", null, [...])` |
| `<UserCard />` | `h(UserCard, null, [...])` |
| `{expr}` | `text(String(expr))` |
| `@if (c) { ... } @else { ... }` | `...((c) ? [...] : [...])` |
| `@for (n of items; key) { ... }` | `...items.map((n) => h(..., { key }, [...]))` |
| `@switch (e) { @case ("v") {...} }` | IIFE con `switch` |
| `@clickable (p) { ... }` | `h(Clickable, { p }, [...])` |

Uso:

```ts
import { compile } from "belzium/compiler";

const ts = compile(belSource, { importPath: "belzium" });
```

### Extensión VSCode

La extensión para `.bel` se encuentra en `tools/belzium-language/`.

**Instalación:**

```bash
cd tools/belzium-language
npm install
npm run build
# Copiar la carpeta resultante a ~/.vscode/extensions/
```

**Features:**
- Syntax highlighting con TextMate grammar.
- Completions de directivas (`@if`, `@for`, `@switch`, ...) e IntelliSense completo.
- Hover con tipo inferido.
- Go-to-definition entre archivos `.bel`.
- Diagnostics (syntactic + semantic) con debounce.
- Semantic tokens y folding ranges.

### Estructura del proyecto

```
src/
  reactive/        Reactividad (proxies, refs, efectos, scheduler)
  component/       Componentes (decoradores, lifecycle, slots, I/O, hooks, directives)
  di/              DI/IoC (ApplicationContext, @Service, scopes, tokens)
  runtime/         Runtime (createApp, VNodes, renderers)
  compiler.ts      Compiler .bel → TypeScript
  tsxTransform.ts  Transform .bel → TSX para soporte IDE
  store.ts         @Store (estado global reactivo)
  index.ts         API pública
tools/
  belzium-language/  Extensión VSCode para .bel
tests/               337 tests (36 archivos)
docs/                Language spec + compiler architecture
```

### Scripts

```bash
npm test                  # ejecutar tests
npm run typecheck         # verificar tipos
npm run build:types       # generar archivos .d.ts
npm run build:language    # compilar extensión VSCode
npm run typecheck:language # verificar tipos de la extensión
```

### Tests

```bash
npx vitest run
```

337 tests cubriendo: reactividad, componentes, DI/IoC, stores, hooks, directivas, compiler, language service.

---

## English

### Features

- **Reactivity (Vue-style):**
  - `reactive()`: reactive proxies over objects and collections (`Map`, `Set`, arrays).
  - `ref()`: single reactive values with automatic unwrapping.
  - `computed()`: derived values with caching and lazy recalculation.
  - `effect()`, `watch()`, `watchEffect()`: effects that react to changes.
  - `toRaw()`, `toReactive()`: conversion between raw and reactive objects.
  - Scheduler with job queue and deduplication (`flush: "sync" | "pre"`).
- **Components:**
  - `@Component()`, `@UI()`: decorators for declaring components.
  - `setup(props, { emit })`: configuration function per component.
  - Public proxy with `ref` unwrapping.
  - `provide()` / `inject()`: values shared between ancestors and descendants.
  - `useSlots()`: slot content access.
  - `input()` / `output()`: reactive props and event emission to parent.
  - Lifecycle: `onMounted()`, `onUnmounted()`, `onUpdated()`.
- **DI / IoC:**
  - `createApplication({ providers })`: app bootstrap with automatic registration.
  - `@Service({ scope, dependencies })`: marks a class as a managed component.
  - `@Configuration()` / `@Bean()`: Spring-style declarative configuration.
  - `ApplicationContext`: `register`, `registerProvider`, `registerComponent`, `createScope`, `resolve`, `has`.
  - Scopes: `SINGLETON` (default), `TRANSIENT`, `SCOPED`.
  - Circular dependency detection and scope validation.
- **Stores (global reactive state):**
  - `@Store()`: marks a class as a global non-IoC store.
  - `useStore(StoreClass)`: returns a reactive singleton instance.
  - `resetStores()`: clears all live instances (useful in tests).
- **Hooks (reusable lifecycle logic):**
  - `@Hook()`: marks a class as a component hook.
  - `useHook(HookClass)`: creates a new instance per consuming component.
  - Its `onMounted`/`onUnmounted` methods bind to the consumer's lifecycle.
- **Custom Directives:**
  - `@Directive()`: marks a class as a reusable template directive.
  - Usage in `.bel`: `@clickable (enabled) { ... }` compiles to `h(Clickable, { enabled }, [...])`.
- **`.bel` Compiler → TypeScript:**
  - JSX to `h()` / `text()` calls.
  - `@if` / `@else` / `@else if` to ternary expressions.
  - `@for (item of items; key)` to `.map()` with keyed VNodes.
  - `@switch` / `@case` / `@default` to IIFE with `switch`.
  - PascalCase custom directives to components.
  - Auto-injection of runtime imports.
- **VSCode Extension:**
  - Syntax highlighting for `.bel` (decorators, directives, keywords).
  - IntelliSense: completions, hover, go-to-definition.
  - Diagnostics (syntactic + semantic).
  - Semantic tokens and folding ranges.
- **VNodes:**
  - `h()`, `text()`, `createTextVNode()`.
  - Virtual tree diffing and patching.
  - `isSameVNode()` for type + key comparison.

### Requirements

- Node.js 22+.
- TypeScript with **standard decorators (TC39)**.

### Getting started

```bash
npm install
npm test          # runs the suite (337 tests / 36 files)
```

### Examples

#### `.bel` component

```bel
@import { ref } from "belzium";

@Component()
class Counter {
  count = ref(0);
  items = [1, 2, 3];

  template() {
    return (
      <div>
        <h1>Count: {this.count.value}</h1>
        @if (this.count.value >= 3) {
          <p>Big</p>
        } @else {
          <p>Small</p>
        }
        <ul>
          @for (n of this.items; n) {
            <li>Item {n}</li>
          }
        </ul>
        <button onClick={() => this.count.value++}>+1</button>
      </div>
    );
  }
}
```

#### TypeScript equivalent

```ts
import { Component, ref, h, text, createApp } from "belzium";

@Component()
class Counter {
  count = ref(0);
  items = [1, 2, 3];

  render() {
    return h("div", null, [
      h("h1", null, [text(`Count: ${this.count.value}`)]),
      ...(this.count.value >= 3
        ? [h("p", null, [text("Big")])]
        : [h("p", null, [text("Small")])]),
      h("ul", null, [
        ...this.items.map((n) =>
          h("li", { key: n }, [text(`Item ${n}`)])
        ),
      ]),
      h("button", { onClick: () => this.count.value++ }, [text("+1")]),
    ]);
  }
}

createApp(Counter).mount(document.body);
```

### API

#### Reactivity

```ts
import { reactive, ref, computed, effect, watch, watchEffect, toRaw, isRef } from "belzium";

const state = reactive({ count: 0 });
const num = ref(0);
const doubled = computed(() => num.value * 2);

effect(() => console.log(state.count));
watch(() => state.count, (next, prev) => console.log(next, prev));
watchEffect(() => console.log(num.value));
```

#### Components

```ts
import {
  Component, createComponentInstance, setupComponent,
  getCurrentInstance, provide, inject, useSlots,
  onMounted, onUnmounted, onUpdated,
} from "belzium";

@Component()
class MyComponent {
  theme = "dark";

  render() {
    return h("div", null, [text(this.theme)]);
  }
}
```

#### DI / IoC

```ts
import { createApp, Service, Configuration, Bean, ApplicationContext } from "belzium";

@Service()
class Logger {
  log(msg: string) { console.log(`[APP] ${msg}`); }
}

@Service({ dependencies: [Logger] })
class UserService {
  constructor(private logger: Logger) {}
  hello() { this.logger.log("Hello from Belzium"); }
}

// With createApp (runtime):
const app = createApp(MyRootComponent);
app.mount(document.body);

// With createApplication (DI only):
const ctx = new ApplicationContext();
ctx.registerProvider({ useClass: UserService, dependencies: [Logger] });
const users = ctx.resolve(UserService);
```

#### Stores

```ts
import { Store, useStore, resetStores, ref } from "belzium";

@Store()
class CounterStore {
  count = ref(0);
}

// In any component:
const store = useStore(CounterStore);
store.count.value++; // reactive, re-renders consuming components

// In tests:
resetStores();
```

#### Hooks

```ts
import { Hook, useHook, onMounted, ref } from "belzium";

@Hook()
class Timer {
  elapsed = ref(0);
  onMounted() { /* runs when the consuming component mounts */ }
  onUnmounted() { /* runs when it unmounts */ }
}

// Inside a component:
const timer = useHook(Timer);
console.log(timer.elapsed.value);
```

#### Directives

```ts
import { Directive, h, text } from "belzium";

@Directive()
class Clickable {
  props!: Readonly<{ enabled?: boolean }>;

  render() {
    return h("button", null, [text(String(this.props.enabled))]);
  }
}
```

Usage in `.bel` template: `@clickable (this.isEnabled) { <span>Click</span> }`

#### VNodes

```ts
import { h, text, createTextVNode, isSameVNode } from "belzium";

const vnode = h("div", { class: "card" }, [
  text("Hello"),
  h("span", null, [text("World")]),
]);

isSameVNode(vnode, h("div", null, [])); // true (same type, no key)
```

### `.bel` Compiler

The compiler transforms `.bel` files (TypeScript + JSX + Belzium directives) into valid TypeScript:

| `.bel` Syntax | Output |
|---------------|--------|
| `<div>` | `h("div", null, [...])` |
| `<UserCard />` | `h(UserCard, null, [...])` |
| `{expr}` | `text(String(expr))` |
| `@if (c) { ... } @else { ... }` | `...((c) ? [...] : [...])` |
| `@for (n of items; key) { ... }` | `...items.map((n) => h(..., { key }, [...]))` |
| `@switch (e) { @case ("v") {...} }` | IIFE with `switch` |
| `@clickable (p) { ... }` | `h(Clickable, { p }, [...])` |

Usage:

```ts
import { compile } from "belzium/compiler";

const ts = compile(belSource, { importPath: "belzium" });
```

### VSCode Extension

The `.bel` extension is located in `tools/belzium-language/`.

**Installation:**

```bash
cd tools/belzium-language
npm install
npm run build
# Copy the output folder to ~/.vscode/extensions/
```

**Features:**
- Syntax highlighting with TextMate grammar.
- Directive completions (`@if`, `@for`, `@switch`, ...) and full IntelliSense.
- Hover with inferred types.
- Go-to-definition across `.bel` files.
- Diagnostics (syntactic + semantic) with debounce.
- Semantic tokens and folding ranges.

### Project structure

```
src/
  reactive/        Reactivity (proxies, refs, effects, scheduler)
  component/       Components (decorators, lifecycle, slots, I/O, hooks, directives)
  di/              DI/IoC (ApplicationContext, @Service, scopes, tokens)
  runtime/         Runtime (createApp, VNodes, renderers)
  compiler.ts      .bel → TypeScript compiler
  tsxTransform.ts  .bel → TSX transform for IDE support
  store.ts         @Store (global reactive state)
  index.ts         Public API
tools/
  belzium-language/  VSCode extension for .bel
tests/               337 tests (36 files)
docs/                Language spec + compiler architecture
```

### Scripts

```bash
npm test                  # run tests
npm run typecheck         # verify types
npm run build:types       # generate .d.ts files
npm run build:language    # build VSCode extension
npm run typecheck:language # verify extension types
```

### Tests

```bash
npx vitest run
```

337 tests covering: reactivity, components, DI/IoC, stores, hooks, directives, compiler, language service.
