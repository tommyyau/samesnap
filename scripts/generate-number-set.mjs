import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './public/cardsets/number-set';
const SIZE = 256;
const TOTAL_NUMBERS = 57;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function generateNumberPNG(number) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // Transparent background (no fill needed - canvas is transparent by default)

  // Black text
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Adjust font size based on number of digits
  const digits = number.toString().length;
  const fontSize = digits === 1 ? 180 : 140;
  ctx.font = `bold ${fontSize}px Arial`;

  // Draw number centered
  ctx.fillText(number.toString(), SIZE / 2, SIZE / 2);

  return canvas;
}

console.log(`Generating ${TOTAL_NUMBERS} PNG files in ${OUTPUT_DIR}...`);

for (let i = 1; i <= TOTAL_NUMBERS; i++) {
  const canvas = generateNumberPNG(i);
  const buffer = canvas.toBuffer('image/png');
  const filename = path.join(OUTPUT_DIR, `${i}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`Created: ${filename}`);
}

console.log(`\nDone! Generated ${TOTAL_NUMBERS} PNG files.`);
