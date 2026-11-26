import { RequestHandler } from 'express';
import { OptionalAuthenticatedRequest } from 'src/types/http';
import { ChatRequest } from 'src/types/chat-account';
import { requireChatActor } from 'src/services/chat-account.service';
import { AuthError } from 'src/utils/error.response';

export const requireChatUser: RequestHandler = (req: OptionalAuthenticatedRequest, _res, next) => {
  if (!req.user) return next(new AuthError());
  requireChatActor(req.user.userId)
    .then((actor) => {
      req.user = { userId: actor.accountId, email: actor.email, role: actor.role };
      (req as unknown as ChatRequest).chatUser = actor;
      next();
    })
    .catch(next);
};
