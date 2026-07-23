module.exports = {
  layout: 'layouts/project.njk',
  pageId: 'project',
  activeNav: 'project',
  stylesheet: 'project.css',
  fontUrl:
    'https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400&family=Geist:wght@400;500&family=Geist+Mono:wght@400;500&display=swap',
  description: 'Project case study by Andy Cabindol, product and motion designer.',
  eleventyComputed: {
    projectSlug: (data) => data.page.fileSlug,
    permalink: (data) => `/projects/${data.page.fileSlug}/index.html`,
  },
};
