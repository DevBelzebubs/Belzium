import { activeEffect, ReactiveEffect, type EffectFn } from './effect';
const targetMap = new WeakMap<object, Map<PropertyKey, Set<ReactiveEffect>>>();
export function track(target: object, key: PropertyKey) {
    if (!activeEffect) return; // Si no hay un efecto activo, no pasa nada
    let depsMap = targetMap.get(target); // Map del objeto

    if(!depsMap){
        depsMap = new Map();
        targetMap.set(target, depsMap); // Crea un nuevo map para el objeto si no existe
    }

    let deps = depsMap.get(key); // Set de efectos para la propiedad

    if(!deps){
        deps = new Set();
        depsMap.set(key, deps); // Crea un nuevo set de efectos para la propiedad si no existe
    }

    deps.add(activeEffect); // Agrega el efecto activo al set de efectos para la propiedad (Esto era lo que faltaba ._.XD)
    activeEffect.deps.push(deps); // Agrega el set de efectos al array de dependencias del efecto activo
}
export function trigger(target: object, key: PropertyKey) {
    const depsMap = targetMap.get(target); // Map del objeto
    
    if(!depsMap) return;

    const deps = depsMap.get(key); // Set de efectos para la propiedad
    
    if(!deps) return;
    const effects = new Set(deps);
    effects.forEach(effect => {
        effect.run(); // Ejecuta cada efecto una sola vez
    });
}