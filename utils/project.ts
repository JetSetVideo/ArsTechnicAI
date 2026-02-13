export const slugifyProjectName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const projectPathFromName = (name: string): string => {
  const slug = slugifyProjectName(name) || 'untitled-project';
  return `/projects/${slug}`;
};
