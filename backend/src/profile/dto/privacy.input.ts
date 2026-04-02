import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdatePrivacySettingsInput {
  @Field({ nullable: true }) showEmail?: boolean;
  @Field({ nullable: true }) showPhone?: boolean;
  @Field({ nullable: true }) showHistory?: boolean;
  @Field({ nullable: true }) showBadges?: boolean;
}
