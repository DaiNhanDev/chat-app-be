import { Request } from 'express';
import { RoleType } from 'src/constants';
import { RoomReadInfo } from 'src/types/chat';

export interface ChatActor {
  accountId: string;
  role: RoleType;
  uid: string;
  displayName: string;
  email: string;
}
export interface ChatRequest extends Request {
  chatUser: ChatActor;
}
export interface CreateConversationInput {
  participantIds: string[];
}
export interface ConversationInfo extends RoomReadInfo {
  title: string;
  members: Record<string, string>;
  memberSlots?: Record<string, string>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  lastMessage: string;
  lastMessageId: string;
  lastSenderId: string;
}
export interface Conversation extends Omit<
  ConversationInfo,
  'memberIds' | 'memberSlots' | 'readState' | 'unreadRevision'
> {
  id: string;
  memberIds: string[];
  unreadCount: number;
  unreadRecipients: number;
  unreadRevision: number;
}
