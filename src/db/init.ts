import { countConnect } from 'src/helpers/check.connect';
import mongoose from 'mongoose';
import { logger } from 'src/utils/logger';
import { env } from 'src/configs/env.config';

class Database {
  static instance: Database;
  constructor() {
    this.connect();
  }

  connect() {
    mongoose
      .connect(env.mongoUri)
      .then(() => logger.info('MongoDB connected', { connectionCount: countConnect() }))
      .catch((error) => logger.error('MongoDB connection failed', { error }));
  }

  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }

    return Database.instance;
  }
}

// const instance = Database.getInstance();

export default Database;
