import { IsString, MinLength } from 'class-validator';

export class OpenConversationDto {
  @IsString()
  @MinLength(1)
  currentUserId!: string;

  @IsString()
  @MinLength(1)
  otherUserId!: string;
}
