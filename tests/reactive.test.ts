import { describe, it, expect} from 'vitest';
import { reactive } from '../src/reactive/reactive';

describe('reactive', () => {
    it('deberia de crear un objeto reactivo', () => {
        const state = reactive({ count: 0 });
        expect(state.count).toBe(0);
        state.count++; //Deberia de disparar el efecto y actualizar el valor
        expect(state.count).toBe(1);
    });
});