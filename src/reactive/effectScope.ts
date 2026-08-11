// EffectScope: agrupa efectos reactivos
// para controlar su ciclo de vida como una unidad.

import {
  ReactiveEffect,
  getActiveEffectScope as getCurrentEffectScope,
  setActiveEffectScope as setCurrentEffectScope,
} from "./effect";

// Scope que contiene efectos reactivos.
export class EffectScope {
  // Efectos registrados dentro del scope.
  private readonly effects = new Set<ReactiveEffect>();

  // Indica si el scope sigue activo.
  private active = true;

  // Ejecuta una función dentro de este scope.
  //
  // Todos los efectos que posteriormente
  // se creen durante esta ejecución podrán
  // asociarse al scope activo.
  run<T>(fn: () => T): T {
    if (!this.active) {
      throw new Error("Cannot run an inactive EffectScope");
    }

    // Conserva el scope anterior para
    // soportar scopes anidados.
    const previousScope = getCurrentEffectScope();

    setCurrentEffectScope(this);

    try {
      return fn();
    } finally {
      // Restaura el scope anterior.
      setCurrentEffectScope(previousScope);
    }
  }

  // Registra manualmente un efecto dentro del scope.
  add(effect: ReactiveEffect): void {
    // Un efecto no puede pertenecer
    // a un scope detenido.
    if (!this.active) {
      effect.stop();
      return;
    }

    this.effects.add(effect);
  }

  // Detiene todos los efectos
  // pertenecientes al scope.
  stop(): void {
    if (!this.active) {
      return;
    }

    this.active = false;

    for (const effect of this.effects) {
      effect.stop();
    }

    // Libera las referencias.
    this.effects.clear();
  }

  // Indica si el scope sigue activo.
  get isActive(): boolean {
    return this.active;
  }
}

// Crea un nuevo scope reactivo.
export function effectScope(): EffectScope {
  return new EffectScope();
}

// Obtiene el scope reactivo actualmente activo.
export function getActiveEffectScope(): EffectScope | undefined {
  return getCurrentEffectScope() as EffectScope | undefined;
}
