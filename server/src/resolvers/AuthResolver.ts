import * as bcrypt from 'bcrypt';
import { Resolver, Mutation, Arg, ArgumentValidationError } from 'type-graphql';

import GQLAuthResponse from '../graphql-types/auth/AuthResponse';
import RegisterInput from '../graphql-types/auth/RegisterInput';
import LoginInput from '../graphql-types/auth/LoginInput';
import EmailInUseError from '../errors/auth/EmailInUse';
import UsernameInUseError from '../errors/auth/UsernameInUse';
import WrongCredentialsError from '../errors/auth/WrongCredentials';
import { User } from '../models/User';
import { signToken } from '../utils/auth';

@Resolver()
export default class AuthResolver {
  @Mutation(() => GQLAuthResponse)
  async register(@Arg('input') { email, password, username }: RegisterInput) {
    const usernameAlreadyExists = await User.findOne({ username }).select(
      '_id'
    );

    if (usernameAlreadyExists) {
      throw new ArgumentValidationError([new UsernameInUseError()]);
    }

    const emailTaken = await User.findOne({ email }).select('_id');
    if (emailTaken) {
      throw new ArgumentValidationError([new EmailInUseError()]);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userData = { email, username, password: hashedPassword };
    const newUser = await User.create(userData);

    const token = signToken(newUser.id);

    return { token };
  }

  @Mutation(() => GQLAuthResponse)
  async login(@Arg('input') { username, password }: LoginInput) {
    const user = await User.findOne({ username }, 'password');

    if (!user) {
      throw new ArgumentValidationError([new WrongCredentialsError()]);
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw new ArgumentValidationError([new WrongCredentialsError()]);
    }

    const token = signToken(user!.id);

    return { token };
  }
}
