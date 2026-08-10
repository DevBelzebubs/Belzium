import { describe, it, expect } from "vitest";
import { ref } from "../src/reactive/ref";
import { effect } from "../src/reactive/effect";

describe("ref", () => {

it("Deberia de crear una variable reactiva", () => {

    const count = ref(0);

    let dummy = 0;

    effect(() => {
        dummy = count.value;
    });

    expect(dummy).toBe(0);

    count.value = 1;

    expect(dummy).toBe(1);
});

});
