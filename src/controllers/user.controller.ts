import { Request, Response } from 'express';
import { UserService } from 'src/services/user.service';
import { AuthenticatedRequest } from 'src/types/http';
import { UserListQuery } from 'src/types/user';
import { CREATED, SuccessResponse } from 'src/utils/success.response';

class UserController {
  createAdmin = async (req: Request, res: Response) => {
    const data = await UserService.createAdmin(req.body);
    return new CREATED({ data }).send(res);
  };

  create = async (req: AuthenticatedRequest, res: Response) => {
    const data = await UserService.create(req.body, req.user.userId);
    return new CREATED({ data }).send(res);
  };

  list = async (req: Request, res: Response) => {
    const data = await UserService.list(req.query as unknown as UserListQuery);
    return new SuccessResponse({ data }).send(res);
  };

  getById = async (req: Request, res: Response) => {
    const data = await UserService.getById(req.params.id!);
    return new SuccessResponse({ data }).send(res);
  };

  update = async (req: AuthenticatedRequest, res: Response) => {
    const data = await UserService.update(req.params.id!, req.body, req.user.userId);
    return new SuccessResponse({ data }).send(res);
  };

  deleteById = async (req: AuthenticatedRequest, res: Response) => {
    const data = await UserService.deleteById(req.params.id!, req.user.userId);
    return new SuccessResponse({ data }).send(res);
  };
}

export default new UserController();
