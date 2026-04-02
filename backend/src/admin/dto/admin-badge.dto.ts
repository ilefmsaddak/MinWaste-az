import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateAdminBadgeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsString()
  @MinLength(1)
  icon!: string;

  @IsInt()
  @Min(1)
  pointsRequired!: number;
}

export class UpdateAdminBadgeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pointsRequired?: number;
}
