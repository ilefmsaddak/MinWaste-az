import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BadgeProgressEntry {
  @Field() code: string;
  @Field() name: string;
  @Field({ nullable: true }) description?: string;
  @Field(() => Int) progressPercent: number;
  @Field() unlocked: boolean;
  @Field({ nullable: true }) earnedAt?: Date;
}
