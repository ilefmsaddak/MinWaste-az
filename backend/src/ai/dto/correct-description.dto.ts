import { IsString, MinLength, MaxLength } from 'class-validator';

export class CorrectDescriptionDto {
  @IsString()
  @MinLength(1, { message: 'Description cannot be empty' })
  @MaxLength(5000, { message: 'Description cannot exceed 5000 characters' })
  description: string;
}

export class DescriptionCorrectionResponse {
  corrected: string;
  original: string;
}
