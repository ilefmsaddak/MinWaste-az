import { Resolver, Query, Args } from '@nestjs/graphql';
import { AnnonceService } from './annonce.service';
import { Item } from './annonce.entity';
import { item_status } from '@prisma/client';

@Resolver(() => Item)
export class AnnonceResolver {
  constructor(private annonceService: AnnonceService) {}

  @Query(() => [Item], { name: 'items' })
  async getItems() {
    return this.annonceService.findAll();
  }

  @Query(() => Item, { nullable: true, name: 'item' })
  async getItem(@Args('id') id: string) {
    return this.annonceService.findOne(id);
  }

  @Query(() => [Item], { name: 'itemsByCategory' })
  async getItemsByCategory(@Args('category') category: string) {
    return this.annonceService.findByCategory(category);
  }

  @Query(() => [Item], { name: 'itemsByStatus' })
  async getItemsByStatus(@Args('status', { type: () => String }) status: item_status) {
    return this.annonceService.findByStatus(status);
  }

  @Query(() => [Item], { name: 'itemsByOwnerId' })
  async getItemsByOwnerId(@Args('ownerId') ownerId: string) {
    return this.annonceService.findByOwnerId(ownerId);
  }
}
