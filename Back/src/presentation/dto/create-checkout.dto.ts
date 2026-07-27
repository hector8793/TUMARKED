import { Type } from 'class-transformer';
import {
  IsEmail, IsInt, IsOptional, IsString, IsUUID, Matches,
  Length, Max, Min, ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CustomerDto {
  @ApiProperty({ example: 'Ana' }) @IsString() @Length(1, 100) firstName: string;
  @ApiProperty({ example: 'Pérez' }) @IsString() @Length(1, 100) lastName: string;
  @ApiProperty({ example: 'ana.perez@example.com' })
  @IsEmail() @Length(3, 254) email: string;
  @ApiProperty({ example: '3001234567', description: 'Celular colombiano' })
  @Matches(/^(\+57)?3\d{9}$/, { message: 'El celular debe ser un número colombiano válido' })
  phone: string;
}

class DeliveryDto {
  @ApiProperty({ example: 'Carrera 7 # 72-41' })
  @IsString() @Length(3, 255) address: string;
  @ApiProperty({ example: 'Bogotá' }) @IsString() @Length(2, 120) city: string;
  @ApiProperty({ example: 'Bogotá D.C.' })
  @IsString() @Length(2, 120) department: string;
  @ApiPropertyOptional({ example: '110221' })
  @IsOptional() @IsString() @Length(1, 20) postalCode?: string;
  @ApiPropertyOptional({ example: 'Entregar en recepción' })
  @IsOptional() @IsString() @Length(1, 500) instructions?: string;
}

export class CreateCheckoutDto {
  @ApiProperty({
    format: 'uuid',
    example: '7dc1fdb7-6b25-4b8f-9582-d465d189c272',
  })
  @IsUUID() productId: string;
  @ApiProperty({ minimum: 1, maximum: 100, example: 1 })
  @IsInt() @Min(1) @Max(100) quantity: number;
  @ApiProperty({ type: CustomerDto }) @ValidateNested() @Type(() => CustomerDto) customer: CustomerDto;
  @ApiProperty({ type: DeliveryDto }) @ValidateNested() @Type(() => DeliveryDto) delivery: DeliveryDto;
}
