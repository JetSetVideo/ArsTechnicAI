import path from 'path';
import fs from 'fs/promises';
import type { z } from 'zod';
import { createApiHandler } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { savePromptTemplateFileSchema } from '@/lib/validation/schemas';

const DATA_DIR = path.join(process.cwd(), '.ars-data');

type SaveTemplateBody = z.infer<typeof savePromptTemplateFileSchema>;

export default createApiHandler(
  { methods: ['POST'], bodySchema: savePromptTemplateFileSchema },
  async (req, res) => {
    const body = req.body as SaveTemplateBody;

    const promptsDir = path.join(DATA_DIR, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });

    const fileName = `${body.slug}.template.json`;
    const filePath = path.join(promptsDir, fileName);

    const document = {
      version: 1,
      kind: 'ars.promptTemplate',
      savedAt: Date.now(),
      id: body.id,
      name: body.name,
      category: body.category ?? 'general',
      description: body.description,
      template: body.template,
      variables: body.variables ?? {},
      sceneBrief: body.sceneBrief ?? null,
      isGlobal: body.isGlobal ?? false,
    };

    await fs.writeFile(filePath, JSON.stringify(document, null, 2), 'utf-8');

    return ok(res, {
      fileName,
      relativePath: path.relative(process.cwd(), filePath),
    });
  }
);
