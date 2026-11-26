import { firebaseDatabase, firebaseMessaging } from 'src/configs/firebase.config';
import { ROLE } from 'src/constants';
import { userRepository } from 'src/repositories/user.repository';
import { env } from 'src/configs/env.config';
import { ChatRepository } from 'src/repositories/chat.repository';
import { PushDeviceRepository } from 'src/repositories/push-device.repository';
import { ChatService } from 'src/services/chat.service';
import { PushService } from 'src/services/push.service';

import { ConversationRepository } from 'src/repositories/conversation.repository';
import { ConversationService } from 'src/services/conversation.service';

const conversationRepository = new ConversationRepository(firebaseDatabase);
export const conversationService = new ConversationService(conversationRepository);
export const pushDeviceRepository = new PushDeviceRepository(firebaseDatabase);
export const pushService = new PushService(pushDeviceRepository, firebaseMessaging, {
  baseUrl: env.pwaBaseUrl,
  timeoutMs: env.pushTimeoutMs,
  unreadSummary: async (uid) => {
    const rooms = await conversationRepository.list(uid);
    const unreadCount = rooms.reduce((total, room) => total + room.unreadCount, 0);
    const peers = new Set(
      rooms.flatMap((room) =>
        room.memberIds.length === 2 && room.unreadRecipients > 0
          ? room.memberIds.filter((memberUid) => memberUid !== uid)
          : [],
      ),
    );
    const roles = await userRepository.chatRoles([uid, ...peers]);
    if (roles.get(uid) !== ROLE.ADMIN) return { unreadCount };
    const unreadUsers = [...peers].filter((peer) => roles.get(peer) === ROLE.USER).length;
    return { unreadCount, unreadUsers };
  },
});
export const chatService = new ChatService(new ChatRepository(firebaseDatabase), pushService);
