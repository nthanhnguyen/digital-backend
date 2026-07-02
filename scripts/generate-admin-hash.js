const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'Admin123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Bcrypt hash for Admin123:');
  console.log(hash);
  console.log('\nUpdate db/migrations/V002__seed_admin_user.sql with this hash');
}

generateHash();
