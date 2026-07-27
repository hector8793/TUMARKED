import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class ProcessPaymentDto {
  @ApiProperty({
    example: 'tok_test_example_123456789',
    description: 'Token temporal generado directamente por la pasarela',
  })
  @IsString() @Length(10, 300) cardToken: string;
  @ApiProperty({ minimum: 1, maximum: 36, example: 1 })
  @IsInt() @Min(1) @Max(36) installments: number;
  @ApiProperty({
    example: 'acceptance_test_example_123456789',
    description: 'Token de aceptación de términos',
  })
  @IsString() @Length(20, 3000) acceptanceToken: string;
  @ApiProperty({
    example: 'personal_auth_test_example_123456789',
    description: 'Token de autorización de tratamiento de datos',
  })
  @IsString() @Length(20, 3000) acceptPersonalAuth: string;
}
