import type { NextApiResponse } from 'next';

export function ok<T>(res: NextApiResponse, data: T) {
  return res.status(200).json({ success: true, data });
}

export function created<T>(res: NextApiResponse, data: T) {
  return res.status(201).json({ success: true, data });
}

export function noContent(res: NextApiResponse) {
  return res.status(204).end();
}

export function paginated<T>(
  res: NextApiResponse,
  data: T[],
  meta: { page: number; pageSize: number; total: number }
) {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      ...meta,
      totalPages: Math.ceil(meta.total / meta.pageSize),
      hasNext: meta.page * meta.pageSize < meta.total,
      hasPrev: meta.page > 1,
    },
  });
}

export function errorResponse(
  res: NextApiResponse,
  statusCode: number,
  message: string,
  code?: string,
  errors?: Record<string, string[]>
) {
  return res.status(statusCode).json({
    success: false,
    error: { message, code, errors },
  });
}
