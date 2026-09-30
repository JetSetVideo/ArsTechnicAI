/**
 * Node stand-in for the few Deno filesystem calls the stores use.
 * The pure graph code in core/ never touches this.
 */
import { promises as fs } from "fs";

export class NotFound extends Error {
  override name = "NotFound";
}

export class AlreadyExists extends Error {
  override name = "AlreadyExists";
}

function rethrow(error: unknown): never {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") throw new NotFound((error as Error).message);
  if (code === "EEXIST") throw new AlreadyExists((error as Error).message);
  throw error;
}

export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
}

export const host = {
  env: {
    get(name: string): string | undefined {
      return process.env[name];
    },
  },
  errors: { NotFound, AlreadyExists },
  async readTextFile(path: string): Promise<string> {
    try {
      return await fs.readFile(path, "utf8");
    } catch (error) {
      rethrow(error);
    }
  },
  async writeTextFile(
    path: string,
    data: string,
    options?: { createNew?: boolean },
  ): Promise<void> {
    try {
      if (options?.createNew) {
        const handle = await fs.open(path, "wx");
        try {
          await handle.writeFile(data);
        } finally {
          await handle.close();
        }
        return;
      }
      await fs.writeFile(path, data);
    } catch (error) {
      rethrow(error);
    }
  },
  async writeFile(
    path: string,
    data: Uint8Array,
    options?: { createNew?: boolean },
  ): Promise<void> {
    try {
      if (options?.createNew) {
        const handle = await fs.open(path, "wx");
        try {
          await handle.writeFile(data);
        } finally {
          await handle.close();
        }
        return;
      }
      await fs.writeFile(path, data);
    } catch (error) {
      rethrow(error);
    }
  },
  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      await fs.mkdir(path, { recursive: options?.recursive ?? false });
    } catch (error) {
      rethrow(error);
    }
  },
  async chmod(path: string, mode: number): Promise<void> {
    await fs.chmod(path, mode);
  },
  async *readDir(path: string): AsyncGenerator<DirEntry> {
    let names;
    try {
      names = await fs.readdir(path, { withFileTypes: true });
    } catch (error) {
      rethrow(error);
    }
    for (const entry of names) {
      yield {
        name: entry.name,
        isFile: entry.isFile(),
        isDirectory: entry.isDirectory(),
      };
    }
  },
};
