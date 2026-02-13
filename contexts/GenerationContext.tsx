import React, { 
  createContext, 
  useContext, 
  useState, 
  useCallback 
} from 'react';
import { useAuth } from './AuthContext';

// Types for generation
interface GenerationRequest {
  type: 'text' | 'image' | 'video' | 'audio';
  prompt: string;
  projectId?: string;
  parameters?: Record<string, any>;
}

interface GenerationResult {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  type: string;
  prompt: string;
  result?: string;
  createdAt: Date;
}

interface GenerationContextType {
  generate: (request: GenerationRequest) => Promise<GenerationResult>;
  generationHistory: GenerationResult[];
  isGenerating: boolean;
  fetchGenerationHistory: (type?: string) => Promise<void>;
}

const GenerationContext = createContext<GenerationContextType | undefined>(undefined);

export const GenerationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationHistory, setGenerationHistory] = useState<GenerationResult[]>([]);

  const generate = useCallback(async (request: GenerationRequest): Promise<GenerationResult> => {
    if (!token) {
      throw new Error('Authentication required');
    }

    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Generation failed');
      }

      const result: GenerationResult = await response.json();
      
      // Update generation history
      setGenerationHistory(prev => [result, ...prev]);

      return result;
    } catch (error) {
      console.error('Generation error:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [token]);

  const fetchGenerationHistory = useCallback(async (type?: string) => {
    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const url = new URL('/api/generate', window.location.origin);
      if (type) url.searchParams.append('type', type);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch history');
      }

      const history: GenerationResult[] = await response.json();
      setGenerationHistory(history);
    } catch (error) {
      console.error('Fetch generation history error:', error);
      throw error;
    }
  }, [token]);

  const contextValue: GenerationContextType = {
    generate,
    generationHistory,
    isGenerating,
    fetchGenerationHistory
  };

  return (
    <GenerationContext.Provider value={contextValue}>
      {children}
    </GenerationContext.Provider>
  );
};

// Custom hook for using generation context
export const useGeneration = () => {
  const context = useContext(GenerationContext);
  
  if (context === undefined) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }
  
  return context;
};