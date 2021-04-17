const sharp = require("sharp");
const aws = require("aws-sdk");
const s3 = new aws.S3();

const Bucket = "eedo-front";
const transforms = [
  { name: "thumbnail", size: 100 },
  { name: "small", size: 300 },
  { name: "medium", size: 500 },
  { name: "large", size: 1200 },
];

exports.handler = async (event, context) => {
  const key = event.Records[0].s3.object.key;
  const sanitizedKey = key.replace(/\+/g, " ");
  const keyWithoutExtension = sanitizedKey.replace(/.[^.]+$/, "");
  const extension = sanitizedKey.substring(keyWithoutExtension.length+1);
  const parts = key.split("/");
  const folder = parts[0];
  const file = parts[1];

  if (key.match("-size-")) {
    return context.succeed();
  }

  try {
    const data = await s3
      .listObjects({ Bucket, Prefix: `${folder}/` })
      .promise();
    const files = data.Contents;
    const Objects = files.reduce((acc, f) => {
      if (!f.Key.match(file)) acc.push({ Key: f.Key });
      return acc;
    }, []);

    if (Objects.length) {
      await s3.deleteObjects({ Bucket, Delete: { Objects } }).promise();
    }

    const image = await s3.getObject({ Bucket, Key: sanitizedKey }).promise();

    for (const t of transforms) {
      const resizedImg = await sharp(image.Body)
        .resize(t.size, t.size, { fit: "inside", withoutEnlargement: true })
        .toFormat(extension === "jpg" ? "jpeg" : extension)
        .toBuffer();
      const updated = await s3
        .putObject({
          Bucket,
          ACL:'public-read',
          Body: resizedImg,
          Key: `${keyWithoutExtension}-size-${t.name}.${extension}`,
        })
        .promise();
    }

    context.succeed();
  } catch (err) {
    context.fail(`Error resizing files: ${err}`);
  }
};
