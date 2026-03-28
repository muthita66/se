const fs = require('fs');
const path = require('path');

const source = "C:\\Users\\ACER NITRO\\.gemini\\antigravity\\brain\\22bcbfdc-853f-48f2-aa62-147b3b9859f3\\school_logo_png_1774671232726.png";
const dest = "d:\\clone_SE\\se\\public\\school-logo.png";

try {
    fs.copyFileSync(source, dest);
    console.log(`Copied from ${source} to ${dest}`);
} catch (err) {
    console.error(`Error copying file: ${err.message}`);
}
