import { Response } from 'express';
import { PushDeviceRepository } from 'src/repositories/push-device.repository';
import { ChatRequest } from 'src/types/chat-account';
import { ErrorResponse } from 'src/utils/error.response';
import { SuccessResponse } from 'src/utils/success.response';

export class PushDeviceController {
  constructor(private readonly devices: Pick<PushDeviceRepository, 'register' | 'unregister'>) {}

  register = async (req: ChatRequest, res: Response) => {
    try {
      await this.devices.register(req.chatUser.uid, req.params.deviceId!, req.body.token);
    } catch (error) {
      if (error instanceof ErrorResponse) throw error;
      // Avoid logging an SDK error that could embed the registration token.
      throw new Error('Push device registration failed');
    }
    return new SuccessResponse({ data: { deviceId: req.params.deviceId, registered: true } }).send(
      res,
    );
  };

  unregister = async (req: ChatRequest, res: Response) => {
    try {
      await this.devices.unregister(req.chatUser.uid, req.params.deviceId!);
    } catch {
      throw new Error('Push device removal failed');
    }
    return new SuccessResponse({ data: { deviceId: req.params.deviceId, registered: false } }).send(
      res,
    );
  };
}
