import { formatCop } from './money';

describe('formatCop', () => {
  it('converts integer cents into Colombian pesos', () => {
    expect(formatCop(15990000)).toMatch(/159[.\s]900/);
  });
});
