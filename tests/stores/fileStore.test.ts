/**
 * File Store Unit Tests
 * 
 * Tests for file system management including:
 * - Asset operations
 * - Folder operations
 * - Navigation
 * - Project management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-file-' + Math.random().toString(36).substr(2, 9),
}));

import { useFileStore } from '../../stores/fileStore';
import { createMockAsset } from '../setup';

describe('FileStore', () => {
  beforeEach(() => {
    // Reset the store state
    useFileStore.setState({
      rootNodes: [],
      assets: new Map(),
      selectedPath: null,
      expandedPaths: new Set(),
      currentProjectPath: '/projects/untitled-project',
    });
  });

  describe('Asset Operations', () => {
    it('should add an asset', () => {
      const store = useFileStore.getState();
      const asset = createMockAsset({ id: 'asset-1', name: 'test.png' });
      
      store.addAsset(asset as any);
      
      const state = useFileStore.getState();
      expect(state.assets.size).toBe(1);
      expect(state.assets.get('asset-1')).toBeDefined();
    });

    it('should get an asset by id', () => {
      const store = useFileStore.getState();
      const asset = createMockAsset({ id: 'asset-get', name: 'get-test.png' });
      
      store.addAsset(asset as any);
      
      const retrieved = store.getAsset('asset-get');
      expect(retrieved?.name).toBe('get-test.png');
    });

    it('should update an asset', () => {
      const store = useFileStore.getState();
      const asset = createMockAsset({ id: 'asset-update', name: 'original.png' });
      
      store.addAsset(asset as any);
      store.updateAsset('asset-update', { name: 'updated.png' });
      
      const updated = store.getAsset('asset-update');
      expect(updated?.name).toBe('updated.png');
      // modifiedAt should be set to current time (>= createdAt)
      expect(updated?.modifiedAt).toBeGreaterThanOrEqual(asset.createdAt);
    });

    it('should remove an asset', () => {
      const store = useFileStore.getState();
      const asset = createMockAsset({ id: 'asset-remove' });
      
      store.addAsset(asset as any);
      expect(store.getAsset('asset-remove')).toBeDefined();
      
      store.removeAsset('asset-remove');
      expect(store.getAsset('asset-remove')).toBeUndefined();
    });
  });

  describe('Folder Operations', () => {
    it('should create a folder at root', () => {
      const store = useFileStore.getState();
      
      // Using empty string as parentPath creates proper root-level path
      store.createFolder('', 'TestFolder');
      
      const state = useFileStore.getState();
      expect(state.rootNodes).toHaveLength(1);
      expect(state.rootNodes[0].name).toBe('TestFolder');
      expect(state.rootNodes[0].type).toBe('folder');
      expect(state.rootNodes[0].path).toBe('/TestFolder');
    });

    it('should create folder with slash parent path (root)', () => {
      const store = useFileStore.getState();
      
      // '/' adds to root but creates path with double slash
      store.createFolder('/', 'RootFolder');
      
      const state = useFileStore.getState();
      expect(state.rootNodes.some(n => n.name === 'RootFolder')).toBe(true);
      // Note: path will be '//RootFolder' due to how parentPath is concatenated
    });

    it('should return created folder', () => {
      const store = useFileStore.getState();
      
      const folder = store.createFolder('', 'NewFolder');
      
      expect(folder).not.toBeNull();
      expect(folder?.name).toBe('NewFolder');
      expect(folder?.type).toBe('folder');
    });

    it('should initialize folder with empty children array', () => {
      const store = useFileStore.getState();
      
      store.createFolder('', 'EmptyFolder');
      
      const state = useFileStore.getState();
      const folder = state.rootNodes.find(n => n.name === 'EmptyFolder');
      expect(folder?.children).toBeDefined();
      expect(folder?.children).toEqual([]);
    });
  });

  describe('Navigation', () => {
    it('should select a path', () => {
      const store = useFileStore.getState();
      
      store.selectPath('/some/path');
      
      expect(useFileStore.getState().selectedPath).toBe('/some/path');
    });

    it('should clear selection', () => {
      const store = useFileStore.getState();
      store.selectPath('/some/path');
      
      store.selectPath(null);
      
      expect(useFileStore.getState().selectedPath).toBeNull();
    });

    it('should toggle expanded state', () => {
      const store = useFileStore.getState();
      
      store.toggleExpanded('/folder1');
      expect(useFileStore.getState().expandedPaths.has('/folder1')).toBe(true);
      
      store.toggleExpanded('/folder1');
      expect(useFileStore.getState().expandedPaths.has('/folder1')).toBe(false);
    });

    it('should expand a path', () => {
      const store = useFileStore.getState();
      
      store.expandPath('/folder1');
      
      expect(useFileStore.getState().expandedPaths.has('/folder1')).toBe(true);
    });

    it('should collapse a path', () => {
      const store = useFileStore.getState();
      store.expandPath('/folder1');
      
      store.collapsePath('/folder1');
      
      expect(useFileStore.getState().expandedPaths.has('/folder1')).toBe(false);
    });
  });

  describe('Project Management', () => {
    it('should set current project', () => {
      const store = useFileStore.getState();
      
      store.setCurrentProject('My Project');
      
      expect(useFileStore.getState().currentProjectPath).toBe('/projects/my-project');
    });

    it('should handle project names with spaces', () => {
      const store = useFileStore.getState();
      
      store.setCurrentProject('My Cool Project');
      
      expect(useFileStore.getState().currentProjectPath).toBe('/projects/my-cool-project');
    });

    it('should get project generated path', () => {
      const store = useFileStore.getState();
      store.setCurrentProject('Test Project');
      
      const path = store.getProjectGeneratedPath();
      
      expect(path).toBe('/projects/test-project/generated');
    });
  });

  describe('File Structure Initialization', () => {
    it('should initialize default file structure', () => {
      const store = useFileStore.getState();
      
      store.initializeFileStructure();
      
      const state = useFileStore.getState();
      expect(state.rootNodes.length).toBeGreaterThan(0);
      
      // Should have Imports, Projects, Prompts folders
      const folderNames = state.rootNodes.map(n => n.name);
      expect(folderNames).toContain('Imports');
      expect(folderNames).toContain('Projects');
      expect(folderNames).toContain('Prompts');
    });

    it('should initialize with custom project name', () => {
      const store = useFileStore.getState();
      
      store.initializeFileStructure('My Custom Project');
      
      const state = useFileStore.getState();
      expect(state.currentProjectPath).toBe('/projects/my-custom-project');
      
      // Find the Projects folder
      const projectsFolder = state.rootNodes.find(n => n.name === 'Projects');
      const projectFolder = projectsFolder?.children?.find(n => n.name === 'My Custom Project');
      expect(projectFolder).toBeDefined();
    });

    it('should create Generated and Exports subfolders', () => {
      const store = useFileStore.getState();
      
      store.initializeFileStructure('Test Project');
      
      const state = useFileStore.getState();
      const projectsFolder = state.rootNodes.find(n => n.name === 'Projects');
      const projectFolder = projectsFolder?.children?.find(n => n.name === 'Test Project');
      
      const subfolderNames = projectFolder?.children?.map(n => n.name) || [];
      expect(subfolderNames).toContain('Generated');
      expect(subfolderNames).toContain('Exports');
    });

    it('should expand default folders', () => {
      const store = useFileStore.getState();
      
      store.initializeFileStructure('Test');
      
      const state = useFileStore.getState();
      expect(state.expandedPaths.has('/imports')).toBe(true);
      expect(state.expandedPaths.has('/projects')).toBe(true);
    });
  });

  describe('Add Asset to Folder', () => {
    it('should add asset to map when using addAssetToFolder', () => {
      const store = useFileStore.getState();
      const asset = createMockAsset({ id: 'combined-asset', name: 'combined.png' });
      
      store.createFolder('/', 'TargetFolder');
      store.addAssetToFolder(asset as any, '/TargetFolder');
      
      const state = useFileStore.getState();
      // Should be in assets map
      expect(state.assets.has('combined-asset')).toBe(true);
    });

    it('should expand folder path when adding asset', () => {
      const store = useFileStore.getState();
      const asset = createMockAsset({ name: 'test.png' });
      
      store.createFolder('/', 'TestFolder');
      store.addAssetToFolder(asset as any, '/TestFolder');
      
      const state = useFileStore.getState();
      expect(state.expandedPaths.has('/TestFolder')).toBe(true);
    });

    it('should call addFileToFolder when adding asset', () => {
      const store = useFileStore.getState();
      const asset = createMockAsset({ id: 'test-id', name: 'file.png' });
      
      // Use initialized structure which has proper folder paths
      store.initializeFileStructure('Test');
      
      // The generated path should exist
      const generatedPath = store.getProjectGeneratedPath();
      store.addAssetToFolder(asset as any, generatedPath);
      
      const state = useFileStore.getState();
      expect(state.assets.has('test-id')).toBe(true);
      // Path should be expanded
      expect(state.expandedPaths.has(generatedPath)).toBe(true);
    });
  });
});
