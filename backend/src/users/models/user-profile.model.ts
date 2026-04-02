import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class UserProfileModel {
  @Field({ nullable: true }) bio?: string;
  @Field({ nullable: true }) city?: string;
  @Field({ nullable: true }) governorate?: string;
  @Field({ nullable: true }) avatarUrl?: string;
}

@ObjectType()
export class UserWithProfileModel {
  @Field() id: string;
  @Field() email: string;
  @Field() displayName: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) city?: string;
  @Field() role: string;
  @Field() points: number;
  @Field() trustScore: number;
  @Field({ nullable: true }) profile?: UserProfileModel;

  // ❌ NEVER expose password_hash here either
  // passwordHash is internal only, not exposed in GraphQL responses
}
