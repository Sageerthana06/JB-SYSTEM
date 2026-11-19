const fs = require('fs');
const path = require('path');

// Let's inspect the last page of Sasikala's PDF
console.log('Checking Sasikala PDF...');
const p = path.join(__dirname, 'test_pdfs/JB_GROUP_Tailor_Statement_Sasikala_2026-11-02_to_2026-11-08.pdf');
if (fs.existsSync(p)) {
  console.log('File size:', fs.statSync(p).size);
}

