import {
  ObjectType,
  Field,
  Float,
  Int,
  registerEnumType,
} from '@nestjs/graphql';
import { item_status, price_type } from '@prisma/client';

registerEnumType(item_status, {
  name: 'ItemStatus',
});

registerEnumType(price_type, {
  name: 'PriceType',
});

@ObjectType()
export class Location {
  @Field()
  lat: number;

  @Field()
  lng: number;

  @Field()
  addr: string;
}

@ObjectType()
export class Owner {
  @Field()
  id: string;

  @Field()
  displayName: string;

  @Field({ nullable: true })
  email?: string;

  @Field(() => Int, { nullable: true })
  points?: number;

  @Field(() => [String], { nullable: true })
  badges?: string[];

  @Field(() => Int, { nullable: true })
  trustScore?: number;
}

@ObjectType()
export class Item {
  @Field()
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  category?: string;

  @Field(() => [String])
  photos: string[];

  @Field(() => Location, { nullable: true })
  location?: Location;

  @Field(() => item_status)
  status: item_status;

  @Field(() => [String], { nullable: true })
  suggestedCategory?: string[];

  @Field(() => Float, { nullable: true })
  fraudScore?: number;

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  expiresAt?: Date;

  @Field(() => Int, { nullable: true })
  quantity?: number;

  @Field(() => price_type)
  priceType: price_type;

  @Field(() => Float, { nullable: true })
  priceValue?: number;

  @Field(() => Owner, { nullable: true })
  owner?: Owner;
}
