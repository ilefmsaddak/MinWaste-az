import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { OpenConversationDto } from './dto/open-conversation.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('users')
  async getAvailableUsers(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit);
    const safeLimit =
      Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;
    return this.chatService.getAvailableUsers(safeLimit);
  }

  @Get('conversations')
  async getConversations(@Query('userId') userId: string) {
    return this.chatService.getConversationsForUser(userId);
  }

  @Post('conversations/open')
  async openConversation(@Body() body: OpenConversationDto) {
    return this.chatService.openConversation({
      currentUserId: body.currentUserId,
      otherUserId: body.otherUserId,
    });
  }

  @Get('messages')
  async getMessages(
    @Query('conversationId') conversationId: string,
    @Query('userId') userId: string,
  ) {
    return this.chatService.getMessages(conversationId, userId);
  }

  @Post('messages')
  async sendMessage(@Body() body: SendChatMessageDto) {
    const message = await this.chatService.createMessage(
      body.conversationId,
      body.senderId,
      body.text,
    );
    this.chatGateway.emitPrivateMessage(message);
    return message;
  }
}
