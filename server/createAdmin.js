require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function main() {
  console.log('\n── Create Admin User ──────────────────────');
  const username = (await ask('Username: ')).trim();
  const password = (await ask('Password: ')).trim();

  if (!username || !password) {
    console.error('Error: username and password cannot be empty');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const admin = await prisma.admin.create({ data: { username, passwordHash } });
    console.log(`\nAdmin "${admin.username}" created successfully ✓`);
  } catch (err) {
    if (err.code === 'P2002') {
      console.error(`Error: username "${username}" already exists`);
    } else {
      console.error('Error:', err.message);
    }
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();
