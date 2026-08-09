export type EffectFn<T = any> = () => T;
export type EffectScheduler = () => void;




const effectStack: ReactiveEffect[] = [];
export interface EffectOptions {
    scheduler?: EffectScheduler;
    onStop?: () => void;
}
export class ReactiveEffect<T = any> {
    public active = true;
    public running = false;
    public deps: Set<ReactiveEffect>[] = [];
    constructor(
        public fn: EffectFn, public scheduler?: EffectScheduler, public onStop?: () => void
    ) {}
    run() : T | undefined { // Ejecuta el efecto y trackea las dependencias
        if(!this.active) { // Si el efecto no está activo, simplemente ejecuta la función sin trackear dependencias
            return this.fn();
        }
        if (this.running) {
            return undefined; // Evita reentrar en el mismo efecto mientras ya se está ejecutando
        }
        this.cleanup(); // Limpia las dependencias anteriores antes de ejecutar el efecto
        this.running = true;
        effectStack.push(this); // Agrega el efecto actual al stack de efectos
        activeEffect = this;

        try {
            return this.fn();
        } finally {
            effectStack.pop(); // Elimina el efecto actual del stack de efectos
            activeEffect =
                effectStack[
                    effectStack.length - 1
                ] ?? null; // Setea el activeEffect al último efecto en el stack o a null si el stack está vacío
            this.running = false;
        }
    }
    cleanup() {
        for(const deps of this.deps){
            deps.delete(this); // Elimina el efecto actual de cada set de dependencias
        }
        this.deps.length = 0; // Limpia el array de dependencias del efecto actual
    }
    stop() {
        if(!this.active){
            return;
        }
        this.cleanup();
        this.active = false;
        this.onStop?.();
    }
}
export let activeEffect: ReactiveEffect | null = null;

export function effect(fn:EffectFn, options: EffectOptions = {}) {
    const reactiveEffect = new ReactiveEffect(fn, options.scheduler, options.onStop); // Crea una nueva instancia de ReactiveEffect con la función proporcionada
    reactiveEffect.run();
    return reactiveEffect;
}