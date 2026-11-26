import { Router } from 'express';
import { ROLE } from 'src/constants';
import { checkRole } from 'src/middlewares/checkRole';
import { ChatController } from 'src/controllers/chat.controller';
import { ConversationController } from 'src/controllers/conversation.controller';
import { PushDeviceController } from 'src/controllers/push-device.controller';
import deserializeUser from 'src/middlewares/deserializeUser';
import requireUser from 'src/middlewares/requiresUser';
import { requireChatUser } from 'src/middlewares/requireChatUser';
import { validateRequest } from 'src/middlewares/validateRequest';
import { PushDeviceRepository } from 'src/repositories/push-device.repository';
import { ChatService } from 'src/services/chat.service';
import { ConversationService } from 'src/services/conversation.service';
import { chatSchemas } from 'src/validators/chat.validator';
import { catchError } from 'src/utils/handleError';

export const createChatRouter = (dependencies: {
  chat: Pick<ChatService, 'send' | 'deleteMessage' | 'markRead'>;
  rooms: ConversationService;
  devices: Pick<PushDeviceRepository, 'register' | 'unregister'>;
}) => {
  const router = Router();
  const messages = new ChatController(dependencies.chat);
  const rooms = new ConversationController(dependencies.rooms);
  const devices = new PushDeviceController(dependencies.devices);
  router.use(['/chat', '/conversations', '/push'], deserializeUser, requireUser, requireChatUser);
  router.get(
    '/chat/people',
    validateRequest(chatSchemas.people, 'query'),
    catchError(rooms.people),
  );
  router.get('/conversations', catchError(rooms.list));
  router.post(
    '/conversations',
    checkRole([ROLE.ADMIN]),
    validateRequest(chatSchemas.conversation),
    catchError(rooms.create),
  );
  router.post(
    '/conversations/:conversationId/messages',
    validateRequest(chatSchemas.conversationParams, 'params'),
    validateRequest(chatSchemas.message),
    catchError(messages.send),
  );
  router.delete(
    '/conversations/:conversationId/messages/:messageId',
    validateRequest(chatSchemas.messageParams, 'params'),
    catchError(messages.deleteMessage),
  );
  router.put(
    '/conversations/:conversationId/read',
    validateRequest(chatSchemas.conversationParams, 'params'),
    validateRequest(chatSchemas.read),
    catchError(messages.markRead),
  );
  router.put(
    '/push/devices/:deviceId',
    validateRequest(chatSchemas.deviceParams, 'params'),
    validateRequest(chatSchemas.device),
    catchError(devices.register),
  );
  router.delete(
    '/push/devices/:deviceId',
    validateRequest(chatSchemas.deviceParams, 'params'),
    catchError(devices.unregister),
  );
  return router;
};
