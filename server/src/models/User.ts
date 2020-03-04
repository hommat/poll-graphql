import { Schema, model, Document } from 'mongoose';

export interface IUserModel extends Document {
  email: string;
  username: string;
  password: string;
}

const UserSchema = new Schema({
  email: String,
  username: String,
  password: String
});

export const User = model<IUserModel>('User', UserSchema);
