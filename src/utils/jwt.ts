import jwt from 'jsonwebtoken';
import { secretKey } from 'src/constants';

export const sign = async (payload: Record<string, any>, privateKey: string, expiresIn: number) => {
  const token = await jwt.sign(payload, privateKey, {
    // algorithm: "RS256",
    expiresIn: `${expiresIn} days`,
  });
  return token;
};

export const verify = (
  token: string,
): {
  valid: boolean;
  expired: boolean;
  decoded: string | jwt.JwtPayload | null;
  message: unknown;
} => {
  try {
    const decoded = jwt.verify(token, secretKey);
    return {
      valid: true,
      expired: false,
      decoded,
      message: null,
    };
  } catch (error) {
    let message: unknown;
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = error;
    }
    return {
      valid: false,
      expired: message === 'jwt expired',
      message,
      decoded: null,
    };
  }
};
