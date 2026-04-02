import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AzureOpenAI } from 'openai';
import { CorrectDescriptionDto, DescriptionCorrectionResponse } from './dto/correct-description.dto';

@Injectable()
export class AiService {
  private client: AzureOpenAI | null = null;
  private deploymentId = '';

  constructor() {
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    this.deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT || '';

    if (apiKey && endpoint && this.deploymentId) {
      this.client = new AzureOpenAI({
        apiKey,
        endpoint,
        apiVersion: '2024-10-21',
      });
    }
  }

  /**
   * Correct and improve a description using Azure OpenAI
   */
  async correctDescription(
    dto: CorrectDescriptionDto,
  ): Promise<DescriptionCorrectionResponse> {
    try {
      if (!this.client || !this.deploymentId) {
        throw new InternalServerErrorException(
          'Azure OpenAI is not configured (AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT).',
        );
      }

      if (!dto.description || dto.description.trim().length === 0) {
        throw new BadRequestException('Description cannot be empty');
      }

      const prompt = this.buildCorrectionPrompt(dto.description);

      const response = await this.client!.chat.completions.create({
        model: this.deploymentId,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert in rewriting product descriptions. Your task is to improve clarity, grammar, and appeal while preserving the core meaning. Respond only with the corrected description, without any additional explanation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      if (!response.choices || response.choices.length === 0) {
        throw new InternalServerErrorException(
          'No response received from AI service',
        );
      }

      const correctedDescription = response.choices[0].message?.content?.trim() || '';

      if (!correctedDescription) {
        throw new InternalServerErrorException(
          'Failed to generate corrected description',
        );
      }

      return {
        original: dto.description,
        corrected: correctedDescription,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Azure OpenAI error:', error);

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('DeploymentNotFound')) {
        throw new InternalServerErrorException(
          'AI service deployment not found. Please check AZURE_OPENAI_DEPLOYMENT configuration.',
        );
      }

      if (errorMessage.includes('AuthenticationFailed') || errorMessage.includes('Authentication')) {
        throw new InternalServerErrorException(
          'Authentication with Azure OpenAI failed. Please check your credentials.',
        );
      }

      throw new InternalServerErrorException(
        errorMessage || 'Failed to correct description',
      );
    }
  }

  /**
   * Build the prompt for description correction
   */
  private buildCorrectionPrompt(description: string): string {
    return `Please improve and clarify the following product/article description. Make it more professional, clear, and appealing while keeping the original meaning intact:

"${description}"

Provide only the improved description without any explanations or quotation marks.`;
  }
}

