const fs = require('fs');
const zlib = require('zlib');

function generateFullLogoVariants(inputPath) {
    const data = fs.readFileSync(inputPath);
    let offset = 8;
    let width = 0, height = 0, bitDepth = 0, colorType = 0;
    let idatBuffers = [];

    while (offset < data.length) {
        const length = data.readUInt32BE(offset);
        const type = data.toString('ascii', offset + 4, offset + 8);
        const chunkData = data.slice(offset + 8, offset + 8 + length);
        
        if (type === 'IHDR') {
            width = chunkData.readUInt32BE(0);
            height = chunkData.readUInt32BE(4);
            bitDepth = chunkData[8];
            colorType = chunkData[9];
        } else if (type === 'IDAT') {
            idatBuffers.push(chunkData);
        }
        offset += 12 + length;
    }

    const compressed = Buffer.concat(idatBuffers);
    const uncompressed = zlib.inflateSync(compressed);

    let bytesPerPixel = (colorType === 6) ? 4 : (colorType === 2) ? 3 : 0;
    const rowBytes = 1 + width * bytesPerPixel;
    const rawPixels = Buffer.alloc(height * width * bytesPerPixel);

    for (let y = 0; y < height; y++) {
        const filterType = uncompressed[y * rowBytes];
        const rowStart = y * rowBytes + 1;
        const rawRowStart = y * width * bytesPerPixel;

        for (let x = 0; x < width * bytesPerPixel; x++) {
            let val = uncompressed[rowStart + x];
            let a = x >= bytesPerPixel ? rawPixels[rawRowStart + x - bytesPerPixel] : 0;
            let b = y > 0 ? rawPixels[(y - 1) * width * bytesPerPixel + x] : 0;
            let c = (y > 0 && x >= bytesPerPixel) ? rawPixels[(y - 1) * width * bytesPerPixel + x - bytesPerPixel] : 0;

            if (filterType === 1) val = (val + a) & 0xFF;
            else if (filterType === 2) val = (val + b) & 0xFF;
            else if (filterType === 3) val = (val + Math.floor((a + b) / 2)) & 0xFF;
            else if (filterType === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a);
                const pb = Math.abs(p - b);
                const pc = Math.abs(p - c);
                let pr;
                if (pa <= pb && pa <= pc) pr = a;
                else if (pb <= pc) pr = b;
                else pr = c;
                val = (val + pr) & 0xFF;
            }
            rawPixels[rawRowStart + x] = val;
        }
    }

    function buildCroppedVariant(outputPath, pixelProcessor) {
        let minX = width, minY = height, maxX = 0, maxY = 0;
        const processedBuf = Buffer.alloc(width * height * 4);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const inIdx = (y * width + x) * bytesPerPixel;
                const outIdx = (y * width + x) * 4;

                let r = rawPixels[inIdx];
                let g = rawPixels[inIdx + 1];
                let b = rawPixels[inIdx + 2];
                let a = 255;

                // Remove white background
                if (r > 235 && g > 235 && b > 235) {
                    const minC = Math.min(r, g, b);
                    if (minC > 240) a = 0;
                    else a = Math.floor((255 - minC) * 25.5);
                }

                let [nr, ng, nb, na] = pixelProcessor(r, g, b, a, x, y);
                processedBuf[outIdx] = nr;
                processedBuf[outIdx + 1] = ng;
                processedBuf[outIdx + 2] = nb;
                processedBuf[outIdx + 3] = na;

                if (na > 15) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        const pad = 8;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(width - 1, maxX + pad);
        maxY = Math.min(height - 1, maxY + pad);

        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;

        console.log(`Saving ${outputPath} (${cropW}x${cropH})`);

        const outRowBytes = 1 + cropW * 4;
        const outRaw = Buffer.alloc(cropH * outRowBytes);

        for (let cy = 0; cy < cropH; cy++) {
            outRaw[cy * outRowBytes] = 0;
            const srcY = minY + cy;
            for (let cx = 0; cx < cropW; cx++) {
                const srcX = minX + cx;
                const srcIdx = (srcY * width + srcX) * 4;
                const dstIdx = cy * outRowBytes + 1 + cx * 4;

                outRaw[dstIdx] = processedBuf[srcIdx];
                outRaw[dstIdx + 1] = processedBuf[srcIdx + 1];
                outRaw[dstIdx + 2] = processedBuf[srcIdx + 2];
                outRaw[dstIdx + 3] = processedBuf[srcIdx + 3];
            }
        }

        const newIdatData = zlib.deflateSync(outRaw);

        const ihdrBuffer = Buffer.alloc(13);
        ihdrBuffer.writeUInt32BE(cropW, 0);
        ihdrBuffer.writeUInt32BE(cropH, 4);
        ihdrBuffer[8] = 8;
        ihdrBuffer[9] = 6;

        const crcTable = [];
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                if (c & 1) c = 0xedb88320 ^ (c >>> 1);
                else c = c >>> 1;
            }
            crcTable[n] = c;
        }

        function calcCrc(buf) {
            let c = 0xffffffff;
            for (let i = 0; i < buf.length; i++) {
                c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
            }
            return (c ^ 0xffffffff) >>> 0;
        }

        function createChunk(type, chunkData) {
            const len = chunkData.length;
            const buf = Buffer.alloc(12 + len);
            buf.writeUInt32BE(len, 0);
            buf.write(type, 4, 4, 'ascii');
            chunkData.copy(buf, 8);
            buf.writeUInt32BE(calcCrc(buf.slice(4, 8 + len)), 8 + len);
            return buf;
        }

        const finalPng = Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
            createChunk('IHDR', ihdrBuffer),
            createChunk('IDAT', newIdatData),
            createChunk('IEND', Buffer.alloc(0))
        ]);

        fs.writeFileSync(outputPath, finalPng);
    }

    // Light Theme Full Logo (Black text, transparent background)
    buildCroppedVariant('MKC_Full_Logo_Light.png', (r, g, b, a) => [r, g, b, a]);

    // Dark Theme Full Logo (White text, transparent background)
    buildCroppedVariant('MKC_Full_Logo_Dark.png', (r, g, b, a) => {
        // If text (dark color), convert to pure white for dark background
        if (a > 10 && r < 100 && g < 100 && b < 100) {
            return [255, 255, 255, a];
        }
        return [r, g, b, a];
    });
}

generateFullLogoVariants('MKC Logo.png');
