import { Field, ObjectType } from '@nestjs/graphql';
import { UserModel } from '../../users/models/user.model';
import { BadgeModel } from './badge.model';
import { TransactionModel } from './transaction.model';

@ObjectType()
export class NotificationPreferencesModel {
  @Field() reservationCreated: boolean;
  @Field() reservationCanceled: boolean;
  @Field() badgeEarned: boolean;
}

@ObjectType()
export class PrivacySettingsModel {
  @Field() showEmail: boolean;
  @Field() showPhone: boolean;
  @Field() showHistory: boolean;
  @Field() showBadges: boolean;
}

@ObjectType()
export class ProfileModel {
  @Field(() => UserModel)
  user: UserModel;

  @Field(() => [TransactionModel])
  history: TransactionModel[];

  @Field(() => [BadgeModel])
  badges: BadgeModel[];

  @Field(() => NotificationPreferencesModel)
  notificationPreferences: NotificationPreferencesModel;

  @Field(() => PrivacySettingsModel)
  privacySettings: PrivacySettingsModel;
}
