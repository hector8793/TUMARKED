export type ApplicationError = ProductNotFoundError;

export interface ProductNotFoundError {
  code: 'PRODUCT_NOT_FOUND';
  message: string;
}
