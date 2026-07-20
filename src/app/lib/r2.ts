import { S3Client,CopyObjectCommand, DeleteObjectCommand  } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.warn("Cloudflare R2 environment variables are missing in your .env file!");
}

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
});

/**
 * Moves temporary uploads (tmp/ prefix) to permanent storage (receipts/ prefix)
 * in Cloudflare R2 and deletes the temp source.
 */
export async function promoteR2Images(keys: string[]): Promise<string[]> {
  if (!keys || !Array.isArray(keys) || keys.length === 0) return [];

  const isProd = process.env.NODE_ENV === "production" || process.env.MODE === "production";
  const tmpPrefix = isProd ? "tmp/" : "dev_tmp/";
  const receiptsPrefix = isProd ? "receipts/" : "dev_receipts/";
  
  const promotedKeys: string[] = [];

  for (const key of keys) {
    if (key.startsWith(tmpPrefix)) {
     const destinationKey = key.replace(new RegExp(`^${tmpPrefix}`), receiptsPrefix);
      try {
        // Copy the file to permanent folder
        await r2Client.send(
          new CopyObjectCommand({
            Bucket: R2_BUCKET_NAME,
            CopySource: `/${R2_BUCKET_NAME}/${key}`, // Cloudflare expects /bucket/key format
            Key: destinationKey,
          })
        );
        // Delete the original temporary file
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
          })
        );
        promotedKeys.push(destinationKey);
      } catch (err) {
        console.error(`Failed to promote R2 key ${key} to receipts:`, err);
        // Fallback to original temporary key if copy fails
        promotedKeys.push(key);
      }
    } else {
      promotedKeys.push(key);
    }
  }

  return promotedKeys;
}


export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "";
