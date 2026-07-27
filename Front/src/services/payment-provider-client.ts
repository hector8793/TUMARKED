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

interface PaymentProviderConfig {
  apiUrl?: string;
  publicKey?: string;
}

export function createPaymentProvider(
  config: PaymentProviderConfig,
  fetcher?: typeof fetch,
) {
  const apiUrl = config.apiUrl?.trim().replace(/\/+$/, '');
  const publicKey = config.publicKey?.trim();
  const request = () => fetcher ?? globalThis.fetch;

  const requireConfiguration = () => {
    if (!apiUrl) throw new Error('La URL de la pasarela de pagos no está configurada.');
    if (!publicKey) throw new Error('La llave pública de pagos no está configurada.');
    return { apiUrl, publicKey };
  };

  return {
    async getAcceptance(): Promise<PaymentAcceptance> {
      const settings = requireConfiguration();
      const response = await request()(
        `${settings.apiUrl}/merchants/${encodeURIComponent(settings.publicKey)}`,
      );
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
      const settings = requireConfiguration();
      const response = await request()(`${settings.apiUrl}/tokens/cards`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.publicKey}`,
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
        throw new Error(
          payload.error?.reason
          || 'La pasarela de pagos no pudo tokenizar la tarjeta.',
        );
      }
      return payload.data.id;
    },
  };
}
