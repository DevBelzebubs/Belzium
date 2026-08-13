import { defineComponentMetadata } from "../../component/metadata";
import type { ComponentOptions } from "../../component/types";

// @UI(): marca una clase como componente UI.
// Comparte el mismo runtime que @Component.
export function UI(options: ComponentOptions = {}) {
  return <T extends new (...args: never[]) => object>(target: T): T => {
    defineComponentMetadata(target, {
      type: target,
      selector: options.selector,
      variants: options.variants,
    });

    return target;
  };
}
