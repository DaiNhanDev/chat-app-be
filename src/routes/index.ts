import { Router } from 'express';
import authRoute from 'src/routes/v1/auth';
import userRoute from 'src/routes/v1/user';
import deserializeUser from 'src/middlewares/deserializeUser';
import { createChatRouter } from 'src/routes/v1/chat';
import {
  chatService,
  pushDeviceRepository,
  conversationService,
} from 'src/services/firebase.service';

const appRouter = Router();
appRouter.use('/auth', deserializeUser, authRoute);
appRouter.use('/users', userRoute);
appRouter.use(
  createChatRouter({
    chat: chatService,
    rooms: conversationService,
    devices: pushDeviceRepository,
  }),
);

export default appRouter;
