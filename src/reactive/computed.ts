import {
    ReactiveEffect
} from "./effect";
export class ComputedRef<T> {
    private _value!: T;
    private _dirty = true;
    private readonly effect: ReactiveEffect;
    constructor(getter: () => T) {
        this.effect = new ReactiveEffect(() => { // Crea un efecto reactivo para el getter
            this._value = getter();
        },
        () => {
            this._dirty = true; // Marca el valor como sucio cuando se ejecuta el scheduler
        }
    );
    }
    get value() {
        if (this._dirty) { // Si el valor está sucio, ejecuta el efecto para recalcular el valor
            this.effect.run(); // Ejecuta el efecto para recalcular el valor
            this._dirty = false;
        }
        return this._value;
    }
}
export function computed<T>( // Crea una referencia computada a partir de un getter
    getter: () => T
): ComputedRef<T> {
    return new ComputedRef(getter);
}