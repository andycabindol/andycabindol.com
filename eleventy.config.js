const markdownIt = require('markdown-it');
const fs = require('node:fs');
const path = require('node:path');
const { projectDescription, projectOgImage } = require('./_utils/project-seo');

function loadProjectOrder() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '_data', 'projectOrder.json'), 'utf8'),
  );
}

function projectSortIndex(slug, projectOrder, fallbackOrder = 0) {
  const index = projectOrder.indexOf(slug);
  if (index >= 0) return index;
  // Not listed yet — keep after ordered projects, stable via optional front matter order.
  return projectOrder.length + fallbackOrder;
}

const SITE = {
  url: 'https://andycabindol.com',
  defaultOgImage: 'https://andycabindol.com/preview.png',
};

function extractLeadingBlock(html) {
  const input = html.trimStart();
  const open = input.match(/^<([a-zA-Z0-9]+)(\s[^>]*)?>/);
  if (!open) return null;

  const tag = open[1].toLowerCase();
  const classAttr = (open[2] || '').match(/\bclass=["']([^"']+)["']/);
  const classes = classAttr?.[1] || '';
  const allowed =
    (tag === 'div' && /\bproject-(?:grid|embed)\b/.test(classes))
    || (tag === 'figure' && /\bproject-figure\b/.test(classes));
  if (!allowed) return null;

  let depth = 0;
  const token = new RegExp(`</?${tag}\\b[^>]*>`, 'gi');
  let match;
  while ((match = token.exec(input))) {
    const isClose = match[0][1] === '/';
    const isSelfClosing = /\/>$/.test(match[0]);
    if (isClose) depth -= 1;
    else if (!isSelfClosing) depth += 1;
    if (depth === 0) {
      const end = match.index + match[0].length;
      return {
        block: input.slice(0, end),
        rest: input.slice(end).trimStart(),
      };
    }
  }
  return null;
}

