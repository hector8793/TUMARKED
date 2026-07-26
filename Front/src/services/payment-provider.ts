const PAYMENT_API_URL = import.meta.env.VITE_PAYMENT_API_URL?.trim().replace(/\/+$/, '');
const PUBLIC_KEY = import.meta.env.VITE_PAYMENT_PUBLIC_KEY?.trim();

interface MerchantResponse {
  data: {
    presigned_acceptance: { acceptance_token: string; permalink: string };
    presigned_personal_data_auth: { acceptance_token: string; permalink: string };
  };
}

interface TokenResponse {
  status: string;
  data?: { id: string; brand: string; last_four: string };
  error?: { reason?: string };
}

export interface PaymentAcceptance {
  acceptanceToken: string;
  acceptancePermalink: string;
  personalDataToken: string;
  personalDataPermalink: string;
}

export interface CardDraft {
  number: string;
  cvc: string;
  expMonth: string;
  expYear: string;
  cardHolder: string;
}

function requirePublicKey(): string {
  if (!PUBLIC_KEY) throw new Error('La llave pública de pagos no está configurada.');
  return PUBLIC_KEY;
}

function requireApiUrl(): string {
  if (!PAYMENT_API_URL) throw new Error('La URL de la pasarela de pagos no está configurada.');
  return PAYMENT_API_URL;
}

export const paymentProvider = {
  async getAcceptance(): Promise<PaymentAcceptance> {
    const publicKey = requirePublicKey();
    const response = await fetch(`${requireApiUrl()}/merchants/${encodeURIComponent(publicKey)}`);
    if (!response.ok) throw new Error('No fue posible cargar los términos de pago.');
    const payload = await response.json() as MerchantResponse;
    return {
      acceptanceToken: payload.data.presigned_acceptance.acceptance_token,
      acceptancePermalink: payload.data.presigned_acceptance.permalink,
      personalDataToken: payload.data.presigned_personal_data_auth.acceptance_token,
      personalDataPermalink: payload.data.presigned_personal_data_auth.permalink,
    };
  },

  async tokenizeCard(card: CardDraft): Promise<string> {
    const response = await fetch(`${requireApiUrl()}/tokens/cards`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requirePublicKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: card.number.replace(/\D/g, ''),
        cvc: card.cvc,
        exp_month: card.expMonth,
        exp_year: card.expYear,
        card_holder: card.cardHolder.trim(),
      }),
    });
    const payload = await response.json().catch(() => ({})) as TokenResponse;
    if (!response.ok || payload.status !== 'CREATED' || !payload.data?.id) {
      throw new Error(payload.error?.reason || 'La pasarela de pagos no pudo tokenizar la tarjeta.');
    }
    return payload.data.id;
  },
};
