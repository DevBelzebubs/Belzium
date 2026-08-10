// API pública del framework: re-exporta la reactividad y los componentes
// Reactividad: proxies reactivos y el symbol RAW para acceder al objeto crudo
export {
    reactive,
    RAW
} from "./reactive/reactive";

// Contexto reactivo: convierte valores a reactivos y recupera el objeto crudo
export {
    toReactive,
    toRaw
} from "./reactive/reactiveContext";

// Efectos: funciones que reaccionan a los cambios del estado reactivo
export {
    effect,
    ReactiveEffect
} from "./reactive/effect";

// Computed: valores derivados que se recalculan cuando cambian sus dependencias
export {
    computed,
    ComputedRef
} from "./reactive/computed";

// Ref: variables reactivas individuales
export {
    ref,
    RefImpl,
    isRef,
    IS_REF
} from "./reactive/ref";
export type { Ref } from "./reactive/ref";

// Watch: observa fuentes reactivas y ejecuta callbacks cuando cambian
export {
    watch,
    watchEffect
} from "./reactive/watch";

// Componentes: creación de instancias, setup y acceso a la instancia actual
export {
    createComponentInstance,
    setupComponent,
    getCurrentInstance
} from "./component/component";
export type {
    Component,
    ComponentInstance,
    ComponentPublicInstance,
    SetupContext,
    EmitFn
} from "./component/component";

// Componentes: proxy público de la instancia
export {
    createComponentProxy
} from "./component/componentProxy";
