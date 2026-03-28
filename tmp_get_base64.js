const fs = require('fs');
const source = "C:\\Users\\ACER NITRO\\.gemini\\antigravity\\brain\\22bcbfdc-853f-48f2-aa62-147b3b9859f3\\school_logo_png_1774671232726.png";
const content = fs.readFileSync(source);
console.log(content.toString('base64'));
