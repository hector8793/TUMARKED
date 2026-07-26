export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface CreateCardPayment {
  reference: string;
  amountInCents: number;
  currency: 'COP';
  customerEmail: string;
  cardToken: string;
  installments: number;
  signature: string;
  acceptanceToken: string;
  acceptPersonalAuth: string;
  customerIp?: string;
}

export interface GatewayTransaction {
  id: string;
  status: string;
  statusMessage?: string;
  paymentMethodType?: string;
}

export interface PaymentGatewayPort {
  createCardPayment(input: CreateCardPayment): Promise<GatewayTransaction>;
  getTransaction(id: string): Promise<GatewayTransaction>;
}