module.exports = function eleventyConfig(eleventy) {
  const md = markdownIt({ html: true, linkify: true, breaks: false });
  eleventy.setLibrary('md', md);

  eleventy.addPassthroughCopy('nav.css');
  eleventy.addPassthroughCopy('nav.js');
  eleventy.addPassthroughCopy('project.js');
  eleventy.addPassthroughCopy('project.css');
  eleventy.addPassthroughCopy('lightbox.css');
  eleventy.addPassthroughCopy('styles.css');
  eleventy.addPassthroughCopy('about.css');
  eleventy.addPassthroughCopy('about.js');
  eleventy.addPassthroughCopy({ about: 'about' });
  eleventy.addPassthroughCopy('script.js');
  eleventy.addPassthroughCopy('components');
  eleventy.addPassthroughCopy('logos');
  eleventy.addPassthroughCopy('scripts');
  eleventy.addPassthroughCopy('embeds');
  eleventy.addPassthroughCopy('media');
  eleventy.addPassthroughCopy('favicon.svg');
  eleventy.addPassthroughCopy('favicon.png');
  eleventy.addPassthroughCopy('preview.png');
  eleventy.addPassthroughCopy('case-study.css');
  eleventy.addPassthroughCopy('case-study.js');
  // Prevent GitHub Pages from re-running Jekyll on the built site.
  eleventy.addPassthroughCopy('.nojekyll');

  eleventy.ignores.add('index.html');
  eleventy.ignores.add('about.html');
  eleventy.ignores.add('project.html');
  eleventy.ignores.add('README.md');
  eleventy.ignores.add('projects/_template.md');
  eleventy.ignores.add('node_modules/**');
  eleventy.ignores.add('_site/**');

  eleventy.addWatchTarget('./_data/projectOrder.json');
  eleventy.addWatchTarget('./scripts/creamy-orb-source.js');
  eleventy.addWatchTarget('./scripts/work-gradients-source.js');
  // Bundled outputs must not retrigger --serve, or the page live-reloads forever.
  eleventy.watchIgnores.add('components/creamy-orb.js');
  eleventy.watchIgnores.add('components/work-gradients.js');

  eleventy.on('eleventy.before', async () => {
    const esbuild = require('esbuild');
    const bundles = [
      {
        entry: 'scripts/creamy-orb-source.js',
        outfile: path.join(__dirname, 'components', 'creamy-orb.js'),
      },
      {
        entry: 'scripts/work-gradients-source.js',
        outfile: path.join(__dirname, 'components', 'work-gradients.js'),
      },
    ];

    await Promise.all(
      bundles.map(async ({ entry, outfile }) => {
        const result = await esbuild.build({
          entryPoints: [entry],
          bundle: true,
          format: 'iife',
          write: false,
          minify: true,
          logLevel: 'silent',
        });
        const next = result.outputFiles[0].contents;
        const prev = fs.existsSync(outfile) ? fs.readFileSync(outfile) : null;
        if (!prev || !Buffer.from(next).equals(prev)) {
          fs.writeFileSync(outfile, next);
        }
      }),
    );
  });

  eleventy.addCollection('projects', (collectionApi) => {
    const projectOrder = loadProjectOrder();
    return collectionApi
      .getFilteredByGlob('projects/*.md')
      .filter((item) => !item.inputPath.includes('_template'))
      .filter((item) => projectOrder.includes(item.fileSlug))
      .sort((a, b) => {
        const aIndex = projectSortIndex(a.fileSlug, projectOrder, a.data.order ?? 0);
        const bIndex = projectSortIndex(b.fileSlug, projectOrder, b.data.order ?? 0);
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a.fileSlug.localeCompare(b.fileSlug);
      });
  });

  eleventy.addFilter('projectUrl', (slug) => {
    const value = String(slug || '').trim();
    if (!value) return '/';
    return `/?project=${encodeURIComponent(value)}`;
  });

  eleventy.addFilter('projectCaseStudyUrl', (slug) => {
    const value = String(slug || '').trim();
    if (!value) return '/';
    return `/case-studies/${value.replace(/^\/?case-studies\/?/i, '').replace(/\/$/, '')}/`;
  });

  eleventy.addFilter('projectDescription', (data) => projectDescription(data));

  eleventy.addFilter('projectOgImage', (data) => projectOgImage(data, SITE.url));

  eleventy.addFilter('absoluteUrl', (path) => {
    const value = String(path || '').trim();
    if (!value) return SITE.url;
    if (/^https?:\/\//i.test(value)) return value;
    return `${SITE.url}${value.startsWith('/') ? value : `/${value}`}`;
  });

  eleventy.addFilter('isVideoSrc', (src) =>
    /\.(webm|mp4|mov)(\?|#|$)/i.test(String(src || '')),
  );

  eleventy.addFilter('cardLayoutClass', (layout) => {
    if (!layout || layout === 'default') return '';
    return `project-media--${layout}`;
  });

  eleventy.addFilter('neighborProject', (projects, slug, direction = 1) => {
    if (!projects?.length) return null;
    const index = projects.findIndex((item) => item.fileSlug === slug);
    const current = index >= 0 ? index : 0;
    const nextIndex = (current + direction + projects.length) % projects.length;
    return projects[nextIndex];
  });

  eleventy.addFilter('projectIndex', (projects, slug) => {
    const index = projects.findIndex((item) => item.fileSlug === slug);
    return index >= 0 ? index : 0;
  });

  eleventy.addFilter('projectFacts', (data = {}) => {
    if (Array.isArray(data.facts) && data.facts.length) {
      return data.facts.filter((fact) => fact && (fact.label || fact.value));
    }

    const fallback = [];
    if (data.company) fallback.push({ label: 'Company', value: data.company });
    if (data.role) fallback.push({ label: 'Role', value: data.role });
    if (data.year) fallback.push({ label: 'Year', value: data.year });
    return fallback;
  });

  eleventy.addPairedShortcode('projectSection', (content, label, image = '', imageAlt = '') => {
    const sectionId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let body = content.trim();
    const mediaParts = [];

    if (image) {
      mediaParts.push(
        `<figure class="project-figure project-section__media media-skeleton media-skeleton--fill"><img class="media-skeleton__media" src="${image}" alt="${imageAlt || label}" loading="lazy"></figure>`,
      );
    } else {
      // Hoist leading grids / figures / embeds above the section title.
      while (body) {
        const leading = extractLeadingBlock(body);
        if (!leading) break;
        mediaParts.push(leading.block);
        body = leading.rest.trim();
      }
    }

    const media = mediaParts.length
      ? `<div class="project-section__media">${mediaParts.join('\n')}</div>`
      : '';

    return `<section class="project-section" id="${sectionId}" data-section-label="${label}">
${media}
<h2 class="project-section__title">${label}</h2>
<div class="project-section__body">
${body}
</div>
</section>`;
  });

  eleventy.addPairedShortcode('projectGrid', (content, columns = 2) => {
    const cols = Math.max(1, Math.min(6, parseInt(columns, 10) || 2));
    return `<div class="project-grid project-grid--${cols}" style="--project-grid-cols: ${cols}">${content}</div>`;
  });

  eleventy.addPairedShortcode('projectMediaRow', (content) =>
    `<div class="project-grid project-grid--2" style="--project-grid-cols: 2">${content}</div>`,
  );

  eleventy.addPairedShortcode('projectMediaCell', (content) => {
    const trimmed = content.trim();
    if (/^<(?:figure|img|video|div)\b/i.test(trimmed)) {
      return trimmed;
    }
    return `<div class="project-media-cell">${content}</div>`;
  });

  eleventy.addShortcode('projectImage', (src, alt = '') =>
    `<figure class="project-figure media-skeleton media-skeleton--fill"><img class="media-skeleton__media" src="${src}" alt="${alt}" loading="lazy"></figure>`,
  );

  eleventy.addShortcode('projectGradient', (slug, variant = '') => {
    const safeSlug = String(slug || '').replace(/"/g, '');
    const safeVariant = String(variant || '').replace(/"/g, '');
    // Gradients archived — flat gray stand-in. Slug kept so swirls can return.
    return `<figure class="project-figure project-figure--gray" data-archived-gradient="${safeSlug}" data-archived-variant="${safeVariant}" aria-hidden="true"></figure>`;
  });

  eleventy.addShortcode('projectPlain', (tone = 'cream') => {
    const safeTone = String(tone || 'cream').replace(/[^a-z0-9-]/gi, '') || 'cream';
    return `<figure class="project-figure project-figure--plain project-figure--${safeTone}" aria-hidden="true"></figure>`;
  });

  eleventy.addShortcode('projectVideo', (src, poster = '') => {
    const posterAttr = poster ? ` poster="${poster}"` : '';
    return `<figure class="project-figure project-figure--video media-skeleton media-skeleton--fill"><video class="media-skeleton__media" src="${src}"${posterAttr} controls playsinline></video></figure>`;
  });

  eleventy.addShortcode('projectAutoplayVideo', (src, label = '', mode = '', aspect = '', background = '') => {
    const safeSrc = String(src || '').replace(/"/g, '');
    const safeLabel = String(label || 'Project video').replace(/"/g, '&quot;');
    const silent = mode === 'silent' || mode === 'nosound';
    const bgSrc = String(background || '').trim().replace(/"/g, '');
    const staged = Boolean(bgSrc);
    const aspectValue = staged ? '' : String(aspect || '').trim().replace(/"/g, '');
    const natural = !staged && (silent || Boolean(aspectValue));
    const aspectAttr = aspectValue ? ` style="aspect-ratio: ${aspectValue}"` : '';
    const naturalClass = natural ? ' project-figure--autoplay-natural' : '';
    const stageClass = staged ? ' project-figure--autoplay-stage' : '';
    const bg = staged
      ? `<img class="project-figure__bg" src="${bgSrc}" alt="" decoding="async" aria-hidden="true">`
      : '';
    const button = silent
      ? ''
      : `<button type="button" class="video-sound" data-video-sound aria-pressed="false" aria-label="Unmute video">
<span>Unmute</span>
<svg class="video-sound__icon video-sound__icon--off" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2.2 5.5h2.1L8 2.4v11.2L4.3 10.5H2.2A1.2 1.2 0 0 1 1 9.3V6.7a1.2 1.2 0 0 1 1.2-1.2Zm9.05.05 1.2 1.2-1.2 1.2 1.2 1.2-1.2 1.2-1.2-1.2-1.2 1.2-1.2-1.2 1.2-1.2-1.2-1.2 1.2-1.2 1.2 1.2 1.2-1.2Z"/></svg>
<svg class="video-sound__icon video-sound__icon--on" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2.2 5.5h2.1L8 2.4v11.2L4.3 10.5H2.2A1.2 1.2 0 0 1 1 9.3V6.7a1.2 1.2 0 0 1 1.2-1.2Zm7.7 1.15a2.6 2.6 0 0 1 0 2.7l-1-.7a1.4 1.4 0 0 0 0-1.3l1-.7Zm1.55-1.7a4.5 4.5 0 0 1 0 6.1l-1-.75a3.3 3.3 0 0 0 0-4.6l1-.75Z"/></svg>
</button>`;
    return `<figure class="project-figure project-figure--video project-figure--autoplay${stageClass}${naturalClass}"${aspectAttr}>
${bg}
<video src="${safeSrc}" muted loop playsinline webkit-playsinline disablepictureinpicture preload="metadata" aria-label="${safeLabel}"></video>
${button}
</figure>`;
  });

  eleventy.addShortcode('projectAppStoreTicker', (background, ...cardSrcs) => {
    const bgSrc = String(background || '').replace(/"/g, '');
    const cards = cardSrcs
      .map((src) => String(src || '').trim())
      .filter(Boolean)
      .map((src, index) => {
        const safe = src.replace(/"/g, '');
        return `<li class="appstore-ticker__item"><img src="${safe}" alt="App Store card ${index + 1}" draggable="false" decoding="async"></li>`;
      })
      .join('');
    if (!bgSrc || !cards) return '';
    return `<figure class="project-figure project-figure--appstore-ticker" data-appstore-ticker>
<img class="project-figure__bg" src="${bgSrc}" alt="" decoding="async" aria-hidden="true">
<div class="appstore-ticker" aria-label="App Store cards">
<div class="appstore-ticker__viewport">
<div class="appstore-ticker__track" data-appstore-track>
<ul class="appstore-ticker__list">${cards}</ul>
</div>
</div>
</div>
</figure>`;
  });

  eleventy.addShortcode('projectPhoneStage', (background, ...srcs) => {
    const bgSrc = String(background || '').trim().replace(/"/g, '');
    const frameSrc = '/media/baton-branding/iphone-frame.png';
    const flags = new Set();
    const mediaSrcs = [];
    for (const raw of srcs) {
      const value = String(raw || '').trim();
      if (!value) continue;
      if (/^(before-after|soft-clip)$/i.test(value)) {
        flags.add(value.toLowerCase());
        continue;
      }
      mediaSrcs.push(value);
    }
    const showLabels = flags.has('before-after');
    const softClip = flags.has('soft-clip');
    const labels = ['Before', 'After'];
    const phones = mediaSrcs
      .map((src, index) => {
        const safe = src.replace(/"/g, '');
        const isVideo = /\.(webm|mp4|mov)(\?|#|$)/i.test(safe);
        const label = showLabels ? (labels[index] || '') : '';
        const labelClass = label
          ? ` project-phone__label--${label.toLowerCase()}`
          : '';
        const labelHtml = label
          ? `<span class="project-phone__label${labelClass}">${label}</span>`
          : '';
        const alt = label || (isVideo ? 'iPhone screen recording' : `iPhone screen ${index + 1}`);
        // Studio empty-state only: hide awkward top of screen recording
        const curtain = isVideo && mediaSrcs.length === 1
          ? `<span class="project-phone__screen-curtain" aria-hidden="true"></span>`
          : '';
        const screen = isVideo
          ? `<video class="project-phone__screen project-phone__screen--video" src="${safe}" muted loop playsinline webkit-playsinline disablepictureinpicture preload="metadata" aria-label="${alt}"></video>
${curtain}`
          : `<img class="project-phone__screen" src="${safe}" alt="${alt}" decoding="async" loading="lazy">`;
        return `<div class="project-phone">
<div class="project-phone__device">
<div class="project-phone__screen-wrap">
${screen}
</div>
<img class="project-phone__chrome" src="${frameSrc}" alt="" decoding="async" aria-hidden="true">
</div>
${labelHtml}
</div>`;
      })
      .join('');
    if (!phones) return '';
    const bg = bgSrc
      ? `<img class="project-figure__bg" src="${bgSrc}" alt="" decoding="async" aria-hidden="true">`
      : '';
    const bgClass = bgSrc ? ' project-figure--phones-bg' : '';
    const singleClass = mediaSrcs.length === 1 ? ' project-figure--phones-single' : '';
    const softClass = softClip ? ' project-figure--phones-soft' : '';
    const hasVideo = mediaSrcs.some((src) => /\.(webm|mp4|mov)(\?|#|$)/i.test(src));
    const videoClass = hasVideo ? ' project-figure--phones-video' : '';
    return `<figure class="project-figure project-figure--phones${bgClass}${singleClass}${softClass}${videoClass}" aria-label="iPhone screens">
${bg}
<div class="project-phones">${phones}</div>
</figure>`;
  });

  eleventy.addShortcode('projectCover', (src, alt = '', slug = '', variant = 'hero') => {
    const safeSrc = src ? String(src) : '';
    const isVideo = /\.(webm|mp4|mov)(\?|#|$)/i.test(safeSrc);

    const overlay = safeSrc
      ? isVideo
        ? `<div class="project-cover__overlay"><video class="project-cover__overlay-media" src="${safeSrc}" muted autoplay loop playsinline webkit-playsinline disablepictureinpicture preload="auto" aria-label="${alt || ''}"></video></div>`
        : `<div class="project-cover__overlay"><img class="project-cover__overlay-media" src="${safeSrc}" alt="${alt}" loading="eager"></div>`
      : '';

    if (slug) {
      const safeSlug = String(slug).replace(/"/g, '');
      return `<div class="project-cover project-cover--gray" data-archived-gradient="${safeSlug}">${overlay}</div>`;
    }
    if (!safeSrc) {
      return `<div class="project-cover" aria-hidden="true"><span>Project media</span></div>`;
    }
    if (isVideo) {
      return `<div class="project-cover project-cover--video media-skeleton media-skeleton--fill"><video class="media-skeleton__media" src="${safeSrc}" muted autoplay loop playsinline webkit-playsinline disablepictureinpicture preload="auto" aria-label="${alt || ''}"></video></div>`;
    }
    return `<div class="project-cover media-skeleton media-skeleton--fill"><img class="media-skeleton__media" src="${safeSrc}" alt="${alt}" loading="eager"></div>`;
  });

  eleventy.addShortcode('projectEmbed', (name) => {
    const embedPath = path.join('_includes', 'embeds', `${name}.njk`);
    if (!fs.existsSync(embedPath)) {
      return `<!-- missing embed: ${name} -->`;
    }

    const html = fs.readFileSync(embedPath, 'utf8').trim();
    const cssPath = path.join('embeds', `${name}.css`);
    const jsPath = path.join('embeds', `${name}.js`);
    const cssTag = fs.existsSync(cssPath)
      ? `<link rel="stylesheet" href="/embeds/${name}.css">`
      : '';
    const jsTag = fs.existsSync(jsPath)
      ? `<script src="/embeds/${name}.js" defer></script>`
      : '';

    // Unwrap the file's outer project-embed so we own a single hoistable shell.
    // Strip blank lines so markdown-it won't break the HTML block.
    const inner = html
      .replace(/^<div class="project-embed"[^>]*>\s*/i, '')
      .replace(/\s*<\/div>\s*$/i, '')
      .replace(/\n\s*\n/g, '\n');

    return `<div class="project-embed" data-project-embed="${name}">
${cssTag}
${inner}
${jsTag}
</div>`.replace(/\n\s*\n/g, '\n');
  });

  return {
    dir: {
      input: '.',
      output: '_site',
      includes: '_includes',
      data: '_data',
    },
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  };
};
