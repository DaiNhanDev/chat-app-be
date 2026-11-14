import { secretKey } from 'src/constants';
import { sign } from 'src/utils/jwt';
import { logger } from 'src/utils/logger';

const TOKEN_EXPIRESIN = {
  accessToken: 2,
  refreshToken: 7,
};

export const createTokenPair = async (payload: Record<string, any>) => {
  try {
    const accessToken = await sign(payload, secretKey, TOKEN_EXPIRESIN.accessToken);
    const refreshToken = await sign(payload, secretKey, TOKEN_EXPIRESIN.refreshToken);

    return { accessToken, refreshToken };
  } catch (error) {
    logger.error('Token pair creation failed', { error });
    throw error;
  }
};
