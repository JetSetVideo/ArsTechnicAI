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
  const { projectId } = req.query;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ message: 'Invalid project ID' });
  }

  try {
    switch (req.method) {
      case 'GET':
        // Get project details
        const projectDetails = await projectService.getProjectDetails(
          projectId, 
          userId
        );

        return res.status(200).json(projectDetails);

      case 'PUT':
        // Update project
        const { name, description, metadata } = req.body;

        if (!name) {
          throw new ValidationError('Project name is required');
        }

        const updatedProject = await projectService.updateProject({
          id: projectId,
          name,
          description,
          metadata
        });

        return res.status(200).json(updatedProject);

      case 'DELETE':
        // Delete project
        await projectService.deleteProject(projectId, userId);

        return res.status(204).end();

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Project-specific error:', error);
    return res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Project operation failed' 
    });
  }
}

export default withAuth(handler);