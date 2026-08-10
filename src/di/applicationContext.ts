import { Provider } from "./provider";
import type { InjectionToken } from "./token";

export class ApplicationContext {
  // Definiciones de providers registradas en el contexto.
  private providers = new Map<InjectionToken, Provider>();
  // Instancias creadas para mantener el singleton.
  private instances = new Map<InjectionToken, unknown>();
  private resolving = new Set<InjectionToken>();
  // Registra directamente un valor como provider.
  register<T>(token: InjectionToken<T>, value: T): void {
    this.providers.set(token, { token, useValue: value });
  }
  //Registra una definición de provider
  registerProvider<T>(provider: Provider<T>): void {
    this.providers.set(provider.token, provider);
  }

  //Resuelve una dependencia registrada en el contexto.
  resolve<T>(token: InjectionToken<T>): T {
    const existing = this.instances.get(token);

    if (existing) {
      return existing as T;
    }

    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected`);
    }

    const provider = this.providers.get(token);

    if (!provider) {
      throw new Error(`No provider found for token`);
    }
    // Los valores registrados directamente se devuelven tal cual.
    if ("useValue" in provider) {
      return provider.useValue as T;
    }
    this.resolving.add(token);
    try {
      const dependencies = provider.dependencies ?? [];
      const resolvedDependencies = dependencies.map((dependency) => this.resolve(dependency));
          const instance = new provider.useClass(...resolvedDependencies);    // Los ClassProvider se instancian una sola vez (singleton)
          this.instances.set(token,instance);
        return instance as T;
    } finally {
        this.resolving.delete(token);
    }

  }
  // Comprueba si existe un provider registrado.
  has(token: InjectionToken): boolean {
    return this.providers.has(token);
  }
}
