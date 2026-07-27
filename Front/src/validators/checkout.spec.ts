import {
  normalizeColombianPhone,
  normalizeEmail,
  validateCheckoutDetails,
  type CheckoutDetails,
} from "./checkout";

const valid: CheckoutDetails = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "300 123 4567",
  address: "Calle 1",
  city: "Bogotá",
  department: "Bogotá",
  postalCode: "",
  instructions: "",
};

describe("checkout details validation", () => {
  it("normalizes common email and Colombian phone formats", () => {
    expect(normalizeEmail(" ANA.PEREZ @ Example.COM ")).toBe(
      "ana.perez@example.com",
    );
    expect(normalizeColombianPhone("300 123 4567")).toBe("3001234567");
    expect(normalizeColombianPhone("57 300 123 4567")).toBe("+573001234567");
    expect(normalizeColombianPhone("0057 300 123 4567")).toBe("+573001234567");
  });

  it("accepts data aligned with the backend DTO", () => {
    expect(validateCheckoutDetails(valid)).toBe("");
    expect(
      validateCheckoutDetails({
        ...valid,
        email: " ANA.PEREZ @ Example.COM ",
        phone: "+57 300 123 4567",
      }),
    ).toBe("");
  });

  it.each([
    ["firstName", "", "nombre"],
    ["firstName", "a".repeat(101), "100"],
    ["lastName", "", "apellido"],
    ["lastName", "a".repeat(101), "100"],
    ["email", "correo-invalido", "nombre@dominio.com"],
    ["email", `${"a".repeat(250)}@example.com`, "nombre@dominio.com"],
    ["phone", "123", "celular colombiano"],
    ["address", "a", "al menos 3"],
    ["address", "a".repeat(256), "255"],
    ["city", "a", "al menos 2"],
    ["city", "a".repeat(121), "120"],
    ["department", "a", "al menos 2"],
    ["department", "a".repeat(121), "120"],
    ["postalCode", "1".repeat(21), "20"],
    ["instructions", "a".repeat(501), "500"],
  ] as const)("rejects invalid %s values", (field, value, message) => {
    expect(validateCheckoutDetails({ ...valid, [field]: value })).toContain(
      message,
    );
  });
});
