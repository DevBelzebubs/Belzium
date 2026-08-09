import {
    trackEffect,
    triggerEffect
} from "./dependency";

import {
    ReactiveEffect
} from "./effect";
export class RefImpl<T> {
    private _value: T;

    private readonly deps =
        new Set<ReactiveEffect>();
    constructor(value: T) {
        this._value = value;
    }
    get value(): T { //Internamente crea get para la variable reactiva
        trackEffect(this.deps);
        return this._value;
    }
    set value(newValue: T) { //Internamente crea un set para la variable reactiva
        if (Object.is(this._value,newValue)) {
            return;
        }
        this._value = newValue;
        triggerEffect(this.deps);
    }
}
export function ref<T>(value: T): RefImpl<T> {
    return new RefImpl(value);
}