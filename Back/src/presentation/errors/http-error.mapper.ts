import { HttpException, NotFoundException } from '@nestjs/common';
import { ApplicationError } from '../../domain/errors/application-error';
import { Result } from '../../domain/result/result';

export function toHttpException(error: ApplicationError): HttpException {
  switch (error.code) {
    case 'PRODUCT_NOT_FOUND':
      return new NotFoundException(error);
  }
}

export function unwrapHttpResult<T>(
  result: Result<T, ApplicationError>,
): T {
  if (result.ok) return result.value;
  throw toHttpException(result.error);
}
