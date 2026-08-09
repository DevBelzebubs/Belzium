import {
    ReactiveEffect
} from "./effect";

export function watchEffect(
    fn: () => void
): ReactiveEffect {

    const effect =
        new ReactiveEffect(fn); // Crea un efecto reactivo para la función

    effect.run();

    return effect;
}