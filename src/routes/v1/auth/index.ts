import { catchError } from 'src/utils/handleError';
import accessController from 'src/controllers/access.controller';
import { Router } from 'express';
import requireUser from 'src/middlewares/requiresUser';
import { validateRequest } from 'src/middlewares/validateRequest';
import { userSchemas } from 'src/validators/user.validator';
const route = Router();

route.post('/register', validateRequest(userSchemas.register), catchError(accessController.signup));
route.post('/login', validateRequest(userSchemas.login), catchError(accessController.login));
route.get('/me', requireUser, catchError(accessController.getUserByEmail));

export default route;
