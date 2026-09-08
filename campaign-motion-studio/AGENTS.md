# Working on Campaign Motion Studio

Preserve the offline single-file workflow. End users open index.html directly, replace local images, edit layers, save portable projects, and export silent vertical video. Do not add a mandatory server, account, framework, network font, or CDN.

Read README.md and docs/CAMPAIGN-WORKFLOW.md before changing the workflow. src/engine.js owns deterministic layout and animation. src/editor.js owns UI, local assets, persistence, and export. Keep the preview and all exporters on the same engine.

Keep all ordinary campaign copy editable. Images that contain composited lettering should be named and documented as whole graphics. Never claim a single image has editable internal parts or that 2D product images are 3D models.

Preserve user changes to example assets and campaign configurations. Build index.html with node scripts/build.cjs after source changes. Run npm test and inspect a representative render for changes that affect layout, import/export, timing, or layer behavior.

Do not include signed asset URLs, credentials, temporary download metadata, node_modules, or generated test videos in commits. Assets provided for this campaign stay in assets/realme-99; new campaigns should have their own folder.

Use the file prompts in docs/GPT-ASSET-PROMPTS.md when preparing new image sets. Update documentation alongside changes to the project format or controls.
