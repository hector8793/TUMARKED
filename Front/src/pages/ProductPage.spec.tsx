import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { saveCheckoutProgress } from "../services/checkout-progress";
import { ProductPage } from "./ProductPage";

jest.mock("../app/hooks", () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));

jest.mock("../features/products/productsSlice", () => ({
  fetchProducts: jest.fn(() => ({ type: "products/fetch" })),
}));

jest.mock("../components/CheckoutModal", () => ({
  CheckoutModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="checkout-modal">
      <button onClick={onClose}>Cerrar checkout</button>
    </div>
  ),
}));

const product = {
  id: "product-1",
  sku: "TM-001",
  name: "Audífonos",
  description: "Producto de prueba",
  priceInCents: 100000,
  stock: 3,
  imageUrl: "/headphones.webp",
  active: true,
};

describe("ProductPage", () => {
  const dispatch = jest.fn();
  let productsState: {
    items: (typeof product)[];
    status: "idle" | "loading" | "succeeded" | "failed";
    error: string | null;
  };

  beforeEach(() => {
    sessionStorage.clear();
    dispatch.mockClear();
    productsState = { items: [product], status: "succeeded", error: null };
    jest.mocked(useAppDispatch).mockReturnValue(dispatch);
    jest.mocked(useAppSelector).mockImplementation((selector) =>
      selector({
        products: productsState,
      } as never),
    );
  });

  it("renders products, changes quantity and opens the checkout", () => {
    render(
      <MemoryRouter>
        <ProductPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Audífonos")).toBeVisible();
    expect(screen.getByText("3 disponibles")).toBeVisible();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Pagar con tarjeta" }));
    expect(screen.getByTestId("checkout-modal")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar checkout" }));
    expect(screen.queryByTestId("checkout-modal")).not.toBeInTheDocument();
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("restores the selected product after a refresh", async () => {
    saveCheckoutProgress({
      productId: product.id,
      quantity: 2,
      step: 1,
      form: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        department: "",
        postalCode: "",
        instructions: "",
        installments: "1",
      },
    });

    render(
      <MemoryRouter>
        <ProductPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("checkout-modal")).toBeVisible(),
    );
    expect(screen.getByRole("combobox")).toHaveValue("2");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar checkout" }));
    expect(screen.queryByTestId("checkout-modal")).not.toBeInTheDocument();
  });

  it("renders loading, error and unavailable states", () => {
    productsState = {
      items: [{ ...product, active: false, stock: 0 }],
      status: "loading",
      error: "No disponible",
    };

    render(
      <MemoryRouter>
        <ProductPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Cargando productos");
    expect(screen.getByRole("alert")).toHaveTextContent("No disponible");
    expect(screen.getByText("Agotado")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Pagar con tarjeta" }),
    ).toBeDisabled();
  });
});
