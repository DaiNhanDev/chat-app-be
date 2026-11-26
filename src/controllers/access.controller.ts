import { Request, Response } from 'express';
import { CREATED, SuccessResponse } from 'src/utils/success.response';
import { AuthenticatedRequest } from 'src/types/http';
import { AccessService } from 'src/services/access.service';

import { clearSessionCookie, readSessionToken, setSessionCookie } from 'src/utils/session-cookie';
import { AuthError } from 'src/utils/error.response';

class AccessController {
  session = async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.vary('Cookie');
    try {
      const data = await AccessService.restoreSession(readSessionToken(req));
      return new SuccessResponse({ data }).send(res);
    } catch (error) {
      if (error instanceof AuthError) clearSessionCookie(req, res);
      throw error;
    }
  };

  logout = async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    clearSessionCookie(req, res);
    return new SuccessResponse({ data: { loggedOut: true } }).send(res);
  };

  registerAdmin = async (req: Request, res: Response) => {
    const data = await AccessService.registerAdmin(req.body);
    res.setHeader('Cache-Control', 'no-store');
    return new CREATED({ data }).send(res);
  };

  login = async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const { email = '', password = '' } = req.body;
    const data = await AccessService.login({
      email,
      password,
    });
    setSessionCookie(req, res, data.tokens.accessToken);
    return new SuccessResponse({
      data,
    }).send(res);
  };

  firebaseToken = async (req: AuthenticatedRequest, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const data = await AccessService.createFirebaseReadSession(req.user.userId);
    return new SuccessResponse({ data }).send(res);
  };

  getCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
    const data = await AccessService.getCurrentUser(req.user.userId);
    return new SuccessResponse({
      data,
      message: 'Success',
    }).send(res);
  };
}

export default new AccessController();
