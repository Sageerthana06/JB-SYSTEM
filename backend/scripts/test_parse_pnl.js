const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'src', 'components', 'Finance', 'ProfitLossReportView.jsx');
const code = fs.readFileSync(filePath, 'utf8');

console.log('File length:', code.length);
console.log('First 200 chars:', code.substring(0, 200));

// Test with babel if available, or regex
try {
  const babel = require('@babel/parser');
  const ast = babel.parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log('Babel parse succeeded!');
  const exports = ast.program.body.filter(n => n.type === 'ExportNamedDeclaration' || n.type === 'ExportDefaultDeclaration');
  console.log('Exports found in AST:', exports.length);
  exports.forEach(e => {
    if (e.declaration && e.declaration.declarations) {
      console.log('Declaration:', e.declaration.declarations.map(d => d.id.name));
    }
  });
} catch (err) {
  console.error('Babel error:', err.message);
}

