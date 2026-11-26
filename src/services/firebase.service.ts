import { firebaseDatabase, firebaseMessaging } from 'src/configs/firebase.config';
import { env } from 'src/configs/env.config';
import { ChatRepository } from 'src/repositories/chat.repository';
import { PushDeviceRepository } from 'src/repositories/push-device.repository';
import { ChatService } from 'src/services/chat.service';
import { PushService } from 'src/services/push.service';

import { ConversationRepository } from 'src/repositories/conversation.repository';
import { ConversationService } from 'src/services/conversation.service';

export const conversationService = new ConversationService(
  new ConversationRepository(firebaseDatabase),
);
export const pushDeviceRepository = new PushDeviceRepository(firebaseDatabase);
export const pushService = new PushService(pushDeviceRepository, firebaseMessaging, {
  baseUrl: env.pwaBaseUrl,
  timeoutMs: env.pushTimeoutMs,
});
export const chatService = new ChatService(new ChatRepository(firebaseDatabase), pushService);
