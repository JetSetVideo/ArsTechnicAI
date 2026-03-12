import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create SUPERADMIN user
  const hashedPassword = await bcrypt.hash('admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@arstechnicai.local' },
    update: {},
    create: {
      email: 'admin@arstechnicai.local',
      name: 'Admin',
      displayName: 'Super Admin',
      hashedPassword,
      role: 'SUPERADMIN',
      isActive: true,
      settings: {
        create: {},
      },
    },
  });
  console.log(`Created SUPERADMIN: ${admin.email} (id: ${admin.id})`);

  // Seed sample device + session for admin user
  const device = await prisma.userDevice.upsert({
    where: { userId_fingerprint: { userId: admin.id, fingerprint: 'seed-device-001' } },
    update: {},
    create: {
      userId: admin.id,
      fingerprint: 'seed-device-001',
      name: 'Chrome on Windows',
      browser: 'Chrome',
      os: 'Windows',
      deviceType: 'desktop',
      ip: '127.0.0.1',
      city: 'Local',
      country: 'Localhost',
      loginCount: 3,
      isTrusted: true,
    },
  });

  const existingSession = await prisma.userSession.findFirst({
    where: { userId: admin.id, deviceId: device.id },
  });
  if (!existingSession) {
    await prisma.userSession.create({
      data: {
        userId: admin.id,
        deviceId: device.id,
        ip: '127.0.0.1',
        startedAt: new Date(Date.now() - 3_600_000),
        endedAt: new Date(Date.now() - 1_800_000),
        durationMs: 1_800_000,
      },
    });
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: {
      totalLogins: 3,
      lastLoginAt: new Date(Date.now() - 1_800_000),
      lastLoginIp: '127.0.0.1',
      totalMinutesOnline: 30,
    },
  });
  console.log(`Seeded device and session for admin`);

  // Create default tags
  const defaultTags = [
    { name: 'landscape', color: '#22c55e' },
    { name: 'portrait', color: '#3b82f6' },
    { name: 'abstract', color: '#a855f7' },
    { name: 'concept-art', color: '#f59e0b' },
    { name: 'character', color: '#ef4444' },
    { name: 'environment', color: '#14b8a6' },
    { name: 'reference', color: '#6366f1' },
    { name: 'final', color: '#f97316' },
  ];

  for (const tag of defaultTags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: {},
      create: { ...tag, createdBy: admin.id },
    });
  }
  console.log(`Created ${defaultTags.length} default tags`);

  // Create default prompt templates
  const templates = [
    {
      name: 'Cinematic Scene',
      category: 'scene',
      template: '{{subject}} in a cinematic scene, {{lighting}} lighting, {{camera}} angle, film grain, {{mood}} atmosphere, 8k resolution',
      variables: { subject: '', lighting: 'dramatic', camera: 'low', mood: 'moody' },
      isGlobal: true,
    },
    {
      name: 'Character Portrait',
      category: 'character',
      template: 'Portrait of {{character}}, {{style}} style, {{background}} background, detailed features, {{lighting}} lighting',
      variables: { character: '', style: 'realistic', background: 'studio', lighting: 'rembrandt' },
      isGlobal: true,
    },
    {
      name: 'Environment Concept',
      category: 'environment',
      template: '{{environment}} environment, {{time_of_day}}, {{weather}}, {{style}} style, highly detailed, concept art',
      variables: { environment: '', time_of_day: 'golden hour', weather: 'clear', style: 'painterly' },
      isGlobal: true,
    },
  ];

  for (const tmpl of templates) {
    await prisma.promptTemplate.upsert({
      where: { id: tmpl.name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: tmpl,
    });
  }
  console.log(`Created ${templates.length} prompt templates`);

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
