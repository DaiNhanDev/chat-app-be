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
}

export interface ChatRoom {
  info: {
    memberIds: Record<string, boolean>;
    [field: string]: unknown;
  };
  messages?: Record<string, StoredMessage>;
  [field: string]: unknown;
}

export interface SavedMessage {
  message: StoredMessage & { id: string };
  duplicate: boolean;
  recipientIds: string[];
}
