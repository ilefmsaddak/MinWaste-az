import { IsString, MinLength } from 'class-validator';

export class SendChatMessageDto {
  @IsString()
  @MinLength(1)
  conversationId!: string;

  @IsString()
  @MinLength(1)
  senderId!: string;

  @IsString()
  @MinLength(1)
  text!: string;
}
