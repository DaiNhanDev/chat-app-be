import { Response } from 'express';
import { ConversationService } from 'src/services/conversation.service';
import { ChatRequest } from 'src/types/chat-account';
import { SuccessResponse } from 'src/utils/success.response';

export class ConversationController {
  constructor(private readonly service: ConversationService) {}

  people = async (req: ChatRequest, res: Response) => {
    const data = await this.service.findPerson(String(req.query.email));
    return new SuccessResponse({ data }).send(res);
  };

  create = async (req: ChatRequest, res: Response) => {
    const data = await this.service.create(req.chatUser, req.body);
    return new SuccessResponse({ data, statusCode: 201 }).send(res);
  };

  list = async (req: ChatRequest, res: Response) => {
    const data = await this.service.list(req.chatUser.uid);
    return new SuccessResponse({ data }).send(res);
  };
}
