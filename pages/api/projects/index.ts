import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../middleware/authMiddleware';
import { ProjectService } from '../../../services/project/projectService';
import { ValidationError } from '../../../utils/errorHandler';

async function handler(
  req: NextApiRequest, 
  res: NextApiResponse, 
  userId: string, 
  userRoles: string[]
) {
  const projectService = new ProjectService();

  try {
    switch (req.method) {
      case 'POST':
        // Create new project
        const { name, description, metadata } = req.body;

        if (!name) {
          throw new ValidationError('Project name is required');
        }

        const newProject = await projectService.createProject({
          name,
          description,
          userId,
          metadata
        });

        return res.status(201).json(newProject);

      case 'GET':
        // Search projects
        const { 
          keywords, 
          createdAfter, 
          sortBy, 
          sortOrder, 
          limit, 
          offset 
        } = req.query;

        const searchResult = await projectService.searchProjects({
          userId,
          keywords: keywords ? (keywords as string).split(',') : undefined,
          createdAfter: createdAfter ? new Date(createdAfter as string) : undefined,
          sortBy: sortBy as 'name' | 'createdAt',
          sortOrder: sortOrder as 'asc' | 'desc',
          limit: limit ? parseInt(limit as string) : undefined,
          offset: offset ? parseInt(offset as string) : undefined
        });

        return res.status(200).json(searchResult);

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Project management error:', error);
    return res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Project management failed' 
    });
  }
}

export default withAuth(handler);