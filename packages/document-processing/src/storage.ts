import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { DOCUMENT_MAX_BYTES } from '@reconcile/contracts';
export interface PrivateDocumentStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
  close(): void;
}
export function createPrivateDocumentStorage(config: {
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
}): PrivateDocumentStorage {
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
    maxAttempts: 2,
  });
  return {
    async put(key, bytes) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.S3_BUCKET,
          Key: key,
          Body: bytes,
          ContentType: 'application/pdf',
          CacheControl: 'private, no-store',
        }),
        { abortSignal: AbortSignal.timeout(10000) },
      );
    },
    async get(key) {
      const response = await client.send(
        new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
        { abortSignal: AbortSignal.timeout(10000) },
      );
      if (!response.Body || (response.ContentLength ?? 0) > DOCUMENT_MAX_BYTES)
        throw new Error('STORAGE_READ_FAILED');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const chunk of response.Body.transformToWebStream()) {
        size += chunk.length;
        if (size > DOCUMENT_MAX_BYTES) throw new Error('STORAGE_READ_FAILED');
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    },
    async remove(key) {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
        { abortSignal: AbortSignal.timeout(10000) },
      );
    },
    close() {
      client.destroy();
    },
  };
}
