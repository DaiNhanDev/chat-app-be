import mongoose from 'mongoose';

export const countConnect = () => {
  const numberConnection = mongoose.connections.length;

  return numberConnection;
};
