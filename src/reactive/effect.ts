export type EffectFn = () => void;

export function effect(fn:EffectFn) {
    fn();
}