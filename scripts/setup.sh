#!/bin/bash

echo "🚀 Setting up Auth Service..."
echo ""

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🐳 Starting Docker containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

echo ""
echo "🔑 Generating admin password hash..."
node scripts/generate-admin-hash.js > /tmp/admin-hash.txt
ADMIN_HASH=$(node -e "const bcrypt = require('bcrypt'); bcrypt.hash('Admin123', 10).then(h => console.log(h));")

echo ""
echo "📝 Updating admin user migration..."
sed -i "s/\$2b\$10\$YourHashedPasswordHere.Change.This.In.Production.Admin123Hash/${ADMIN_HASH}/g" db/migrations/V002__seed_admin_user.sql

echo ""
echo "🗄️  Running database migrations..."
npm run migrate

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start the application with:"
echo "  npm run start:dev"
echo ""
echo "Default admin credentials:"
echo "  Email: admin@example.com"
echo "  Password: Admin123"
echo ""
echo "API will be available at:"
echo "  http://localhost:9000"
echo "  http://localhost:9000/docs (Swagger)"
