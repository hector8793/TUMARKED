import {
  createPaymentProvider,
  type CardDraft,
  type PaymentAcceptance,
} from './payment-provider-client';

export type { CardDraft, PaymentAcceptance } from './payment-provider-client';

export const paymentProvider = createPaymentProvider({
  apiUrl: import.meta.env.VITE_PAYMENT_API_URL,
  publicKey: import.meta.env.VITE_PAYMENT_PUBLIC_KEY,
});
