import {
  Resolver,
  Query,
  Arg,
  ArgumentValidationError,
  FieldResolver,
  Root,
  UseMiddleware,
  Mutation,
  Ctx
} from 'type-graphql';

import PollDoesNotExistsError from '../errors/poll/PollDoesNotExists';
import OptionDoesNotExistsError from '../errors/poll/OptionDoesNotExists';
import VotedTwiceError from '../errors/poll/VotedTwice';
import GQLPoll from '../graphql-types/poll/Poll';
import GQLPollInput from '../graphql-types/poll/PollInput';
import GQLUser from '../graphql-types/user/User';
import isAuth from '../middleware/isAuth';
import { IContext } from '../types/Context';
import { Poll, IPollModel, IPollDataModel, IPollOption } from '../models/Poll';
import { User } from '../models/User';

@Resolver(() => GQLPoll)
export default class PollResolver {
  @Query(() => GQLPoll, { name: 'poll' })
  async getPoll(@Arg('id') pollId: string): Promise<GQLPoll> {
    let poll: IPollModel | null = null;

    try {
      poll = await Poll.findById(pollId, '-votedBy');
    } catch (err) {
      throw new ArgumentValidationError([new PollDoesNotExistsError()]);
    }

    if (!poll) {
      throw new ArgumentValidationError([new PollDoesNotExistsError()]);
    }

    const responseData = {
      id: poll.id,
      userId: poll.userId,
      creationTime: poll.creationTime,
      question: poll.question,
      options: poll.options
    };

    return responseData;
  }

  @FieldResolver(() => GQLUser, { name: 'user' })
  async getPollUser(@Root() poll: GQLPoll): Promise<GQLUser> {
    const user = await User.findById(poll.userId, 'username');

    return {
      id: poll.userId,
      username: user!.username
    };
  }

  @Mutation(() => GQLPoll)
  @UseMiddleware(isAuth)
  async createPoll(
    @Arg('input') pollInput: GQLPollInput,
    @Ctx() ctx: IContext
  ): Promise<GQLPoll> {
    const options: IPollOption[] = pollInput.options.map(option => ({
      text: option,
      votes: 0
    }));

    const pollData: Omit<IPollDataModel, 'creationTime' | 'votedBy'> = {
      question: pollInput.question,
      options,
      userId: ctx.payload!.userId!
    };

    const { creationTime, id } = await Poll.create(pollData);
    const responseData = { ...pollData, creationTime, id };

    return responseData;
  }

  @Mutation(() => String)
  @UseMiddleware(isAuth)
  async deletePoll(
    @Arg('id') id: string,
    @Ctx() ctx: IContext
  ): Promise<string> {
    const pollData = {
      _id: id,
      userId: ctx.payload?.userId
    };

    const poll = await Poll.findOne(pollData, 'id');
    if (!poll) {
      throw new ArgumentValidationError([new PollDoesNotExistsError()]);
    }
    await poll.remove();

    return 'Deleted';
  }

  @Mutation(() => String)
  @UseMiddleware(isAuth)
  async vote(
    @Arg('id') id: string,
    @Arg('option') option: string,
    @Ctx() ctx: IContext
  ): Promise<string> {
    const poll = await Poll.findOne({ _id: id }, 'options votedBy');
    if (!poll) {
      throw new ArgumentValidationError([new PollDoesNotExistsError()]);
    }

    const optionIndex = poll.options.findIndex(o => o.text === option);
    if (optionIndex === -1) {
      throw new ArgumentValidationError([new OptionDoesNotExistsError()]);
    }

    const userAlreadyVoted = poll.votedBy.find(
      s => s.toString() === ctx.payload?.userId
    );
    if (userAlreadyVoted) {
      throw new ArgumentValidationError([new VotedTwiceError()]);
    }

    poll.options[optionIndex].votes++;
    poll.votedBy.push(ctx.payload?.userId!);
    await poll.save();

    return 'Voted';
  }
}
