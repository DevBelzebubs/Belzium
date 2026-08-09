import {
    ReactiveEffect
} from "./effect";
export type WatchSource<T> = () => T;

export type WatchCallback<T> =
    (newValue: T, oldValue: T) => void;

export function watchEffect(
    fn: () => void
): ReactiveEffect {

    const effect =
        new ReactiveEffect(fn); // Crea un efecto reactivo para la función
    effect.run();

    return effect;
}
export function watch<T>(
    source: WatchSource<T>,
    callback: WatchCallback<T>
): ReactiveEffect<T> {
    let oldValue!: T;
    const effect = new ReactiveEffect(source, () => {
        const newValue = effect.run(); //Cuando hay nuevo valor, trackea las dependencias
        callback(newValue, oldValue);
        oldValue = newValue;
    });
    oldValue = effect.run(); // Ejecuta el efecto para obtener el valor inicial y trackear las dependencias
    return effect;
}