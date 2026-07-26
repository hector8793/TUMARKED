import { FormEvent, useMemo, useState } from "react";
import type { Product } from "../models/product";
import {
  api,
  type CheckoutResponse,
  type CreateCheckoutRequest,
} from "../services/api";
import { formatCop } from "../utils/money";
import { cardBrand, passesLuhn } from "../validators/card";
import {
  paymentProvider,
  type PaymentAcceptance,
} from "../services/payment-provider";

interface Props {
  product: Product;
  quantity: number;
  onClose: () => void;
}

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  department: "",
  postalCode: "",
  instructions: "",
  cardNumber: "",
  cardHolder: "",
  expiry: "",
  cvc: "",
  installments: "1",
};

type CheckoutResult = CheckoutResponse & {
  providerTransactionId?: string;
  message?: string | null;
};

export function CheckoutModal({ product, quantity, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [acceptance, setAcceptance] = useState<PaymentAcceptance | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPersonalData, setAcceptedPersonalData] = useState(false);
  const brand = useMemo(() => cardBrand(form.cardNumber), [form.cardNumber]);
  const update = (name: keyof typeof form, value: string) =>
    setForm({ ...form, [name]: value });

  const validateDetails = () => {
    if (!form.firstName.trim()) return "Escribe tu nombre.";
    if (!form.lastName.trim()) return "Escribe tu apellido.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return "Escribe un correo electrónico válido.";
    if (!/^(\+57)?3\d{9}$/.test(normalizePhone(form.phone))) {
      return "Escribe un celular colombiano válido, por ejemplo 300 123 4567.";
    }
    if (!form.address || !form.city || !form.department)
      return "Completa los datos obligatorios de entrega.";
    return "";
  };

  const validateCard = () => {
    const expiry = /^(\d{2})\/(\d{2})$/.exec(form.expiry);
    const cardDigits = form.cardNumber.replace(/\D/g, "");
    if (cardDigits.length < 13 || cardDigits.length > 19) {
      return "El número de tarjeta debe tener entre 13 y 19 dígitos.";
    }
    if (!form.cardHolder.trim()) return "Escribe el nombre del titular.";
    if (!expiry) return "Usa el formato MM/AA para el vencimiento.";
    const expiration = new Date(
      2000 + Number(expiry[2]),
      Number(expiry[1]),
      0,
      23,
      59,
      59,
    );
    if (
      Number(expiry[1]) < 1 ||
      Number(expiry[1]) > 12 ||
      expiration < new Date()
    )
      return "La tarjeta está vencida.";
    if (!/^\d{3,4}$/.test(form.cvc)) return "El CVC no es válido.";
    return "";
  };

  const next = async () => {
    const message = step === 1 ? validateDetails() : validateCard();
    if (message) return setError(message);
    setError("");
    if (step === 1) {
      setStep(2);
      return;
    }
    setLoading(true);
    try {
      setAcceptance(await paymentProvider.getAcceptance());
      setStep(3);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible preparar el pago.",
      );
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    if (!acceptance || !acceptedTerms || !acceptedPersonalData) {
      setError(
        "Debes aceptar los términos y la autorización de datos para pagar.",
      );
      return;
    }
    setLoading(true);
    setError("");
    const payload: CreateCheckoutRequest = {
      productId: product.id,
      quantity,
      customer: {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: normalizePhone(form.phone),
      },
      delivery: {
        address: form.address,
        city: form.city,
        department: form.department,
        postalCode: form.postalCode || undefined,
        instructions: form.instructions || undefined,
      },
    };
    try {
      const expiry = form.expiry.split("/");
      const cardToken = await paymentProvider.tokenizeCard({
        number: form.cardNumber,
        cvc: form.cvc,
        expMonth: expiry[0],
        expYear: expiry[1],
        cardHolder: form.cardHolder,
      });
      const checkout = await api.createCheckout(payload);
      const payment = await api.processPayment(checkout.transactionId, {
        cardToken,
        installments: Number(form.installments),
        acceptanceToken: acceptance.acceptanceToken,
        acceptPersonalAuth: acceptance.personalDataToken,
      });
      let status = payment.status;
      let providerTransactionId = payment.providerTransactionId;
      let message = payment.message;
      if (status === "PENDING" || status === "PROCESSING") {
        const final = await waitForFinalStatus(checkout.transactionId);
        status = final.status;
        providerTransactionId =
          final.providerTransactionId ?? providerTransactionId;
        message = final.failureReason;
      }
      setResult({ ...checkout, status, providerTransactionId, message });
      setForm((current) => ({
        ...current,
        cardNumber: "",
        expiry: "",
        cvc: "",
      }));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible crear el checkout.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="checkout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
      >
        <button className="close" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
        {result ? (
          <div className="checkout-result">
            <span
              className={`result-icon result-${result.status.toLowerCase()}`}
            >
              {result.status === "APPROVED"
                ? "✓"
                : result.status === "PENDING" || result.status === "PROCESSING"
                  ? "…"
                  : "!"}
            </span>
            <p className="eyebrow">RESULTADO DEL PAGO</p>
            <h2 id="checkout-title">{paymentTitle(result.status)}</h2>
            <p>
              Referencia <strong>{result.reference}</strong>
            </p>
            {result.providerTransactionId && (
              <p>
                ID de la pasarela{" "}
                <strong>{result.providerTransactionId}</strong>
              </p>
            )}
            <div className="total-line">
              <span>Total</span>
              <strong>{formatCop(result.amounts.total)}</strong>
            </div>
            <p className="pending-note">
              Estado: {result.status}.{" "}
              {result.message ?? paymentDescription(result.status)}
            </p>
            <button className="primary wide" onClick={onClose}>
              Volver a productos
            </button>
          </div>
        ) : (
          <form onSubmit={confirm}>
            <p className="eyebrow">COMPRA SEGURA · PASO {step} DE 3</p>
            <h2 id="checkout-title">
              {step === 1
                ? "¿Dónde entregamos?"
                : step === 2
                  ? "Datos de la tarjeta"
                  : "Revisa tu compra"}
            </h2>
            <div className="steps">
              <i className="active" />
              <i className={step >= 2 ? "active" : ""} />
              <i className={step >= 3 ? "active" : ""} />
            </div>
            {step === 1 && (
              <div className="form-grid">
                <Field
                  label="Nombre"
                  value={form.firstName}
                  onChange={(v) => update("firstName", v)}
                />
                <Field
                  label="Apellido"
                  value={form.lastName}
                  onChange={(v) => update("lastName", v)}
                />
                <Field
                  label="Correo"
                  type="email"
                  value={form.email}
                  onChange={(v) => update("email", v)}
                />
                <Field
                  label="Celular"
                  placeholder="300 123 4567"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(v) => update("phone", formatPhone(v))}
                />
                <Field
                  wide
                  label="Dirección"
                  value={form.address}
                  onChange={(v) => update("address", v)}
                />
                <Field
                  label="Ciudad"
                  value={form.city}
                  onChange={(v) => update("city", v)}
                />
                <Field
                  label="Departamento"
                  value={form.department}
                  onChange={(v) => update("department", v)}
                />
                <Field
                  label="Código postal (opcional)"
                  value={form.postalCode}
                  onChange={(v) => update("postalCode", v)}
                />
                <Field
                  label="Indicaciones (opcional)"
                  value={form.instructions}
                  onChange={(v) => update("instructions", v)}
                />
              </div>
            )}
            {step === 2 && (
              <div className="form-grid">
                <label className="field wide">
                  <span>Número de tarjeta {brand && <b>{brand}</b>}</span>
                  <input
                    inputMode="numeric"
                    autoComplete="cc-number"
                    maxLength={23}
                    value={form.cardNumber}
                    onChange={(e) =>
                      update("cardNumber", formatCardNumber(e.target.value))
                    }
                    placeholder="4242 4242 4242 4242"
                  />
                  <small>
                    Usa una tarjeta de prueba de la pasarela de pagos. Separamos
                    los números automáticamente.
                  </small>
                  {form.cardNumber.replace(/\D/g, "").length >= 13 &&
                    !passesLuhn(form.cardNumber) && (
                      <small className="field-warning">
                        El número no supera la verificación habitual; podrás
                        continuar, pero la pasarela de pagos podría rechazarlo.
                      </small>
                    )}
                </label>
                <Field
                  wide
                  label="Nombre del titular"
                  placeholder="NOMBRE APELLIDO"
                  autoComplete="cc-name"
                  value={form.cardHolder}
                  onChange={(v) => update("cardHolder", v)}
                />
                <Field
                  label="Vencimiento"
                  placeholder="MM/AA"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  value={form.expiry}
                  onChange={(v) => update("expiry", formatExpiry(v))}
                />
                <Field
                  label="CVC"
                  placeholder="123"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={form.cvc}
                  onChange={(v) =>
                    update("cvc", v.replace(/\D/g, "").slice(0, 4))
                  }
                />
                <label className="field wide">
                  <span>Cuotas</span>
                  <select
                    value={form.installments}
                    onChange={(e) => update("installments", e.target.value)}
                  >
                    {[1, 2, 3, 6, 12].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <p className="security-note wide">
                  La tarjeta se envía directamente a la pasarela de pagos de
                  pruebas para tokenización. TUMARKED nunca recibe ni almacena
                  el número o CVC.
                </p>
              </div>
            )}
            {step === 3 && (
              <div className="summary">
                <div>
                  <span>
                    {product.name} × {quantity}
                  </span>
                  <strong>{formatCop(product.priceInCents * quantity)}</strong>
                </div>
                <div>
                  <span>Tarifa base</span>
                  <strong>{formatCop(500_000)}</strong>
                </div>
                <div>
                  <span>Entrega</span>
                  <strong>{formatCop(1_200_000)}</strong>
                </div>
                <div className="total-line">
                  <span>Total</span>
                  <strong>
                    {formatCop(product.priceInCents * quantity + 1_700_000)}
                  </strong>
                </div>
                <p>
                  Entrega a {form.firstName} {form.lastName}, {form.address},{" "}
                  {form.city}.
                </p>
                {acceptance && (
                  <div className="payment-consents">
                    <label>
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(event) =>
                          setAcceptedTerms(event.target.checked)
                        }
                      />
                      <span>
                        Acepto los{" "}
                        <a
                          href={acceptance.acceptancePermalink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          términos de uso
                        </a>
                        .
                      </span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={acceptedPersonalData}
                        onChange={(event) =>
                          setAcceptedPersonalData(event.target.checked)
                        }
                      />
                      <span>
                        Autorizo el{" "}
                        <a
                          href={acceptance.personalDataPermalink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          tratamiento de datos personales
                        </a>
                        .
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              {step > 1 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setStep(step === 3 ? 2 : 1)}
                >
                  Atrás
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  className="primary"
                  disabled={loading}
                  onClick={() => void next()}
                >
                  {loading ? "Preparando…" : "Continuar"}
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={loading || !acceptedTerms || !acceptedPersonalData}
                >
                  {loading
                    ? "Procesando con la pasarela de pagos…"
                    : "Confirmar pago"}
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  wide = false,
  placeholder,
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  wide?: boolean;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  autoComplete?: string;
}) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function normalizePhone(value: string) {
  const compact = value.replace(/[^\d+]/g, "");
  if (compact.startsWith("0057")) return `+57${compact.slice(4)}`;
  if (compact.startsWith("57") && compact.length === 12) return `+${compact}`;
  return compact;
}

function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2
    ? `${digits.slice(0, 2)}/${digits.slice(2)}`
    : digits;
}

function formatPhone(value: string) {
  const hasCountry = value.trim().startsWith("+57");
  const digits = value.replace(/\D/g, "");
  const local = (hasCountry ? digits.slice(2) : digits).slice(0, 10);
  const formatted = [local.slice(0, 3), local.slice(3, 6), local.slice(6)]
    .filter(Boolean)
    .join(" ");
  return hasCountry ? `+57 ${formatted}` : formatted;
}

async function waitForFinalStatus(transactionId: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const transaction = await api.getTransaction(transactionId);
    if (!["PENDING", "PROCESSING"].includes(transaction.status))
      return transaction;
  }
  return api.getTransaction(transactionId);
}

function paymentTitle(status: string) {
  if (status === "APPROVED") return "¡Pago aprobado!";
  if (status === "DECLINED") return "Pago rechazado";
  if (status === "ERROR") return "No pudimos procesar el pago";
  return "Pago en procesamiento";
}

function paymentDescription(status: string) {
  if (status === "APPROVED")
    return "La entrega fue confirmada y el inventario actualizado.";
  if (status === "DECLINED")
    return "Puedes intentar nuevamente con otro medio de pago.";
  if (status === "ERROR")
    return "Ocurrió un error al comunicarnos con la pasarela.";
  return "Actualizaremos el estado cuando la pasarela de pagos termine de procesarlo.";
}
