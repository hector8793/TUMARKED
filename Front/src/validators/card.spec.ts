import { cardBrand, passesLuhn } from './card';

describe('card validation', () => {
  it('accepts a valid sandbox card and rejects an invalid number', () => {
    expect(passesLuhn('4242 4242 4242 4242')).toBe(true);
    expect(passesLuhn('4242 4242 4242 4241')).toBe(false);
  });

  it('detects Visa and Mastercard', () => {
    expect(cardBrand('424242')).toBe('Visa');
    expect(cardBrand('555555')).toBe('Mastercard');
  });
});
