import React, { 
  createContext, 
  useContext, 
  useState, 
  useCallback 
} from 'react';
import { useAuth } from './AuthContext';

// Types for project management
interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
  generationJobs?: GenerationJob[];
}

interface GenerationJob {
  id: string;
  type: string;
  prompt: string;
  status: 'pending' | 'completed' | 'failed';
  result?: string;
  createdAt: Date;
}

interface ProjectCreateInput {
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface ProjectSearchOptions {
  keywords?: string[];
  createdAfter?: Date;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface ProjectContextType {
  projects: Project[];
  totalProjects: number;
  createProject: (input: ProjectCreateInput) => Promise<Project>;
  updateProject: (projectId: string, input: Partial<ProjectCreateInput>) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  searchProjects: (options?: ProjectSearchOptions) => Promise<void>;
  getProjectDetails: (projectId: string) => Promise<Project>;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Create a new project
  const createProject = useCallback(async (input: ProjectCreateInput): Promise<Project> => {
    if (!token) {
      throw new Error('Authentication required');
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Project creation failed');
      }

      const newProject: Project = await response.json();
      
      // Update projects list
      setProjects(prev => [newProject, ...prev]);
      setTotalProjects(prev => prev + 1);

      return newProject;
    } catch (error) {
      console.error('Project creation error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Update an existing project
  const updateProject = useCallback(async (
    projectId: string, 
    input: Partial<ProjectCreateInput>
  ): Promise<Project> => {
    if (!token) {
      throw new Error('Authentication required');
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Project update failed');
      }

      const updatedProject: Project = await response.json();
      
      // Update projects list
      setProjects(prev => 
        prev.map(project => 
          project.id === projectId ? updatedProject : project
        )
      );

      return updatedProject;
    } catch (error) {
      console.error('Project update error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Delete a project
  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    if (!token) {
      throw new Error('Authentication required');
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Project deletion failed');
      }

      // Update projects list
      setProjects(prev => prev.filter(project => project.id !== projectId));
      setTotalProjects(prev => prev - 1);
    } catch (error) {
      console.error('Project deletion error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Search projects
  const searchProjects = useCallback(async (options: ProjectSearchOptions = {}): Promise<void> => {
    if (!token) {
      throw new Error('Authentication required');
    }

    setIsLoading(true);

    try {
      const url = new URL('/api/projects', window.location.origin);
      
      // Add search parameters
      if (options.keywords) {
        url.searchParams.append('keywords', options.keywords.join(','));
      }
      if (options.createdAfter) {
        url.searchParams.append('createdAfter', options.createdAfter.toISOString());
      }
      if (options.sortBy) {
        url.searchParams.append('sortBy', options.sortBy);
      }
      if (options.sortOrder) {
        url.searchParams.append('sortOrder', options.sortOrder);
      }
      if (options.limit) {
        url.searchParams.append('limit', options.limit.toString());
      }
      if (options.offset) {
        url.searchParams.append('offset', options.offset.toString());
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Project search failed');
      }

      const { projects, total }: { projects: Project[], total: number } = await response.json();
      
      setProjects(projects);
      setTotalProjects(total);
    } catch (error) {
      console.error('Project search error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Get project details
  const getProjectDetails = useCallback(async (projectId: string): Promise<Project> => {
    if (!token) {
      throw new Error('Authentication required');
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Project details retrieval failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Project details error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const contextValue: ProjectContextType = {
    projects,
    totalProjects,
    createProject,
    updateProject,
    deleteProject,
    searchProjects,
    getProjectDetails,
    isLoading
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
};

// Custom hook for using project context
export const useProjects = () => {
  const context = useContext(ProjectContext);
  
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  
  return context;
};