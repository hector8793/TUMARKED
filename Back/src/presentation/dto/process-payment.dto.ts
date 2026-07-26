import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class ProcessPaymentDto {
  @ApiProperty() @IsString() @Length(10, 300) cardToken: string;
  @ApiProperty({ minimum: 1, maximum: 36 }) @IsInt() @Min(1) @Max(36) installments: number;
  @ApiProperty() @IsString() @Length(20, 3000) acceptanceToken: string;
  @ApiProperty() @IsString() @Length(20, 3000) acceptPersonalAuth: string;
}
