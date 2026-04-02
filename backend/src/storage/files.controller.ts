import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

/** Sert les photos uploadées en mode local (sans Azure). */
@Controller('api/files')
export class FilesController {
  @Get(':name')
  serve(@Param('name') name: string, @Res() res: Response) {
    const safe = path.basename(name);
    if (!safe || safe !== name) {
      throw new NotFoundException('Invalid file name');
    }
    const filePath = path.join(process.cwd(), 'uploads', 'items', safe);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }
    return res.sendFile(path.resolve(filePath));
  }
}
