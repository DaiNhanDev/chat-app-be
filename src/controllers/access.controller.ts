import { Request, Response } from 'express';
import { CREATED, SuccessResponse } from 'src/utils/success.response';
import { AuthenticatedRequest } from 'src/types/http';
import { AccessService } from 'src/services/access.service';
import { CreateUserInput } from 'src/types';

class AccessController {
  signup = async (req: Request, res: Response) => {
    const { body }: { body: CreateUserInput } = req;
    const data = await AccessService.signUp({
      ...body,
      email: body.email.toLowerCase(),
    });
    return new CREATED({
      data,
    }).send(res);
  };

  login = async (req: Request, res: Response) => {
    const { email = '', password = '' } = req.body;
    const data = await AccessService.login({
      email,
      password,
    });
    return new SuccessResponse({
      data,
    }).send(res);
  };

  getUserByEmail = async (req: AuthenticatedRequest, res: Response) => {
    const data = await AccessService.getUserByEmail(req.user.email);
    return new SuccessResponse({
      data,
      message: 'Success',
    }).send(res);
  };
}

export default new AccessController();
