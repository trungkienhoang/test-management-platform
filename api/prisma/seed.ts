import { PrismaClient, SystemRole, ProjectRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@testplatform.dev' },
    update: {},
    create: {
      email: 'admin@testplatform.dev',
      fullName: 'System Admin',
      passwordHash: await bcrypt.hash('Admin123!', 12),
      systemRole: SystemRole.ADMIN,
    },
  });
  console.log('✅ Admin:', admin.email);

  // QA Lead user
  const qaLead = await prisma.user.upsert({
    where: { email: 'qa.lead@testplatform.dev' },
    update: {},
    create: {
      email: 'qa.lead@testplatform.dev',
      fullName: 'Nguyen QA Lead',
      passwordHash: await bcrypt.hash('QaLead123!', 12),
    },
  });
  console.log('✅ QA Lead:', qaLead.email);

  // Tester user
  const tester = await prisma.user.upsert({
    where: { email: 'tester@testplatform.dev' },
    update: {},
    create: {
      email: 'tester@testplatform.dev',
      fullName: 'Tran Tester',
      passwordHash: await bcrypt.hash('Tester123!', 12),
    },
  });
  console.log('✅ Tester:', tester.email);

  // Developer user
  const dev = await prisma.user.upsert({
    where: { email: 'dev@testplatform.dev' },
    update: {},
    create: {
      email: 'dev@testplatform.dev',
      fullName: 'Le Developer',
      passwordHash: await bcrypt.hash('Dev12345!', 12),
    },
  });
  console.log('✅ Developer:', dev.email);

  // Sample project
  const project = await prisma.project.upsert({
    where: { id: 'sample-project-001' },
    update: {},
    create: {
      id: 'sample-project-001',
      name: 'Website Redesign QA',
      description: 'Kiểm thử toàn diện cho dự án redesign website công ty',
      createdById: qaLead.id,
      members: {
        create: [
          { userId: qaLead.id, role: ProjectRole.QA_LEAD },
          { userId: tester.id, role: ProjectRole.TESTER },
          { userId: dev.id, role: ProjectRole.DEVELOPER },
        ],
      },
    },
  });
  console.log('✅ Project:', project.name);

  console.log('\n🎉 Seed completed!');
  console.log('─────────────────────────────────');
  console.log('Test accounts:');
  console.log('  Admin:    admin@testplatform.dev    / Admin123!');
  console.log('  QA Lead:  qa.lead@testplatform.dev  / QaLead123!');
  console.log('  Tester:   tester@testplatform.dev   / Tester123!');
  console.log('  Dev:      dev@testplatform.dev       / Dev12345!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
