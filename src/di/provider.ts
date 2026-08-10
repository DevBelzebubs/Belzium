import { InjectionToken } from "./token";

export interface ClassProvider<T = unknown> {
    token: InjectionToken<T>;
    useClass: new (...args: any[]) => T;
    dependencies?: InjectionToken[];
}
export interface ValueProvider<T = unknown> {
    token: InjectionToken<T>;
    useValue: T;
}
export type Provider<T = unknown> =
    | ClassProvider<T>
    | ValueProvider<T>;