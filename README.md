# andycabindol.com

Static portfolio site built with [Eleventy](https://www.11ty.dev/).

## Commands

```bash
npm install
npm run migrate:projects   # optional: regenerate projects/*.md from scripts/migrate-projects.mjs
npm run dev                # local preview at http://localhost:8080
npm run build              # output to _site/
```

## Adding a project

1. Copy `projects/_template.md` to `projects/your-slug.md`
2. Fill in front matter (`title`, `cover`, `facts`, `summary`, `cardLayout`)
3. Add the slug to `_data/projectOrder.json` (top = first on the work page)
4. Write sections as **picture → title → description**

### Reordering projects

Edit `_data/projectOrder.json` — move slugs up/down. That’s the only file you need to touch:

```json
[
  "chirper",
  "lens-usage",
  "ai-mode"
]
```

### Project sections

Put media first, then the description. Order is always **picture → title → description**.

```njk
{# Single full-width image above the title #}
{% projectSection "Challenge", "/media/slug/challenge.jpg", "Alt text" %}
Your description goes here.
{% endprojectSection %}

{# Or put a grid / interactive embed first — it moves above the title #}
{% projectSection "Contribution" %}
{% projectEmbed "chirper/trimmer-demo" %}

Your description goes here.
{% endprojectSection %}
```

### Interactive UI embeds

For hover states and real interaction (not a flat image):

```njk
{% projectEmbed "chirper/trimmer-demo" %}
```

That loads:

- `_includes/embeds/chirper/trimmer-demo.njk` — markup
- `embeds/chirper/trimmer-demo.css` — styles
- `embeds/chirper/trimmer-demo.js` — behavior

You can still use images anytime:

```njk
{% projectImage "/media/slug/hero.jpg", "Alt" %}
{% projectGrid 2 %} ... {% endprojectGrid %}
```

Put image assets in `media/<slug>/`.

### Front matter extras

- `cover` — hero image on the project page
- `summary` — short line under the title on the **work grid** (not the project hero)
- `facts` — optional label/value pairs under the project title

### Card layout options

`wide`, `tall`, `square`, `portrait`, or `default`

## Deploy

GitHub Actions builds `_site/` and deploys to GitHub Pages on push to `main`.
