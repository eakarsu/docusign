import crypto from 'node:crypto';
import {
  DeleteObjectsCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { objectBelongsToMatter, validateDocumentBytes } from '../security/policy';

export interface StoredObject { key: string; versionId?: string; checksum: string }
type S3Port = Pick<S3Client, 'send'>;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

export class StorageService {
  private s3: S3Port;
  private bucket: string;

  constructor(client?: S3Port, bucket?: string) {
    this.bucket = bucket || process.env.S3_BUCKET || '';
    if (!this.bucket) this.bucket = required('S3_BUCKET');
    this.s3 = client || new S3Client({
      credentials: { accessKeyId: required('AWS_ACCESS_KEY_ID'), secretAccessKey: required('AWS_SECRET_ACCESS_KEY') },
      region: required('AWS_REGION'),
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    });
  }

  private async assertVersioning() {
    const result = await this.s3.send(new GetBucketVersioningCommand({ Bucket: this.bucket }));
    if (result.Status !== 'Enabled') throw new Error('OBJECT_VERSIONING_REQUIRED');
  }

  private async scan(buffer: Buffer) {
    const response = await fetch(required('MALWARE_SCANNER_URL'), { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(buffer), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('MALWARE_SCANNER_UNAVAILABLE');
    const result = await response.json() as { clean?: boolean; signature?: string };
    if (!result.clean) throw new Error(`MALWARE_DETECTED${result.signature ? `:${result.signature}` : ''}`);
  }

  async upload(buffer: Buffer, input: { key: string; filename: string; mimeType: string; organizationId: string; matterId: string; userId: string }): Promise<StoredObject> {
    if (!objectBelongsToMatter(input.key, input.organizationId, input.matterId)) throw new Error('OBJECT_SCOPE_MISMATCH');
    const validation = validateDocumentBytes(buffer, { filename: input.filename, mimeType: input.mimeType, size: buffer.length });
    if (!validation.accepted) throw new Error(validation.reason);
    await this.scan(buffer);
    await this.assertVersioning();
    const result = await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: input.key, Body: buffer, ContentType: input.mimeType, ServerSideEncryption: 'AES256', Metadata: { sha256: validation.checksum, organization: input.organizationId, matter: input.matterId, uploader: input.userId, originalname: Buffer.from(input.filename).toString('base64') } }));
    return { key: input.key, versionId: result.VersionId, checksum: validation.checksum };
  }

  async download(key: string, organizationId: string, matterId: string, versionId?: string) {
    if (!objectBelongsToMatter(key, organizationId, matterId)) throw new Error('OBJECT_SCOPE_MISMATCH');
    const result = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, VersionId: versionId }));
    if (!result.Body) throw new Error('OBJECT_BODY_MISSING');
    const body = Buffer.from(await result.Body.transformToByteArray());
    return { body, checksum: crypto.createHash('sha256').update(body).digest('hex'), contentType: result.ContentType };
  }

  async presignedDownload(key: string, organizationId: string, matterId: string, versionId?: string) {
    if (!objectBelongsToMatter(key, organizationId, matterId)) throw new Error('OBJECT_SCOPE_MISMATCH');
    return getSignedUrl(this.s3 as S3Client, new GetObjectCommand({ Bucket: this.bucket, Key: key, VersionId: versionId }), { expiresIn: 300 });
  }

  async deleteAllVersions(key: string, organizationId: string, matterId: string) {
    if (!objectBelongsToMatter(key, organizationId, matterId)) return false;
    let keyMarker: string | undefined; let versionIdMarker: string | undefined;
    do {
      const page = await this.s3.send(new ListObjectVersionsCommand({ Bucket: this.bucket, Prefix: key, KeyMarker: keyMarker, VersionIdMarker: versionIdMarker }));
      const objects = [...(page.Versions || []), ...(page.DeleteMarkers || [])].filter(item => item.Key === key).map(item => ({ Key: item.Key!, VersionId: item.VersionId }));
      if (objects.length) {
        const deleted = await this.s3.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objects, Quiet: false } }));
        if (deleted.Errors?.length) return false;
      }
      keyMarker = page.NextKeyMarker; versionIdMarker = page.NextVersionIdMarker;
      if (!page.IsTruncated) break;
    } while (true);
    return true;
  }

  async healthCheck() { try { await this.assertVersioning(); return true; } catch { return false; } }
}
