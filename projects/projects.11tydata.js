const { projectDescription } = require('../_utils/project-seo');

module.exports = {
  layout: 'layouts/project-redirect.njk',
  pageId: 'project',
  activeNav: 'work',
  eleventyComputed: {
    projectSlug: (data) => data.page.fileSlug,
    permalink: (data) => `/projects/${data.page.fileSlug}/index.html`,
    description: (data) => projectDescription(data),
    seoUrl: (data) => `https://andycabindol.com/case-studies/${data.page.fileSlug}/`,
  },
};
