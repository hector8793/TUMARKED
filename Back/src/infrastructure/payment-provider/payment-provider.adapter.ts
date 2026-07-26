import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateCardPayment,
  GatewayTransaction,
  PaymentGatewayPort,
} from '../../domain/ports/payment-gateway.port';

interface ProviderResponse {
  data?: {
    id?: string;
    status?: string;
    status_message?: string;
    payment_method_type?: string;
  };
  error?: { type?: string; reason?: string; messages?: unknown };
}

@Injectable()
export class PaymentProviderAdapter implements PaymentGatewayPort {
  private readonly apiUrl: string;
  private readonly privateKey: string;

  constructor(config: ConfigService) {
    this.apiUrl = config.getOrThrow<string>('PAYMENT_API_URL').replace(/\/+$/, '');
    this.privateKey = config.getOrThrow<string>('PAYMENT_PRIVATE_KEY');
  }

  async createCardPayment(input: CreateCardPayment): Promise<GatewayTransaction> {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount_in_cents: input.amountInCents,
        currency: input.currency,
        customer_email: input.customerEmail,
        payment_method: {
          type: 'CARD',
          token: input.cardToken,
          installments: input.installments,
        },
        payment_method_type: 'CARD',
        reference: input.reference,
        signature: input.signature,
        acceptance_token: input.acceptanceToken,
        accept_personal_auth: input.acceptPersonalAuth,
        ...(input.customerIp ? { ip: input.customerIp } : {}),
      }),
    });
  }

  async getTransaction(id: string): Promise<GatewayTransaction> {
    return this.request(`/transactions/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  private async request(path: string, init: RequestInit): Promise<GatewayTransaction> {
    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${this.privateKey}`,
          'Content-Type': 'application/json',
        },
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        message: 'La pasarela de pagos no está disponible temporalmente',
      });
    }

    const payload = await response.json().catch(() => ({})) as ProviderResponse;
    if (!response.ok || !payload.data?.id || !payload.data.status) {
      throw new BadGatewayException({
        code: 'PAYMENT_PROVIDER_ERROR',
        message: 'La pasarela rechazó la solicitud de pago',
        details: {
          status: response.status,
          type: payload.error?.type,
          reason: payload.error?.reason,
        },
      });
    }

    return {
      id: payload.data.id,
      status: payload.data.status,
      statusMessage: payload.data.status_message,
      paymentMethodType: payload.data.payment_method_type,
    };
  }
}
