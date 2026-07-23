---
title: Your project title
summary: Short line under the title on the work grid.
facts:
  - label: Year
    value: "2025"
projectTags: UX Design · Motion Design
cardLayout: wide
cover: /media/your-project-slug/cover.jpg
---

{# Each section: picture(s) first, then title, then description #}
{% projectSection "Challenge", "/media/your-project-slug/challenge.jpg", "Challenge visual" %}
What problem were you solving?
{% endprojectSection %}

{% projectSection "Contribution" %}
{% projectGrid 2 %}
{% projectImage "/media/your-project-slug/a.jpg", "A" %}
{% projectImage "/media/your-project-slug/b.jpg", "B" %}
{% endprojectGrid %}

What did you do?
{% endprojectSection %}

{% projectSection "Outcome" %}
What changed? (image optional — omit media if you don't need one)
{% endprojectSection %}
