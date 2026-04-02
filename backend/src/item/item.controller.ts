import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ItemService } from './item.service';
import { AzureStorageService } from '../storage/azure-storage.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Controller('api/items')
export class ItemController {
  constructor(
    private readonly itemService: ItemService,
    private readonly azureStorageService: AzureStorageService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, callback) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              `Invalid file type. Allowed types: ${allowedMimes.join(', ')}`,
            ),
            false,
          );
        } else {
          callback(null, true);
        }
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createItemDto: CreateItemDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Si une photo est fournie, l'uploader d'abord
    let photoBlobName: string | null = null;
    if (file) {
      photoBlobName = await this.azureStorageService.uploadPhoto(file);
    }

    // Créer l'item avec le blob name (pas l'URL complète)
    return this.itemService.create(createItemDto, photoBlobName);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.itemService.findAll();
  }

  @Get('owner/:ownerId')
  @HttpCode(HttpStatus.OK)
  findByOwner(@Param('ownerId') ownerId: string) {
    return this.itemService.findByOwner(ownerId);
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  getStats() {
    return this.itemService.getItemStats();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string) {
    return this.itemService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(@Param('id') id: string, @Body() updateItemDto: UpdateItemDto) {
    return this.itemService.update(id, updateItemDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.itemService.remove(id);
  }

  @Post(':id/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, callback) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              `Invalid file type. Allowed types: ${allowedMimes.join(', ')}`,
            ),
            false,
          );
        } else {
          callback(null, true);
        }
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async uploadPhoto(
    @Param('id') itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const photoUrl = await this.azureStorageService.uploadPhoto(file);
    return this.itemService.addPhoto(itemId, photoUrl);
  }
}
