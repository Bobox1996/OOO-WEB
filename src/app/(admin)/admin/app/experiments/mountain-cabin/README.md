# Mountain Cabin

A small place in a vast world.

This full-screen experiment runs at `/admin/app/experiments/mountain-cabin` and appears automatically in the Admin → APP catalog. It retains the site's existing admin authentication. The OUT OF OFFICE wordmark returns to the catalog; photography mode hides all interface elements.

The client entry dynamically loads a Three.js WebGPURenderer scene. Independent systems manage deterministic terrain, snow materials, atmospheric depth, layered valley clouds, weather, vegetation, architecture, cameras, lighting and procedural audio. One world unit is one metre; the refuge site represents 3,086 m elevation. All scene assets are generated locally.

Use the bottom camera dock, drag/scroll to orbit, or WASD and drag in Explore. `P` hides the interface; `Esc` or a double tap restores it. Environment settings include lighting presets, weather, wind, snow, clouds, visibility, exposure, field of view and four quality presets. Capture Image exports only the rendered canvas. Audio is opt-in.

This integration uses the website's Three.js 0.183 dependency. Its RenderPipeline and TSL types replace the standalone prototype's 0.180 equivalents. SkyMesh's own clouds are disabled so the pausable CloudSystem remains authoritative. No site dependency changes are required.

The first release is an environment prototype: clouds and snow scattering are efficient approximations, outdoor collision is limited to the ridge and building footprint, and the modular cabin is ready for future configuration UI. It does not yet include a full architectural editor, GI, SSAO or cascaded shadows. Frame rates depend on hardware; resolution adapts automatically.
