# Especificación del lenguaje `.bel`

`.bel` es el lenguaje de plantillas de Belzium: archivos TypeScript que escriben
JSX con directivas de Belzium. Antes de ser consumidos por el runtime, se
compilan a TypeScript puro mediante `src/compiler.ts` (ver
`docs/compiler-architecture.md`).

```bel
@Component()
export class Counter {
  count = ref(0);
  items = [1, 2, 3];

  render() {
    return (
      <div>
        <button onClick={() => this.count.value++}>
          Count: {this.count.value}
        </button>
        <if condition={this.count.value >= 3}>
          <p>Big</p>
        </if>
        <else>
          <p>Small</p>
        </else>
        <ul>
          <for each={n of this.items} key={n}>
            <li>Item {n}</li>
          </for>
        </ul>
      </div>
    );
  }
}
```

## Componentes

Todo componente se declara con `@Component()`, `@UI()` o `@Configuration()` y
define un método `render()` que devuelve el árbol virtual.

- El método `template()` también se acepta: el compilador lo renombra a `render()`.
- El compilador inyecta el selector kebab-case del nombre de la clase:
  `@Component()` → `@Component({ selector: "counter" })`. Un selector explícito
  (`@Component({ selector: "my-card" })`) se preserva tal cual.
- Los componentes se nombran en PascalCase (`<UserCard />`); los elementos HTML
  en minúscula (`<div>`).

## Reactividad

- `ref(valor)` crea un estado reactivo. El valor SIEMPRE se lee y escribe con
  `.value`: `this.count.value`, `this.count.value++`.
- `@Store()` declara estado global **sin IoC**:
  - `useStore(StoreClass)` retorna la misma instancia en toda la app (singleton).
  - `resetStores()` limpia las instancias creadas.
  - Usar una clase sin `@Store()` lanza `Class is not a store`.
- `@Hook()` declara estado/lógica reutilizable atada al ciclo de vida del
  consumidor:
  - `useHook(HookClass)` crea una instancia **nueva por componente consumidor**
    (una por scope). Solo puede llamarse dentro de un componente; fuera lanza
    `useHook() can only be used inside a component`.
  - Sus métodos `onMounted`/`onUnmounted` se enlazan al ciclo de vida del
    componente que consume el hook.
- Los campos de stores y hooks son reactivos: un componente que los lee dentro
  de `render()` se re-renderiza al cambiar su valor.

## Elementos, texto e interpolaciones

- `{expresion}` se compila a `text(String(expresion))`.
- El texto entre etiquetas se emite como `text("...")`; los saltos de línea con
  su indentación se colapsan a un solo espacio y los espacios intencionales de
  una misma línea se conservan (`Count: {x}` → `"Count: "` + valor).
- Las comparaciones y genéricos no se confunden con JSX:
  `{this.age > 5 ? "big" : "small"}`, `name = input<string>()`.

## Atributos y eventos

- Atributos: `{expresion}` se emite tal cual; los string se conservan; los
  atributos sin valor son `true`.
- `className` y `htmlFor` se normalizan a `class` y `for`.
- Spread de props: `{...this.props}`.
- Eventos en **camelCase** (`onClick`, `onChange`, `onSubmit`, ...):
  - `onClick={() => this.count.value++}` → `onClick: () => this.count.value++`.
  - `onClick={this.increment}` → `onClick: this.increment`.

## Props y slots

Una clase (componente o directiva) declara sus props con `props!: Readonly<...>`:

```bel
@Directive()
class Clickable {
  props!: Readonly<{ enabled?: boolean }>;

  render() {
    return <button>{String(this.props.enabled)}</button>;
  }
}
```

El contenido entre las etiquetas de un componente se recibe vía slots:

```bel
@Directive()
class Card {
  slots!: Slots;

  render() {
    return <div>{this.slots.default?.() ?? []}</div>;
  }
}
```

## Directivas de plantilla (etiquetas XML)

Se escriben como etiquetas XML dentro del template.

### `<if>` / `<else-if>` / `<else>`

```bel
<if condition={this.count.value >= 3}>
  <p>Big</p>
</if>
<else>
  <p>Small</p>
</else>
```

Compila a una expresión ternaria esparcida: `...((cond) ? [...] : [...])`.
`<else-if condition={otra}>` añade otra rama ternaria.

### `<for>`

```bel
<ul>
  <for each={n of this.items} key={n}>
    <li>Item {n}</li>
  </for>
</ul>
```

La sintaxis es `each={item of iterable}`. El atributo `key` es opcional.
Compila a `...this.items.map((n) => h("li", { key: n }, [...]))`.

### `<switch>` / `<case>` / `<default>`

```bel
<switch value={this.status}>
  <case test={"loading"}><Spinner /></case>
  <case test={"ok"}><Ok /></case>
  <default><Empty /></default>
</switch>
```

Compila a una IIFE con un `switch` real; cada `<case>`/`<default>` retorna su lista
de nodos.

### Componentes custom (PascalCase)

```bel
<Clickable enabled={enabled}>
  <span>Click</span>
</Clickable>
```

Un componente registrado con `@Directive()` (ver `@Directive`
en Decoradores). Compila a `h(Clickable, { enabled: enabled }, [...])`: recibe las props
como atributos JSX y su contenido como slots.

## Ciclo de vida

- `onMounted()` — se ejecuta tras el montaje.
- `onUnmounted()` — se ejecuta al desmontar; en un hook, al desmontar el
  componente consumidor.
- `onUpdated()` — se ejecuta tras **cada actualización** (nunca en el montaje
  inicial) y observa el DOM ya actualizado.

## Decoradores

| Decorador                 | Rol                          | Taxonomía  |
| ------------------------- | ---------------------------- | ---------- |
| `@Component`              | Componente                   | Componente |
| `@UI`                     | Componente (UI)              | Componente |
| `@Configuration`          | Componente (configuración)   | Componente |
| `@Service`                | Componente gestionado por IoC| Archivo    |
| `@Store`                  | Estado global (no-IoC)       | Archivo    |
| `@Hook`                   | Lógica reutilizable          | Archivo    |
| `@Directive`              | Directiva custom del template| Archivo    |

## Compilación

`compile(source, { importPath })` (de `src/compiler.ts`) devuelve TypeScript
válido. Los nombres del runtime usados en el archivo se importan
automáticamente desde `importPath` (por defecto `belzium`):

```ts
import { Component, h, ref, text } from "./runtime";
```

El resto del código TypeScript pasa sin modificar.
