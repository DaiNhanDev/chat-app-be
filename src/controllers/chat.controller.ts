import { Response } from 'express';
import { ChatService } from 'src/services/chat.service';
import { FirebaseRequest } from 'src/types/chat';
import { SuccessResponse } from 'src/utils/success.response';

export class ChatController {
  constructor(private readonly service: Pick<ChatService, 'send'>) {}

  send = async (req: FirebaseRequest, res: Response) => {
    const data = await this.service.send(
      req.params.conversationId!,
      req.firebaseUser.uid,
      req.body,
    );
    return new SuccessResponse({ data, statusCode: data.duplicate ? 200 : 201 }).send(res);
  };
}
