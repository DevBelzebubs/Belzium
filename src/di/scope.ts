// Ciclo de vida de un provider dentro del contenedor.
export enum Scope {
    // SINGLETON -> una sola instancia para toda la app (contexto raíz)
    SINGLETON = "singleton",
    // TRANSIENT -> instancia nueva en cada resolve(), sin caché
    TRANSIENT = "transient",
    // SCOPED -> una instancia por contexto hijo (createScope())
    SCOPED = "scoped"
}