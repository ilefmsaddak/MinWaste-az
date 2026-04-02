import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { price_type } from '@prisma/client';

export class UpdateItemDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsOptional()
  photos?: string[];

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  locationLat?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  locationLng?: number;

  @IsString()
  @IsOptional()
  locationAddr?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @IsEnum(price_type)
  @IsOptional()
  priceType?: price_type;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  priceValue?: number;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
