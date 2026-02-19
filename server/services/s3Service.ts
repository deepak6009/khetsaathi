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
  mimetype: string,
  userId: string
): Promise<string> {
  const bucketName = "khetsathi-crop-images";
  const cloudfrontUrl = process.env.CLOUDFRONT_URL;

  if (!cloudfrontUrl) throw new Error("CLOUDFRONT_URL is not configured");

  const s3Client = getS3Client();
  const ext = path.extname(originalName) || ".jpg";
  const last5 = userId.replace(/\D/g, "").slice(-5);
  const fileKey = `${last5}/${randomUUID()}${ext}`;

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

export async function uploadPdfToS3(
  pdfBuffer: Buffer,
  userId: string
): Promise<string> {
  const bucketName = "khetsathi-crop-images";
  const cloudfrontUrl = process.env.CLOUDFRONT_URL;

  if (!cloudfrontUrl) throw new Error("CLOUDFRONT_URL is not configured");

  const s3Client = getS3Client();
  const last5 = userId.replace(/\D/g, "").slice(-5);
  const fileKey = `${last5}/plans/${randomUUID()}.pdf`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      ContentDisposition: "inline",
    })
  );

  const cfUrl = cloudfrontUrl.endsWith("/") ? cloudfrontUrl : cloudfrontUrl + "/";
  return `${cfUrl}${fileKey}`;
}
