# Out Of Office experiment template

Build a studio tool locally, then publish it at `/admin/app/experiments/<your-app>` inside the Out Of Office website. Grid Study is a working example. The template uses React, TypeScript, CSS Modules and Next.js.

## Run locally

Use Node.js 20.9 or newer. Unzip the download into a development folder and run these commands alongside `package.json`:

```sh
npm ci
npm run dev
```

Open the local URL printed by Next.js. The example runs without credentials. Edit `page.tsx`, `study.module.css` and `experiment.json`. Use relative imports for your components and assets. The `_preview` directory provides the standalone development shell. Run `npm run build` to compile and type-check your app.

A starting prompt for Codex:

> Build an Out Of Office experiment that [describe the tool]. Read AGENTS.md and README.md, replace the grid example, keep the layout usable on mobile, update experiment.json and verify the production build.

## Publish to the studio

1. In GitHub Desktop, clone or open [Bobox1996/OOO-WEB](https://github.com/Bobox1996/OOO-WEB). Fetch and pull the latest changes on `main`.
2. Under `src/app/(admin)/admin/app/experiments/`, create a unique folder such as `courtyard-study`. Use lowercase letters, digits and single hyphens. This folder sets the app URL.
3. Copy `page.tsx`, `experiment.json`, the CSS module and any imported components or assets into the folder. Keep the preview shell, its package files, node_modules and .next in your local development folder. If you added npm libraries, install the same libraries at the website root and include the website package.json and lockfile in the commit.
4. Set the title, description, author and version in `experiment.json`. Run `npm run build` at the website root. Commit the app files and push to `main` in GitHub Desktop.
5. Once the website’s Vercel deployment is Ready, open **Admin → APP**. Your app is listed automatically with its own launch URL and GitHub source link. To release an update, replace the files in the same folder, update the version and push again.

## OOO data

The example runs with local state. When your app needs OOO data, import `getOooSupabase` from `./ooo` in a client component. It uses the website's Supabase configuration and the current browser session. For example, given a bucket and object path approved for the app:

```ts
const { data, error } = await getOooSupabase().storage.from(bucket).download(objectPath)
```

For standalone development, place the OOO project URL and its public anon key in `_preview/.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then restart the preview. The local preview has its own browser session. Test member-only access through the authenticated website checkout. Data and Storage operations follow the OOO project's Supabase policies. Keep service-role credentials on the server.

`getOooJson<T>(path)`, also exported by `./ooo`, reads an existing website-relative `/api/...` endpoint using the viewer's session. Use a local fixture until the corresponding OOO API exists. Implement new API handlers on the website with server-side member authorization.
