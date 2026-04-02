export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
}

export interface SendChatMessagePayload {
  conversationId?: string;
  senderId?: string;
  text?: string;
}
