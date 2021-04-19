const sharp = require("sharp");
const aws = require("aws-sdk");
const s3 = new aws.S3();

const transforms = [
  { name: "thumbnail", size: 100 },
  { name: "small", size: 300 },
  { name: "medium", size: 500 },
  { name: "large", size: 1200 },
];

exports.handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;
  const sanitizedKey = key.replace(/\+/g, " ");
  const keyWithoutExtension = sanitizedKey.replace(/.[^.]+$/, "");
  const extension = sanitizedKey.substring(keyWithoutExtension.length + 1);

  if (!key.match("/images/")) {
    return context.succeed();
  }

  if (key.match("-size-")) {
    return context.succeed();
  }

  try {
    const image = await s3
      .getObject({ Bucket: bucket, Key: sanitizedKey })
      .promise();

    for (const t of transforms) {
      const resizedImg = await sharp(image.Body)
        .resize(t.size, t.size, { fit: "inside", withoutEnlargement: true })
        .toFormat(extension === "jpg" ? "jpeg" : extension)
        .toBuffer();
      const updated = await s3
        .putObject({
          Bucket: bucket,
          ACL: "public-read",
          Body: resizedImg,
          Key: `${
            keyWithoutExtension.endsWith("-original")
              ? keyWithoutExtension.slice(0, -9)
              : keyWithoutExtension
          }-size-${t.name}.${extension}`,
        })
        .promise();
    }

    context.succeed();
  } catch (err) {
    context.fail(`Error resizing files: ${err}`);
  }
};
