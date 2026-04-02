import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateNotificationPreferencesInput {
  @Field({ nullable: true }) reservationCreated?: boolean;
  @Field({ nullable: true }) reservationCanceled?: boolean;
  @Field({ nullable: true }) badgeEarned?: boolean;
}
