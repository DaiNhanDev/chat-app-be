import { Response } from 'express';
import { ChatService } from 'src/services/chat.service';
import { ChatRequest } from 'src/types/chat-account';
import { SuccessResponse } from 'src/utils/success.response';

export class ChatController {
  constructor(private readonly service: Pick<ChatService, 'send' | 'deleteMessage' | 'markRead'>) {}

  send = async (req: ChatRequest, res: Response) => {
    const data = await this.service.send(req.params.conversationId!, req.chatUser.uid, req.body);
    return new SuccessResponse({ data, statusCode: data.duplicate ? 200 : 201 }).send(res);
  };

  deleteMessage = async (req: ChatRequest, res: Response) => {
    const data = await this.service.deleteMessage(
      req.params.conversationId!,
      req.chatUser.uid,
      req.params.messageId!,
    );
    return new SuccessResponse({ data }).send(res);
  };

  markRead = async (req: ChatRequest, res: Response) => {
    const data = await this.service.markRead(
      req.params.conversationId!,
      req.chatUser.uid,
      req.body.throughMessageId,
    );
    return new SuccessResponse({ data }).send(res);
  };
}
