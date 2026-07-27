import { createPaymentProvider } from './payment-provider-client';

const config = {
  apiUrl: 'https://payments.example/v1/',
  publicKey: ' public-key ',
};

describe('payment provider client', () => {
  it('loads acceptance tokens using normalized configuration', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          presigned_acceptance: {
            acceptance_token: 'acceptance',
            permalink: 'https://terms.example',
          },
          presigned_personal_data_auth: {
            acceptance_token: 'personal',
            permalink: 'https://privacy.example',
          },
        },
      }),
    });
    const provider = createPaymentProvider(config, fetcher);

    await expect(provider.getAcceptance()).resolves.toEqual({
      acceptanceToken: 'acceptance',
      acceptancePermalink: 'https://terms.example',
      personalDataToken: 'personal',
      personalDataPermalink: 'https://privacy.example',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://payments.example/v1/merchants/public-key',
    );
  });

  it('tokenizes a normalized card without storing its data', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'CREATED',
        data: { id: 'card-token', brand: 'VISA', last_four: '4242' },
      }),
    });
    const provider = createPaymentProvider(config, fetcher);

    await expect(provider.tokenizeCard({
      number: '4242 4242 4242 4242',
      cvc: '123',
      expMonth: '12',
      expYear: '40',
      cardHolder: ' ANA PÉREZ ',
    })).resolves.toBe('card-token');

    const request = fetcher.mock.calls[0][1] as RequestInit;
    expect(request.headers).toEqual(expect.objectContaining({
      Authorization: 'Bearer public-key',
    }));
    expect(JSON.parse(request.body as string)).toEqual(expect.objectContaining({
      number: '4242424242424242',
      card_holder: 'ANA PÉREZ',
    }));
  });

  it('reports configuration, terms and tokenization errors', async () => {
    await expect(createPaymentProvider({}).getAcceptance()).rejects.toThrow(
      'URL de la pasarela',
    );
    await expect(createPaymentProvider({ apiUrl: 'https://payments.example' })
      .getAcceptance()).rejects.toThrow('llave pública');

    const termsFailure = createPaymentProvider(config, jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn(),
    }));
    await expect(termsFailure.getAcceptance()).rejects.toThrow(
      'cargar los términos',
    );

    const rejectedCard = createPaymentProvider(config, jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: { reason: 'Tarjeta inválida' } }),
    }));
    await expect(rejectedCard.tokenizeCard({
      number: '1',
      cvc: '1',
      expMonth: '1',
      expYear: '1',
      cardHolder: 'A',
    })).rejects.toThrow('Tarjeta inválida');

    const malformed = createPaymentProvider(config, jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    }));
    await expect(malformed.tokenizeCard({
      number: '1',
      cvc: '1',
      expMonth: '1',
      expYear: '1',
      cardHolder: 'A',
    })).rejects.toThrow('no pudo tokenizar');
  });
});
