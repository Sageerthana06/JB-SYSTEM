const fs = require('fs');

function inspectFile(filePath) {
  const buf = fs.readFileSync(filePath);
  console.log('=== File:', filePath, '===');
  console.log('Buffer length:', buf.length);
  // Check BOM
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    console.log('UTF-8 BOM detected');
  } else {
    console.log('No UTF-8 BOM');
  }

  const str = buf.toString('utf8');
  const emojis = ['✨', '🌸', '💐', '📋', '🔖', '👗', '💰', '💵', '💳', '✅', '💖', '🏢', '🤖'];
  for (const e of emojis) {
    const present = str.includes(e);
    console.log(`Emoji ${e} (U+${e.codePointAt(0).toString(16)}): present in utf8 decode = ${present}`);
  }

  // Check if string contains replacement character U+FFFD
  const fffdCount = (str.match(/\uFFFD/g) || []).length;
  console.log('Number of U+FFFD replacement characters in file:', fffdCount);
}

inspectFile('backend/src/controllers/orderController.js');
inspectFile('src/components/SalesERP.jsx');

