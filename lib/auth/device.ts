import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

export interface DeviceInfo {
  browser: string;
  os: string;
  deviceType: string;
  name: string;
}

export interface GeoInfo {
  city?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
}

function getIpFromHeaders(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0].split(',')[0].trim();
  return '127.0.0.1';
}

function getIpSubnet(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) return parts.slice(0, 3).join('.');
  // IPv6: use first 4 groups
  return ip.split(':').slice(0, 4).join(':');
}

export function parseDevice(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();

  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(ua)) deviceType = 'mobile';
  else if (/ipad|tablet/.test(ua)) deviceType = 'tablet';

  let browser = 'Unknown';
  if (/edg\/|edge\//.test(ua)) browser = 'Edge';
  else if (ua.includes('chrome/') && !ua.includes('chromium/')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Safari';
  else if (ua.includes('opera/') || ua.includes('opr/')) browser = 'Opera';

  let os = 'Unknown OS';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('android')) os = 'Android';
  else if (/iphone os|ios/.test(ua)) os = 'iOS';
  else if (ua.includes('ipad')) os = 'iPadOS';
  else if (ua.includes('mac os x') || ua.includes('macos')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';

  return { browser, os, deviceType, name: `${browser} on ${os}` };
}

function buildFingerprint(userAgent: string, ip: string): string {
  const subnet = getIpSubnet(ip);
  return createHash('sha256').update(`${userAgent}|${subnet}`).digest('hex');
}

async function getGeoInfo(ip: string): Promise<GeoInfo> {
  // Skip geo for loopback and private addresses
  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.')
  ) {
    return {};
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,city,country,countryCode,timezone`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return {};
    const data = (await res.json()) as {
      status: string;
      city?: string;
      country?: string;
      countryCode?: string;
      timezone?: string;
    };
    if (data.status !== 'success') return {};
    return {
      city: data.city,
      country: data.country,
      countryCode: data.countryCode,
      timezone: data.timezone,
    };
  } catch {
    return {};
  }
}

export async function upsertDeviceFromHeaders(
  userId: string,
  headers: Record<string, string | string[] | undefined>
): Promise<{ deviceId: string; sessionId: string }> {
  const rawUa = headers['user-agent'];
  const userAgent = (Array.isArray(rawUa) ? rawUa[0] : rawUa) ?? 'Unknown';
  const ip = getIpFromHeaders(headers);
  const fingerprint = buildFingerprint(userAgent, ip);
  const deviceInfo = parseDevice(userAgent);
  const geo = await getGeoInfo(ip);

  const device = await prisma.userDevice.upsert({
    where: { userId_fingerprint: { userId, fingerprint } },
    update: {
      lastSeenAt: new Date(),
      ip,
      loginCount: { increment: 1 },
      ...(geo.city ? geo : {}),
    },
    create: {
      userId,
      fingerprint,
      ip,
      ...deviceInfo,
      ...geo,
    },
  });

  const session = await prisma.userSession.create({
    data: { userId, deviceId: device.id, ip },
  });

  return { deviceId: device.id, sessionId: session.id };
}
