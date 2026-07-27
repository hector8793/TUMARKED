import type { CheckoutResponse } from "./api";

const STORAGE_KEY = "tumarked.checkout.progress";

export interface CheckoutDraftForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  department: string;
  postalCode: string;
  instructions: string;
  installments: string;
}

export interface CheckoutProgress {
  productId: string;
  quantity: number;
  step: 1 | 2;
  form: CheckoutDraftForm;
  checkout?: CheckoutResponse;
}

export function loadCheckoutProgress(
  storage: Pick<Storage, "getItem"> = sessionStorage,
): CheckoutProgress | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const progress = JSON.parse(raw) as Partial<CheckoutProgress>;
    if (
      typeof progress.productId !== "string" ||
      typeof progress.quantity !== "number" ||
      (progress.step !== 1 && progress.step !== 2) ||
      !progress.form
    )
      return null;
    return progress as CheckoutProgress;
  } catch {
    return null;
  }
}

export function saveCheckoutProgress(
  progress: CheckoutProgress,
  storage: Pick<Storage, "setItem"> = sessionStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function clearCheckoutProgress(
  storage: Pick<Storage, "removeItem"> = sessionStorage,
): void {
  storage.removeItem(STORAGE_KEY);
}

export function safeCheckoutForm(form: CheckoutDraftForm): CheckoutDraftForm {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    address: form.address,
    city: form.city,
    department: form.department,
    postalCode: form.postalCode,
    instructions: form.instructions,
    installments: form.installments,
  };
}
