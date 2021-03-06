import { Types } from 'mongoose';
import {
  Resolver,
  Query,
  Arg,
  Args,
  ArgumentValidationError,
  FieldResolver,
  Root,
  UseMiddleware,
  Mutation,
  Ctx,
  Int
} from 'type-graphql';

import PollDoesNotExistsError from '../errors/poll/PollDoesNotExists';
import OptionDoesNotExistsError from '../errors/poll/OptionDoesNotExists';
import VotedTwiceError from '../errors/poll/VotedTwice';
import GQLPoll from '../graphql-types/poll/Poll';
import GQLPollInput from '../graphql-types/poll/PollInput';
import GQLGetPollsArgs from '../graphql-types/poll/GetPollsArgs';
import GQLUser from '../graphql-types/user/User';
import isAuth from '../middleware/isAuth';
import { IContext } from '../types/Context';
import { Poll, IPollModel, IPollDataModel, IPollOption } from '../models/Poll';

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
      userId: poll.userId.toString(),
      creationTime: poll.creationTime,
      question: poll.question,
      options: poll.options
    };

    return responseData;
  }

  @Query(() => [GQLPoll], { name: 'polls' })
  async getPolls(@Args() { skip, limit }: GQLGetPollsArgs): Promise<GQLPoll[]> {
    const polls = await Poll.find()
      .select('-votedBy')
      .lean()
      .limit(limit)
      .skip(skip)
      .sort('-creationTime');

    const resData: GQLPoll[] = polls.map(
      (poll: IPollModel): GQLPoll => ({
        creationTime: poll.creationTime,
        id: poll._id,
        options: poll.options,
        question: poll.question,
        userId: poll.userId.toString()
      })
    );

    return resData;
  }

  @Query(() => Int, { name: 'pollsCount' })
  async getPollsCount(): Promise<number> {
    const count = await Poll.estimatedDocumentCount();

    return count;
  }

  @Query(() => Boolean, { name: 'pollVoted' })
  @UseMiddleware(isAuth)
  async isPollVotedByUser(
    @Arg('id') pollId: string,
    @Ctx() ctx: IContext
  ): Promise<boolean> {
    let poll: IPollModel | null = null;

    try {
      poll = await Poll.findById(pollId, 'votedBy').lean();
    } catch (err) {
      throw new ArgumentValidationError([new PollDoesNotExistsError()]);
    }

    if (!poll) {
      throw new ArgumentValidationError([new PollDoesNotExistsError()]);
    }

    const isVoted = poll.votedBy.some(
      user => user.toString() === ctx.payload?.userId
    );

    return isVoted;
  }

  @FieldResolver(() => GQLUser, { name: 'user' })
  async getPollUser(
    @Root() { userId }: GQLPoll,
    @Ctx() ctx: IContext
  ): Promise<GQLUser> {
    return ctx.userLoader.load(userId);
  }

  @FieldResolver(() => Int, { name: 'totalVotes' })
  async getPollTotalVotes(@Root() { options }: GQLPoll): Promise<number> {
    return options.reduce((prev, curr) => prev + curr.votes, 0);
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
      userId: new Types.ObjectId(ctx.payload!.userId!)
    };

    const { creationTime, id } = await Poll.create(pollData);
    const responseData = {
      ...pollData,
      creationTime,
      id,
      userId: ctx.payload!.userId!
    };

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
    poll.votedBy.push(new Types.ObjectId(ctx.payload?.userId!));
    await poll.save();

    return 'Voted';
  }
}
