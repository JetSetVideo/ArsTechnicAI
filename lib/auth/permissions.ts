import type { Role } from '@prisma/client';

const ROLE_HIERARCHY: Record<Role, number> = {
  SUPERADMIN: 5,
  ADMIN: 4,
  CREATOR: 3,
  USER: 2,
  VIEWER: 1,
};

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isOwnerOrRole(
  userId: string,
  resourceOwnerId: string,
  userRole: Role,
  requiredRole: Role
): boolean {
  return userId === resourceOwnerId || hasRole(userRole, requiredRole);
}

export function requireCreator(role: Role): boolean {
  return hasRole(role, 'CREATOR');
}

export function requireAdmin(role: Role): boolean {
  return hasRole(role, 'ADMIN');
}

export function requireSuperAdmin(role: Role): boolean {
  return hasRole(role, 'SUPERADMIN');
}
