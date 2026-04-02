import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BadgeModel {
  @Field(() => ID)
  id: string;

  @Field()
  code: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  earnedAt: Date;
}
