const stream = require('stream');
const {
    BlockBlobClient
} = require("@azure/storage-blob");

const ONE_MEGABYTE = 1024 * 1024;
const uploadOptions = { bufferSize: 4 * ONE_MEGABYTE, maxBuffers: 20 };

const path = require('path');
const sharp = require('sharp');

const THUMB_WIDTH = 1200;

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

module.exports = async function (context, eventGridEvent, inputBlob){

    context.log(typeof inputBlob);

    const subject = eventGridEvent.subject;
    const fileName = path.basename(subject);
    context.log('File name: ', fileName);

    if(path.extname(subject) != ".png" || fileName.endsWith('-low.png')) {
        context.log.warn('This file should not be processed. Skipping...');
        context.res({
            body: "Wrong extension or file has been processed before",
            status: 417
        });
        return "Wrong extension or file has been processed before";
    } 

    const newFileName = path.basename(subject, path.extname(subject)) + '-low' + path.extname(subject);
    context.log('New file name: ', newFileName);

    let containerPathArray = path.dirname(subject).split('/');
    containerPathArray.splice(0,4);
    containerPathArray.splice(1,1);
  
    const containerPathName = containerPathArray.join('/');

    const image = await sharp(inputBlob);
    image.resize({ width: THUMB_WIDTH }).png({quality: 90, compressionLevel: 8});

    const readStream = stream.PassThrough();
    readStream.end(await image.toBuffer());

    const blobClient = new BlockBlobClient(connectionString, containerPathName, newFileName);

    try {
        await blobClient.uploadStream(readStream,
            uploadOptions.bufferSize,
            uploadOptions.maxBuffers,
            { blobHTTPHeaders: { blobContentType: "image/png" } }).then((res) => context.log(res));
    } catch (err) {
        context.log.error(err.message);
        throw new Error(err)
    }
}