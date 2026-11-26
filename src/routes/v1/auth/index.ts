import { catchError } from 'src/utils/handleError';
import accessController from 'src/controllers/access.controller';
import { Router } from 'express';
import requireUser from 'src/middlewares/requiresUser';
import { validateRequest } from 'src/middlewares/validateRequest';
import { userSchemas } from 'src/validators/user.validator';
import { ROLE } from 'src/constants';
import { checkRole } from 'src/middlewares/checkRole';
import { requireCurrentUser } from 'src/middlewares/requireCurrentUser';
import userController from 'src/controllers/user.controller';

import { sessionOrigin } from 'src/middlewares/sessionOrigin';

const route = Router();

route.post(
  '/register-admin',
  validateRequest(userSchemas.register),
  catchError(accessController.registerAdmin),
);
route.post(
  '/register',
  requireUser,
  requireCurrentUser,
  checkRole([ROLE.ADMIN]),
  validateRequest(userSchemas.register),
  catchError(userController.create),
);
route.post(
  '/login',
  sessionOrigin,
  validateRequest(userSchemas.login),
  catchError(accessController.login),
);
route.get('/session', sessionOrigin, catchError(accessController.session));
route.post('/logout', sessionOrigin, catchError(accessController.logout));
route.post('/firebase-token', requireUser, catchError(accessController.firebaseToken));
route.get('/me', requireUser, catchError(accessController.getCurrentUser));

export default route;
