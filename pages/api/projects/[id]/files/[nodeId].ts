import { createApiHandler } from '@/lib/api/handler';
import { ok, noContent } from '@/lib/api/response';
import { NotFoundError } from '@/lib/api/errors';
import { updateFileNodeSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';

export default createApiHandler(
  { methods: ['PATCH', 'DELETE'] },
  async (req, res) => {
    const nodeId = req.query.nodeId as string;

    if (req.method === 'PATCH') {
      const data = updateFileNodeSchema.parse(req.body);
      const node = await prisma.fileNode.update({
        where: { id: nodeId },
        data,
      });
      return ok(res, node);
    }

    // DELETE - cascades to children
    const node = await prisma.fileNode.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundError('FileNode');
    await prisma.fileNode.delete({ where: { id: nodeId } });
    return noContent(res);
  }
);
