// ComponentScope: administra el ciclo de vida
// y la reactividad asociada a un componente.

import { effectScope, type EffectScope } from "../reactive/effectScope";

// Callback utilizado por los hooks del componente.
type LifecycleHook = () => void;

// Scope del componente que se está construyendo.
// Los hooks onMounted/onUnmounted se registran
// dentro del constructor de la instancia.
let currentComponentScope: ComponentScope | undefined;

// Establece el scope del componente en construcción.
export function setCurrentComponentScope(
  scope: ComponentScope | undefined,
): void {
  currentComponentScope = scope;
}

// Obtiene el scope del componente en construcción.
export function getCurrentComponentScope(): ComponentScope | undefined {
  return currentComponentScope;
}

// Registra un callback ejecutado cuando
// el componente termina de montarse.
export function onMounted(hook: () => void): void {
  currentComponentScope?.onMount(hook);
}

// Registra un callback ejecutado antes
// de desmontar el componente.
export function onUnmounted(hook: () => void): void {
  currentComponentScope?.onUnmount(hook);
}

// Estado del ciclo de vida del componente.
export type ComponentLifecycleState = "created" | "mounted" | "unmounted";

// Scope perteneciente a un componente.
export class ComponentScope {
  // Scope reactivo utilizado para agrupar
  // todos los efectos del componente.
  readonly effectScope: EffectScope;

  // Hooks ejecutados cuando el componente
  // termina de montarse.
  private readonly mountHooks = new Set<LifecycleHook>();

  // Hooks ejecutados después de una
  // actualización del componente.
  private readonly updateHooks = new Set<LifecycleHook>();

  // Hooks ejecutados antes de desmontar
  // el componente.
  private readonly unmountHooks = new Set<LifecycleHook>();

  // Estado actual del ciclo de vida.
  private state: ComponentLifecycleState = "created";

  constructor() {
    // Cada componente posee
    // su propio scope reactivo.
    this.effectScope = effectScope();
  }

  // Ejecuta código dentro del scope reactivo
  // perteneciente al componente.
  run<T>(fn: () => T): T {
    return this.effectScope.run(fn);
  }

  // Registra un callback para el montaje.
  onMount(hook: LifecycleHook): void {
    // Los hooks solamente pueden
    // registrarse antes del montaje.
    if (this.state !== "created") {
      throw new Error(`Cannot register onMount after component mount`);
    }

    this.mountHooks.add(hook);
  }

  // Registra un callback para las actualizaciones.
  onUpdate(hook: LifecycleHook): void {
    // Los hooks solamente pueden
    // registrarse mientras el componente
    // todavía está vivo.
    if (this.state === "unmounted") {
      throw new Error(`Cannot register onUpdate after component unmount`);
    }

    this.updateHooks.add(hook);
  }

  // Registra un callback para el desmontaje.
  onUnmount(hook: LifecycleHook): void {
    // Los hooks solamente pueden
    // registrarse mientras el componente
    // todavía está vivo.
    if (this.state === "unmounted") {
      throw new Error(`Cannot register onUnmount after component unmount`);
    }

    this.unmountHooks.add(hook);
  }

  // Ejecuta los hooks de montaje.
  mount(): void {
    if (this.state !== "created") {
      throw new Error(`Component is already mounted`);
    }

    this.state = "mounted";

    this.runHooks(this.mountHooks);
  }

  // Ejecuta los hooks posteriores
  // a una actualización.
  update(): void {
    if (this.state !== "mounted") {
      return;
    }

    this.runHooks(this.updateHooks);
  }

  // Desmonta el componente.
  //
  // Los hooks de unmount se ejecutan
  // antes de detener la reactividad.
  unmount(): void {
    if (this.state === "unmounted") {
      return;
    }

    // Primero notificamos al componente
    // que está siendo desmontado.
    this.runHooks(this.unmountHooks);

    // Después detenemos todos los efectos.
    this.effectScope.stop();

    // Finalmente marcamos el componente
    // como desmontado.
    this.state = "unmounted";

    // Liberamos los callbacks.
    this.mountHooks.clear();
    this.updateHooks.clear();
    this.unmountHooks.clear();
  }

  // Indica el estado actual del componente.
  get lifecycleState(): ComponentLifecycleState {
    return this.state;
  }

  // Ejecuta todos los hooks de un tipo.
  private runHooks(hooks: Set<LifecycleHook>): void {
    for (const hook of hooks) {
      hook();
    }
  }
}
