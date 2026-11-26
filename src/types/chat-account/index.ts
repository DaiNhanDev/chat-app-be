import { Request } from 'express';
import { RoleType } from 'src/constants';

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
export interface ConversationInfo {
  title: string;
  memberIds: Record<string, boolean>;
  members: Record<string, string>;
  memberSlots?: Record<string, string>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  lastMessage: string;
  lastMessageId: string;
  lastSenderId: string;
}
export interface Conversation extends Omit<ConversationInfo, 'memberIds' | 'memberSlots'> {
  id: string;
  memberIds: string[];
}
