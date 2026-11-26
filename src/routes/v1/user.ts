import { Router } from 'express';
import { ROLE } from 'src/constants';
import userController from 'src/controllers/user.controller';
import { checkRole } from 'src/middlewares/checkRole';
import deserializeUser from 'src/middlewares/deserializeUser';
import { requireCurrentUser } from 'src/middlewares/requireCurrentUser';
import requireUser from 'src/middlewares/requiresUser';
import { validateRequest } from 'src/middlewares/validateRequest';
import { catchError } from 'src/utils/handleError';
import { userSchemas } from 'src/validators/user.validator';

const router = Router();
router.use(deserializeUser, requireUser, requireCurrentUser, checkRole([ROLE.ADMIN]));
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.post(
  '/admin',
  validateRequest(userSchemas.register),
  catchError(userController.createAdmin),
);
router.post('/', validateRequest(userSchemas.create), catchError(userController.create));
router.get('/', validateRequest(userSchemas.list, 'query'), catchError(userController.list));
router.get(
  '/:id',
  validateRequest(userSchemas.idParams, 'params'),
  catchError(userController.getById),
);
router.patch(
  '/:id',
  validateRequest(userSchemas.idParams, 'params'),
  validateRequest(userSchemas.update),
  catchError(userController.update),
);
router.delete(
  '/:id',
  validateRequest(userSchemas.idParams, 'params'),
  catchError(userController.deleteById),
);

export default router;
