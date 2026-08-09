export type EffectFn = () => void;

export let activeEffect: EffectFn | null = null;
export function effect(fn:EffectFn) {
    activeEffect = fn; // Setea el activeEffect a la función que se pasa como argumento
    fn();
    activeEffect = null; // Resetea el activeEffect a null después de ejecutar la función
}