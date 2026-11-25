This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Sumiyoshi Street local preview

Open `OOO-Sumiyoshi-Pixelscape.html` beside the repository in Chrome or Edge to play the portable build. It includes the Blender scenes, project covers, member portraits and studio content.

For live editing, double-click `Preview-Sumiyoshi.cmd` or run `npm run preview:sumiyoshi`. The development site opens at [127.0.0.1:3021/sumiyoshi](http://127.0.0.1:3021/sumiyoshi). Run `npm run package:sumiyoshi` to rebuild the portable file from this checkout.

## Homepage A/B comparison

The homepage randomly sends each new browser to the existing project index at `/works` or the interactive sea lounge at `/sumiyoshi`, with a 50% chance for each. It remembers the assignment for 180 days in the first-party `ooo_home_v1` cookie. Both paths also open directly for side-by-side review. The entry redirect preserves campaign parameters, and each page has its own path in Vercel Web Analytics.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Out Of Office Design uses Vercel’s GitHub integration. The `main` branch of [Bobox1996/OOO-WEB](https://github.com/Bobox1996/OOO-WEB) supplies the existing Vercel project `ooo-web`. Its build root is the repository root, the directory containing `package.json`.

1. In GitHub Desktop, use **File → Add local repository** to select `C:\OOO\OOO WEB\portfolio` the first time. Select the `main` branch.
2. For a change already committed by Codex, find the commit in **History** and click **Push origin**. For edits you make yourself, first select the intended files, enter a summary, and click **Commit to main**.
3. Open [Vercel Deployments](https://vercel.com/ooos-projects-f7dc45af/ooo-web/deployments) and find the production deployment with the same commit. Once it is **Ready** and assigned to the production domain, refresh the [live site](https://ooo-web.vercel.app).

If the push creates no deployment, check the connected repository under **Settings → Git**. If it creates only a preview or requires manual promotion, check **Settings → Environments → Production → Branch Tracking**. Select `main` and enable automatic assignment of production domains. If a build fails, open the build log for that commit.

This workflow publishes the Next.js application. Project media stays in Supabase Storage. Apply any required Supabase database migrations separately.

## Studio experiments

Open **Admin → APP** to launch member-built tools or download the OOO experiment template. The ZIP contains the Grid Study source, a standalone Next.js preview, a dependency lockfile and instructions for Codex.

Each published app lives under `src/app/(admin)/admin/app/experiments/<slug>/`. Its `page.tsx` defines the route and `experiment.json` supplies the catalog title, author, description and version. Use the existing Grid Study folder as a reference. Pushing a new app or an update to the website's `main` branch publishes it through the same Vercel deployment. The existing Supabase admin membership check covers the catalog, downloads and app pages.
