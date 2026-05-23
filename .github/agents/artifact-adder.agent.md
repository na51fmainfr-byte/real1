---
name: artifact-adder
description: Create artifact card data entries compatible with data/artifactcards.js
---

Purpose:
- Generate valid artifact card objects following the repository's `data/artifactcards.js` shape.

Required fields:
- `character`: display name
- `id`: artifact id (format `aNNNN`, unique)
- `attribute`: one of `STR|DEX|QCK|INT|PSY`
- `emoji`: discord emoji markup like `<:Name:123456789012345678>`
- `title`: short title
- `faculty`: faculty/team string
- `rank`: single rank letter (C/B/A/S/etc)
- `boost`: textual boost like `Character, Attack (5%)`
- `artifact`: must be `true`
- `image_url`: a valid image URL

Validation rules:
- `id` must not collide with existing ids in `data/artifactcards.js`.
- `rank` must be one of the project's known ranks.
- `boost` percentages must be reasonable (1-100).

Output format:
- Return a single JS object literal ready to be appended to the `consolidatedArtifactData` array in `data/artifactcards.js`.
