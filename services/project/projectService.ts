import { PrismaClient, Project } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import Logger from '../../utils/logger';

interface ProjectCreateInput {
  name: string;
  description?: string;
  userId: string;
  metadata?: Record<string, any>;
}

interface ProjectUpdateInput {
  id: string;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface ProjectSearchOptions {
  userId?: string;
  keywords?: string[];
  createdAfter?: Date;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class ProjectService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Create a new project
  async createProject(input: ProjectCreateInput): Promise<Project> {
    try {
      const newProject = await this.prisma.project.create({
        data: {
          id: uuidv4(),
          name: input.name,
          description: input.description,
          creatorId: input.userId,
          metadata: input.metadata as any
        }
      });

      // Log project creation
      Logger.audit('Project Created', {
        projectId: newProject.id,
        userId: input.userId
      });

      return newProject;
    } catch (error) {
      Logger.error('Project Creation Failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        input 
      });
      throw error;
    }
  }

  // Update an existing project
  async updateProject(input: ProjectUpdateInput): Promise<Project> {
    try {
      const updatedProject = await this.prisma.project.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description && { description: input.description }),
          ...(input.metadata && { metadata: input.metadata as any })
        }
      });

      // Log project update
      Logger.audit('Project Updated', {
        projectId: updatedProject.id
      });

      return updatedProject;
    } catch (error) {
      Logger.error('Project Update Failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        input 
      });
      throw error;
    }
  }

  // Advanced project search with multiple filters
  async searchProjects(options: ProjectSearchOptions): Promise<{
    projects: Project[];
    total: number;
  }> {
    try {
      const where: any = {};

      if (options.userId) {
        where.creatorId = options.userId;
      }

      if (options.keywords && options.keywords.length > 0) {
        where.OR = [
          { name: { contains: options.keywords.join(' '), mode: 'insensitive' } },
          { description: { contains: options.keywords.join(' '), mode: 'insensitive' } }
        ];
      }

      if (options.createdAfter) {
        where.createdAt = { gte: options.createdAfter };
      }

      const [projects, total] = await Promise.all([
        this.prisma.project.findMany({
          where,
          orderBy: {
            [options.sortBy || 'createdAt']: options.sortOrder || 'desc'
          },
          take: options.limit || 10,
          skip: options.offset || 0
        }),
        this.prisma.project.count({ where })
      ]);

      return { projects, total };
    } catch (error) {
      Logger.error('Project Search Failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        options 
      });
      throw error;
    }
  }

  // Delete a project
  async deleteProject(projectId: string, userId: string): Promise<void> {
    try {
      // First, verify user ownership
      const project = await this.prisma.project.findUnique({
        where: { id: projectId }
      });

      if (!project || project.creatorId !== userId) {
        throw new Error('Project not found or unauthorized');
      }

      // Delete project and associated generation jobs
      await this.prisma.$transaction([
        this.prisma.generationJob.deleteMany({
          where: { projectId }
        }),
        this.prisma.project.delete({
          where: { id: projectId }
        })
      ]);

      // Log project deletion
      Logger.audit('Project Deleted', {
        projectId,
        userId
      });
    } catch (error) {
      Logger.error('Project Deletion Failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId 
      });
      throw error;
    }
  }

  // Get project details with associated generation jobs
  async getProjectDetails(projectId: string, userId: string) {
    try {
      const project = await this.prisma.project.findUnique({
        where: { 
          id: projectId,
          creatorId: userId 
        },
        include: {
          generationJobs: {
            orderBy: { createdAt: 'desc' },
            take: 10 // Limit to 10 most recent jobs
          }
        }
      });

      if (!project) {
        throw new Error('Project not found');
      }

      return project;
    } catch (error) {
      Logger.error('Project Details Retrieval Failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId 
      });
      throw error;
    }
  }
}