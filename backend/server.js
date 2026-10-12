const path = require('path');
const dotenv = require('dotenv');
// Explicitly load backend/.env whether launched from root or backend folder
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config(); // fallback to current working directory if needed
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
