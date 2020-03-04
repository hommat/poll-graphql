import * as bcrypt from 'bcrypt';
import { User } from '../../models/User';

export const username = 'created_user_username';
export const password = 'created_user_password';
export const email = 'created_user_email';

export const createUser = async () => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const userData = { email, username, password: hashedPassword };

  const user = await User.create(userData);

  return user;
};
