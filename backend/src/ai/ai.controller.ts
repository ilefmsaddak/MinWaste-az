import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AiService } from './ai.service';
import { CorrectDescriptionDto, DescriptionCorrectionResponse } from './dto/correct-description.dto';

@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('correct-description')
  @HttpCode(200)
  async correctDescription(
    @Body() dto: CorrectDescriptionDto,
  ): Promise<DescriptionCorrectionResponse> {
    return this.aiService.correctDescription(dto);
  }
}
