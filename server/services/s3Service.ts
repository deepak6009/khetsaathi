import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";

function getS3Client(): S3Client {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials are not configured");
  }
  return new S3Client({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadToS3(
  fileBuffer: Buffer,
  originalName: string,
  mimetype: string
): Promise<string> {
  const bucketName = process.env.S3_BUCKET_NAME;
  const cloudfrontUrl = process.env.CLOUDFRONT_URL;

  if (!bucketName) throw new Error("S3_BUCKET_NAME is not configured");
  if (!cloudfrontUrl) throw new Error("CLOUDFRONT_URL is not configured");

  const s3Client = getS3Client();
  const ext = path.extname(originalName) || ".jpg";
  const fileKey = `crops/${randomUUID()}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: mimetype,
    })
  );

  const cfUrl = cloudfrontUrl.endsWith("/") ? cloudfrontUrl : cloudfrontUrl + "/";
  return `${cfUrl}${fileKey}`;
}
