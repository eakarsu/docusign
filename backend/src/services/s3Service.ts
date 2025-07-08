import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

export class S3Service {
  static async uploadFile(file: Express.Multer.File, key: string): Promise<string> {
    const params = {
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'private'
    };

    const result = await s3.upload(params).promise();
    return result.Location;
  }

  static async getSignedUrl(key: string, expires: number = 3600): Promise<string> {
    const params = {
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Expires: expires
    };

    return s3.getSignedUrl('getObject', params);
  }

  static async deleteFile(key: string): Promise<void> {
    const params = {
      Bucket: process.env.S3_BUCKET!,
      Key: key
    };

    await s3.deleteObject(params).promise();
  }
}
