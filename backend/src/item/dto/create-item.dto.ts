import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { price_type } from '@prisma/client';

/** multipart envoie tout en string — normaliser avant class-validator */
function toRequiredNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  ownerId: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  description: string;

  @IsString()
  @MinLength(1)
  category: string;

  @IsArray()
  @IsOptional()
  photos?: string[];

  @Transform(({ value }) => toRequiredNumber(value))
  @IsNumber()
  locationLat: number;

  @Transform(({ value }) => toRequiredNumber(value))
  @IsNumber()
  locationLng: number;

  @IsString()
  @MinLength(1)
  locationAddr: string;

  @IsString()
  status: string;

  @Transform(({ value }) => toRequiredNumber(value))
  @IsNumber()
  quantity: number;

  @IsEnum(price_type)
  priceType: price_type;

  @Transform(({ value }) => toRequiredNumber(value))
  @IsNumber()
  priceValue: number;

  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : String(value),
  )
  @IsString()
  @IsOptional()
  expiresAt?: string;
}
