export interface ComponentOptions {
    // Selector que identifica el componente en el renderer
    selector: string;
}

export interface ComponentMetadata {
    // Constructor del componente
    type: new (...args: never[]) => object;
    // Selector que usa el renderer
    selector: string;
}
export interface RenderableComponent {
    render(): string;
}