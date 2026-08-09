export type EffectFn = () => void;
export type EffectScheduler = () => void;
const effectStack: ReactiveEffect[] = [];
export interface EffectOptions {
    scheduler?: EffectScheduler;
    onStop?: () => void;
}
export class ReactiveEffect {
    public active = true;
    public running = false;
    public deps: Set<ReactiveEffect>[] = [];
    constructor(
        public fn: EffectFn, public scheduler?: EffectScheduler, public onStop?: () => void
    ) {}
    run() : void {
        if(!this.active) { // Si el efecto no está activo, simplemente ejecuta la función sin trackear dependencias
            this.fn();
            return;
        }
        if (this.running) {
            return;
        }
        this.cleanup(); // Limpia las dependencias anteriores antes de ejecutar el efecto
        this.running = true;
        effectStack.push(this); // Agrega el efecto actual al stack de efectos
        activeEffect = this;

        try {
            this.fn();
        } finally {
            effectStack.pop(); // Elimina el efecto actual del stack de efectos
            activeEffect = effectStack[effectStack.length - 1] || null; // Setea el activeEffect al último efecto en el stack o a null si el stack está vacío
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