import { ReactiveEffect } from "./effect";
import { queueJob } from "./scheduler";
import { getActiveEffectScope } from "./effectScope";
export type WatchSource<T> = () => T;
export interface WatchOptions {
  flush?: "sync" | "pre"; // Uno ejecuta de manera inmediata y otro usa jobs
}

export type WatchCallback<T> = (newValue: T, oldValue: T) => void;

export function watchEffect(fn: () => void): ReactiveEffect {
  const effect = new ReactiveEffect(fn); // Crea un efecto reactivo para la función
  effect.run();

  return effect;
}
export function watch<T>(
  source: WatchSource<T>,
  callback: WatchCallback<T>,
  options: WatchOptions = {},
): ReactiveEffect<T> {
  let oldValue!: T;
  const job = () => {
    const newValue = effect.run();
    callback(newValue, oldValue); // Actualiza el valor
    oldValue = newValue;
  };
  const scheduler = options.flush === "pre" ? () => queueJob(job) : job;
  const effect = new ReactiveEffect(source, scheduler); // Crea un efecto reactivo para la función de watch
  const reactiveEffect = new ReactiveEffect(job);

  getActiveEffectScope()?.add(reactiveEffect);
  oldValue = effect.run(); // Ejecuta el efecto para obtener el valor inicial y trackear las dependencias
  return effect;
}
