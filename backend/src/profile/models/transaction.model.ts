import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum TransactionRole {
  OWNER = 'OWNER',
  RECEIVER = 'RECEIVER',
}

export enum TransactionKind {
  DONATION = 'DONATION',
  PURCHASE = 'PURCHASE',
}

registerEnumType(TransactionRole, { name: 'TransactionRole' });
registerEnumType(TransactionKind, { name: 'TransactionKind' });

@ObjectType()
export class TransactionItemModel {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  type: string;

  @Field()
  priceType: string;

  @Field({ nullable: true })
  priceAmount?: number;

  @Field()
  currency: string;
}

@ObjectType()
export class TransactionModel {
  @Field(() => ID)
  id: string;

  @Field(() => TransactionRole)
  role: TransactionRole;

  @Field(() => TransactionKind)
  kind: TransactionKind;

  @Field()
  status: string;

  @Field()
  quantity: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => TransactionItemModel)
  item: TransactionItemModel;
}
