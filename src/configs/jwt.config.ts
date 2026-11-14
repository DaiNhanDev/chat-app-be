import { env } from 'src/configs/env.config';

export const jwtConfig = { saltRound: env.jwtSaltRounds };
