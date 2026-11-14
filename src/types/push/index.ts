export interface PushDevice {
  ownerUid: string;
  token: string;
  tokenHash: string;
  version: string;
}

export interface PushRegistry {
  devices?: Record<string, PushDevice>;
  tokens?: Record<string, string>;
}

export interface PushTarget extends PushDevice {
  deviceId: string;
}

export interface PushContext {
  conversationId: string;
  messageId: string;
  senderId: string;
  recipientIds: string[];
}
