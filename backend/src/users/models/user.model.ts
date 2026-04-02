import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class UserModel {
  @Field(() => ID) id: string;
  @Field() email: string;
  @Field() displayName: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) city?: string;
  @Field() role: string;
  @Field() points: number;
  @Field() trustScore: number;
  @Field() isSuspended: boolean;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;

  // ❌ NEVER expose password_hash in GraphQL
  // passwordHash is never included in this model, even as @Field() excluded
  // It's only used internally for authentication logic
}
