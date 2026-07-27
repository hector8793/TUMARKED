import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Product } from "../models/product";
import { api } from "../services/api";
import { saveCheckoutProgress } from "../services/checkout-progress";
import { paymentProvider } from "../services/payment-provider";
import { CheckoutModal } from "./CheckoutModal";

jest.mock("../services/api", () => ({
  api: {
    createCheckout: jest.fn(),
    processPayment: jest.fn(),
    getTransaction: jest.fn(),
  },
}));

jest.mock("../services/payment-provider", () => ({
  paymentProvider: {
    getAcceptance: jest.fn(),
    tokenizeCard: jest.fn(),
  },
}));

const product: Product = {
  id: "product-1",
  sku: "TM-001",
  name: "Audífonos",
  description: "Producto de prueba",
  priceInCents: 100000,
  stock: 5,
  imageUrl: null,
  active: true,
};

const checkout = {
  transactionId: "transaction-1",
  reference: "TM-001",
  status: "PENDING",
  amounts: {
    subtotal: 100000,
    baseFee: 500000,
    deliveryFee: 1200000,
    total: 1800000,
    currency: "COP" as const,
  },
};

const acceptance = {
  acceptanceToken: "acceptance-token",
  acceptancePermalink: "https://terms.example",
  personalDataToken: "personal-token",
  personalDataPermalink: "https://privacy.example",
};

function fillDelivery() {
  fireEvent.change(screen.getByLabelText(/^Nombre$/), {
    target: { value: "Ana" },
  });
  fireEvent.change(screen.getByLabelText("Apellido"), {
    target: { value: "Pérez" },
  });
  fireEvent.change(screen.getByLabelText("Correo"), {
    target: { value: "ana@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Celular"), {
    target: { value: "3001234567" },
  });
  fireEvent.change(screen.getByLabelText("Dirección"), {
    target: { value: "Calle 1" },
  });
  fireEvent.change(screen.getByLabelText("Ciudad"), {
    target: { value: "Bogotá" },
  });
  fireEvent.change(screen.getByLabelText("Departamento"), {
    target: { value: "Bogotá" },
  });
}

function fillCard() {
  fireEvent.change(screen.getByLabelText(/Número de tarjeta/), {
    target: { value: "4242424242424242" },
  });
  fireEvent.change(screen.getByLabelText("Nombre del titular"), {
    target: { value: "ANA PEREZ" },
  });
  fireEvent.change(screen.getByLabelText("Vencimiento"), {
    target: { value: "1240" },
  });
  fireEvent.change(screen.getByLabelText("CVC"), { target: { value: "123" } });
}

describe("CheckoutModal", () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
    jest.mocked(paymentProvider.getAcceptance).mockResolvedValue(acceptance);
    jest.mocked(paymentProvider.tokenizeCard).mockResolvedValue("card-token");
    jest.mocked(api.createCheckout).mockResolvedValue(checkout);
    jest.mocked(api.getTransaction).mockResolvedValue({
      id: checkout.transactionId,
      reference: checkout.reference,
      status: "PENDING",
      providerTransactionId: null,
      providerStatus: null,
      totalInCents: checkout.amounts.total,
      currency: "COP",
      failureReason: null,
    });
    jest.mocked(api.processPayment).mockResolvedValue({
      transactionId: checkout.transactionId,
      reference: checkout.reference,
      providerTransactionId: "provider-1",
      status: "APPROVED",
      message: null,
    });
  });

  it("validates required customer information", () => {
    render(
      <CheckoutModal product={product} quantity={1} onClose={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Escribe tu nombre");
  });

  it("validates each customer and card section before preparing the payment", async () => {
    const { container } = render(
      <CheckoutModal product={product} quantity={1} onClose={jest.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/^Nombre$/), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("apellido");

    fireEvent.change(screen.getByLabelText("Apellido"), {
      target: { value: "Pérez" },
    });
    fireEvent.change(screen.getByLabelText("Correo"), {
      target: { value: "invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("nombre@dominio.com");

    fireEvent.change(screen.getByLabelText("Correo"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Celular"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("celular colombiano");

    fireEvent.change(screen.getByLabelText("Celular"), {
      target: { value: "3001234567" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("dirección");

    fireEvent.change(screen.getByLabelText("Dirección"), {
      target: { value: "Calle 1" },
    });
    fireEvent.change(screen.getByLabelText("Ciudad"), {
      target: { value: "Bogotá" },
    });
    fireEvent.change(screen.getByLabelText("Departamento"), {
      target: { value: "Bogotá" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("entre 13 y 19");

    fireEvent.change(screen.getByLabelText(/Número de tarjeta/), {
      target: { value: "4242424242424242" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("titular");

    fireEvent.change(screen.getByLabelText("Nombre del titular"), {
      target: { value: "ANA PEREZ" },
    });
    fireEvent.change(screen.getByLabelText("Vencimiento"), {
      target: { value: "0120" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("vencida");

    fireEvent.change(screen.getByLabelText("Vencimiento"), {
      target: { value: "1240" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("CVC");

    fireEvent.change(screen.getByLabelText("CVC"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Revisa tu compra" });

    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Debes aceptar");
  });

  it("completes the three checkout steps and shows an approved payment", async () => {
    const onClose = jest.fn();
    render(<CheckoutModal product={product} quantity={1} onClose={onClose} />);

    fillDelivery();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(
      screen.getByRole("heading", { name: "Datos de la tarjeta" }),
    ).toBeVisible();

    fillCard();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Revisa tu compra" });

    screen
      .getAllByRole("checkbox")
      .forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pago" }));

    expect(
      await screen.findByRole("heading", { name: "¡Pago aprobado!" }),
    ).toBeVisible();
    expect(api.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: product.id,
        quantity: 1,
      }),
    );
    expect(api.processPayment).toHaveBeenCalledWith(
      checkout.transactionId,
      expect.objectContaining({ cardToken: "card-token" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Volver a productos" }));
    expect(onClose).toHaveBeenCalled();
    expect(sessionStorage.getItem("tumarked.checkout.progress")).toBeNull();
  });

  it("shows preparation errors without advancing to the summary", async () => {
    jest
      .mocked(paymentProvider.getAcceptance)
      .mockRejectedValue(new Error("Proveedor temporalmente no disponible"));
    render(
      <CheckoutModal product={product} quantity={1} onClose={jest.fn()} />,
    );

    fillDelivery();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fillCard();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Proveedor temporalmente no disponible",
    );
  });

  it("restores a saved transaction and reconciles its final state", async () => {
    saveCheckoutProgress({
      productId: product.id,
      quantity: 1,
      step: 2,
      form: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "ana@example.com",
        phone: "3001234567",
        address: "Calle 1",
        city: "Bogotá",
        department: "Bogotá",
        postalCode: "",
        instructions: "",
        installments: "1",
      },
      checkout,
    });
    jest.mocked(api.getTransaction).mockResolvedValue({
      id: checkout.transactionId,
      reference: checkout.reference,
      status: "APPROVED",
      providerTransactionId: "provider-1",
      providerStatus: "APPROVED",
      totalInCents: checkout.amounts.total,
      currency: "COP",
      failureReason: null,
    });

    render(
      <CheckoutModal product={product} quantity={1} onClose={jest.fn()} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "¡Pago aprobado!" }),
      ).toBeVisible();
    });
    expect(api.createCheckout).not.toHaveBeenCalled();
  });
});
