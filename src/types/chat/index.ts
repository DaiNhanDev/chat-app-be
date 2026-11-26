import { Request } from 'express';

export interface FirebaseRequest extends Request {
  firebaseUser: { uid: string };
}

export interface SendMessageInput {
  text: string;
  clientMessageId: string;
}

export interface StoredMessage {
  senderId: string;
  text: string;
  createdAt: number;
  sequence?: number;
}

export interface RoomReadState {
  through: number;
  unreadCount: number;
}

export interface RoomReadInfo {
  memberIds: Record<string, boolean>;
  readState?: Record<string, RoomReadState>;
  unreadRevision?: number;
}

export interface ChatRoom {
  info: RoomReadInfo & {
    messageSequence?: number;
    [field: string]: unknown;
  };
  messages?: Record<string, StoredMessage>;
  deletedMessages?: Record<string, string>;
  [field: string]: unknown;
}

export interface SavedMessage {
  message: StoredMessage & { id: string };
  duplicate: boolean;
  recipientIds: string[];
}
