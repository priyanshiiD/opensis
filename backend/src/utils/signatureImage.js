const { createCanvas, loadImage } = require('@napi-rs/canvas');

const preprocessSignatureImage = async (buffer) => {
  const image = await loadImage(buffer);
  const source = createCanvas(image.width, image.height);
  const context = source.getContext('2d');
  context.drawImage(image, 0, 0);

  const pixels = context.getImageData(0, 0, source.width, source.height);
  let left = source.width;
  let top = source.height;
  let right = 0;
  let bottom = 0;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const offset = (y * source.width + x) * 4;
      const red = pixels.data[offset];
      const green = pixels.data[offset + 1];
      const blue = pixels.data[offset + 2];
      const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
      const channelSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
      const neutralBackground = channelSpread <= 18 && luminance >= 185;
      const greyBackground = channelSpread <= 25 && luminance >= 100;

      if (neutralBackground || greyBackground) {
        pixels.data[offset + 3] = 0;
      } else {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  context.putImageData(pixels, 0, 0);

  if (right < left || bottom < top) return Buffer.from(await source.encode('png'));

  const padding = 12;
  const cropLeft = Math.max(0, left - padding);
  const cropTop = Math.max(0, top - padding);
  const cropRight = Math.min(source.width, right + padding);
  const cropBottom = Math.min(source.height, bottom + padding);
  const cropWidth = cropRight - cropLeft;
  const cropHeight = cropBottom - cropTop;
  const output = createCanvas(cropWidth, cropHeight);
  output.getContext('2d').drawImage(source, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  return Buffer.from(await output.encode('png'));
};

module.exports = { preprocessSignatureImage };
