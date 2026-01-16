/**
 * Generate PNG icons from SVG
 * Run: node generate-icons.js
 */

const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const sizes = [16, 48, 128];
const svgPath = path.join(__dirname, 'icons', 'icon.svg');
const iconsDir = path.join(__dirname, 'icons');

// Check if ImageMagick or another converter is available
function generateWithImageMagick() {
  sizes.forEach(size => {
    const outputPath = path.join(iconsDir, `icon${size}.png`);
    const command = `magick convert -background none -resize ${size}x${size} "${svgPath}" "${outputPath}"`;

    exec(command, (error) => {
      if (error) {
        console.error(`❌ ImageMagick not found. Please install ImageMagick or use an online converter.`);
        console.log('\nAlternative options:');
        console.log('1. Install ImageMagick: https://imagemagick.org/script/download.php');
        console.log('2. Use online converter: https://cloudconvert.com/svg-to-png');
        console.log('3. Use Inkscape: inkscape -w SIZE -h SIZE icon.svg -o iconSIZE.png');
        process.exit(1);
      } else {
        console.log(`✓ Generated ${outputPath}`);
      }
    });
  });
}

// Try with sharp (npm package)
async function generateWithSharp() {
  try {
    const sharp = require('sharp');
    const svgBuffer = fs.readFileSync(svgPath);

    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon${size}.png`);
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated ${outputPath}`);
    }
    console.log('\n✅ All icons generated successfully!');
  } catch (error) {
    console.error('❌ Sharp not installed. Installing now...');
    console.log('\nRun: npm install sharp --save-dev');
    console.log('Then run: node generate-icons.js');
    process.exit(1);
  }
}

// Check if sharp is available
try {
  require.resolve('sharp');
  generateWithSharp();
} catch (e) {
  console.log('Attempting with ImageMagick...');
  generateWithImageMagick();
}
