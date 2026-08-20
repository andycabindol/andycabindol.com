module.exports = {
  layout: 'layouts/project-redirect.njk',
  pageId: 'project',
  activeNav: 'work',
  description: 'Project case study by Andy Cabindol, product and motion designer.',
  eleventyComputed: {
    projectSlug: (data) => data.page.fileSlug,
    permalink: (data) => `/projects/${data.page.fileSlug}/index.html`,
  },
};
