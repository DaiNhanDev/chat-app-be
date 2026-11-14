import { Router } from 'express';
import authRoute from 'src/routes/v1/auth';
import deserializeUser from 'src/middlewares/deserializeUser';
import { createChatRouter } from 'src/routes/v1/chat';
import { chatService, pushDeviceRepository } from 'src/services/firebase.service';

const appRouter = Router();
appRouter.use('/auth', deserializeUser, authRoute);
appRouter.use(createChatRouter({ chat: chatService, devices: pushDeviceRepository }));

export default appRouter;
