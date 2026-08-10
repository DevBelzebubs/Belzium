export {
    reactive,
    RAW
} from "./reactive/reactive";

export {
    toReactive,
    toRaw
} from "./reactive/reactiveContext";

export {
    effect,
    ReactiveEffect
} from "./reactive/effect";

export {
    computed,
    ComputedRef
} from "./reactive/computed";

export {
    ref,
    RefImpl,
    isRef,
    IS_REF
} from "./reactive/ref";
export type { Ref } from "./reactive/ref";

export {
    watch,
    watchEffect
} from "./reactive/watch";

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

export {
    createComponentProxy
} from "./component/componentProxy";
