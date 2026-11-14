import { Router } from 'express';
import { ChatController } from 'src/controllers/chat.controller';
import { PushDeviceController } from 'src/controllers/push-device.controller';
import { FirebaseTokenVerifier, requireFirebaseUser } from 'src/middlewares/requireFirebaseUser';
import { validateRequest } from 'src/middlewares/validateRequest';
import { PushDeviceRepository } from 'src/repositories/push-device.repository';
import { ChatService } from 'src/services/chat.service';
import { chatSchemas } from 'src/validators/chat.validator';
import { catchError } from 'src/utils/handleError';

export const createChatRouter = (dependencies: {
  verifyToken?: FirebaseTokenVerifier;
  chat: Pick<ChatService, 'send'>;
  devices: Pick<PushDeviceRepository, 'register' | 'unregister'>;
}) => {
  const router = Router();
  const messages = new ChatController(dependencies.chat);
  const devices = new PushDeviceController(dependencies.devices);
  const authenticate = requireFirebaseUser(dependencies.verifyToken);
  router.post(
    '/conversations/:conversationId/messages',
    authenticate,
    validateRequest(chatSchemas.conversationParams, 'params'),
    validateRequest(chatSchemas.message),
    catchError(messages.send),
  );
  router.put(
    '/push/devices/:deviceId',
    authenticate,
    validateRequest(chatSchemas.deviceParams, 'params'),
    validateRequest(chatSchemas.device),
    catchError(devices.register),
  );
  router.delete(
    '/push/devices/:deviceId',
    authenticate,
    validateRequest(chatSchemas.deviceParams, 'params'),
    catchError(devices.unregister),
  );
  return router;
};
