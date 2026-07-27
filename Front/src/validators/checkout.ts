export interface CheckoutDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  department: string;
  postalCode: string;
  instructions: string;
}

export function normalizeEmail(value: string): string {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

export function normalizeColombianPhone(value: string): string {
  const compact = value.replace(/[^\d+]/g, "");
  if (compact.startsWith("0057")) return `+57${compact.slice(4)}`;
  if (compact.startsWith("57") && compact.length === 12) return `+${compact}`;
  return compact;
}

export function validateCheckoutDetails(form: CheckoutDetails): string {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const email = normalizeEmail(form.email);
  const address = form.address.trim();
  const city = form.city.trim();
  const department = form.department.trim();

  if (!firstName) return "Escribe tu nombre.";
  if (firstName.length > 100)
    return "El nombre no puede superar 100 caracteres.";
  if (!lastName) return "Escribe tu apellido.";
  if (lastName.length > 100)
    return "El apellido no puede superar 100 caracteres.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return "Escribe un correo como nombre@dominio.com.";
  }
  if (!/^(\+57)?3\d{9}$/.test(normalizeColombianPhone(form.phone))) {
    return "Escribe un celular colombiano válido, por ejemplo 300 123 4567.";
  }
  if (address.length < 3)
    return "La dirección debe tener al menos 3 caracteres.";
  if (address.length > 255)
    return "La dirección no puede superar 255 caracteres.";
  if (city.length < 2) return "La ciudad debe tener al menos 2 caracteres.";
  if (city.length > 120) return "La ciudad no puede superar 120 caracteres.";
  if (department.length < 2)
    return "El departamento debe tener al menos 2 caracteres.";
  if (department.length > 120) {
    return "El departamento no puede superar 120 caracteres.";
  }
  if (form.postalCode.trim().length > 20) {
    return "El código postal no puede superar 20 caracteres.";
  }
  if (form.instructions.trim().length > 500) {
    return "Las indicaciones no pueden superar 500 caracteres.";
  }
  return "";
}
