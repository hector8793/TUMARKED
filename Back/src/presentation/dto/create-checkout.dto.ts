import { Type } from 'class-transformer';
import {
  IsEmail, IsInt, IsOptional, IsString, IsUUID, Matches,
  Length, Max, Min, ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CustomerDto {
  @ApiProperty() @IsString() @Length(1, 100) firstName: string;
  @ApiProperty() @IsString() @Length(1, 100) lastName: string;
  @ApiProperty() @IsEmail() @Length(3, 254) email: string;
  @ApiProperty({ example: '3001234567' })
  @Matches(/^(\+57)?3\d{9}$/, { message: 'El celular debe ser un número colombiano válido' })
  phone: string;
}

class DeliveryDto {
  @ApiProperty() @IsString() @Length(3, 255) address: string;
  @ApiProperty() @IsString() @Length(2, 120) city: string;
  @ApiProperty() @IsString() @Length(2, 120) department: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 20) postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 500) instructions?: string;
}

export class CreateCheckoutDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty({ minimum: 1, maximum: 100 }) @IsInt() @Min(1) @Max(100) quantity: number;
  @ApiProperty({ type: CustomerDto }) @ValidateNested() @Type(() => CustomerDto) customer: CustomerDto;
  @ApiProperty({ type: DeliveryDto }) @ValidateNested() @Type(() => DeliveryDto) delivery: DeliveryDto;
}
