import { secretKey } from 'src/constants';
import { sign } from 'src/utils/jwt';
import { logger } from 'src/utils/logger';

const TOKEN_LIFETIME_DAYS = 365;

export const createTokenPair = async (payload: Record<string, any>) => {
  try {
    const accessToken = await sign(
      { ...payload, tokenUse: 'access' },
      secretKey,
      TOKEN_LIFETIME_DAYS,
    );
    const refreshToken = await sign(
      { ...payload, tokenUse: 'refresh' },
      secretKey,
      TOKEN_LIFETIME_DAYS,
    );

    return { accessToken, refreshToken };
  } catch (error) {
    logger.error('Token pair creation failed', { error });
    throw error;
  }
};
