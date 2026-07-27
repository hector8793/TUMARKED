import {
  clearCheckoutProgress,
  loadCheckoutProgress,
  safeCheckoutForm,
  saveCheckoutProgress,
  type CheckoutProgress,
} from './checkout-progress';

const progress: CheckoutProgress = {
  productId: 'product-1',
  quantity: 2,
  step: 2,
  form: {
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    phone: '3001234567',
    address: 'Calle 1',
    city: 'Bogotá',
    department: 'Bogotá',
    postalCode: '',
    instructions: '',
    installments: '2',
  },
};

describe('checkout progress', () => {
  beforeEach(() => sessionStorage.clear());

  it('stores, loads and clears only the recoverable checkout progress', () => {
    saveCheckoutProgress(progress);
    expect(loadCheckoutProgress()).toEqual(progress);

    clearCheckoutProgress();
    expect(loadCheckoutProgress()).toBeNull();
  });

  it('ignores malformed and invalid stored values', () => {
    sessionStorage.setItem('tumarked.checkout.progress', '{');
    expect(loadCheckoutProgress()).toBeNull();

    sessionStorage.setItem('tumarked.checkout.progress', JSON.stringify({ step: 3 }));
    expect(loadCheckoutProgress()).toBeNull();
  });

  it('copies only the explicitly allowed non-card fields', () => {
    const unsafeForm = {
      ...progress.form,
      cardNumber: '4242424242424242',
      cvc: '123',
    };
    expect(safeCheckoutForm(unsafeForm)).toEqual(progress.form);
  });
});
