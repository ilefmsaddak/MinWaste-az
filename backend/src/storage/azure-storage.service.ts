import { Injectable, BadRequestException } from '@nestjs/common';
import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class AzureStorageService {
  private blobServiceClient: BlobServiceClient | null = null;
  private containerName: string | null = null;

  private readonly localUploadDir = path.join(
    process.cwd(),
    'uploads',
    'items',
  );

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.CONTAINER_NAME;

    if (connectionString && containerName) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(
        connectionString,
      );
      this.containerName = containerName;
    }
  }

  /** true si upload Azure disponible */
  isAzureConfigured(): boolean {
    return !!(this.blobServiceClient && this.containerName);
  }

  private ensureAzureClient() {
    if (!this.blobServiceClient || !this.containerName) {
      throw new BadRequestException(
        'Azure Storage is not configured (AZURE_STORAGE_CONNECTION_STRING, CONTAINER_NAME)',
      );
    }
  }

  /**
   * Upload : Azure si configuré, sinon disque local (`uploads/items/`) pour le dev.
   */
  async uploadPhoto(file: Express.Multer.File): Promise<string> {
    const extension = path.extname(file.originalname) || '.jpg';
    const blobName = `${uuidv4()}${extension}`;

    if (this.isAzureConfigured()) {
      this.ensureAzureClient();
      const containerClient = this.blobServiceClient!.getContainerClient(
        this.containerName!,
      );
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(file.buffer, file.buffer.length, {
        blobHTTPHeaders: {
          blobContentType: file.mimetype,
        },
      });
      return blobName;
    }

    await fs.mkdir(this.localUploadDir, { recursive: true });
    const dest = path.join(this.localUploadDir, blobName);
    await fs.writeFile(dest, file.buffer);
    // eslint-disable-next-line no-console
    console.log(`[storage] Photo saved locally: ${dest}`);
    return blobName;
  }

  async deletePhoto(blobName: string): Promise<void> {
    try {
      if (!blobName) return;

      if (this.isAzureConfigured()) {
        const containerClient = this.blobServiceClient!.getContainerClient(
          this.containerName!,
        );
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.delete();
        return;
      }

      const filePath = path.join(this.localUploadDir, path.basename(blobName));
      await fs.unlink(filePath).catch(() => undefined);
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  }

  getPhotoUrl(blobName: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_AZURE_STORAGE_BASE_URL;
    if (baseUrl) {
      return `${baseUrl.replace(/\/$/, '')}/${blobName}`;
    }

    if (this.isAzureConfigured()) {
      return blobName;
    }

    const port = process.env.PORT ?? 4000;
    const publicBase =
      process.env.API_PUBLIC_URL?.replace(/\/$/, '') ||
      `http://localhost:${port}`;
    return `${publicBase}/api/files/${encodeURIComponent(blobName)}`;
  }
}
