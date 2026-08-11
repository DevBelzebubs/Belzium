export interface ComponentInstance<T = object> {
    // Instancia real de la clase.
    instance: T;
    // Metadata del componente.
    metadata: {
        selector: string;
    };
    // Nodo DOM donde está montado.
    element: Element;
}