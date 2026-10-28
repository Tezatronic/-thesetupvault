// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import rehypeInlineChecklist from './src/plugins/rehype-inline-checklist.mjs';

const SITE = 'https://thesetupvault.vercel.app';

// Mark every Amazon link as a sponsored (affiliate) link at build time.
function rehypeSponsoredAmazonLinks() {
	const isAmazon = (href) =>
		/^https?:\/\/(?:[\w-]+\.)*(?:amazon\.com|amzn\.to)(?:[/?#]|$)/i.test(href);
	const walk = (node) => {
		if (node.type === 'element' && node.tagName === 'a' && typeof node.properties?.href === 'string' && isAmazon(node.properties.href)) {
			node.properties.rel = ['sponsored', 'noopener'];
		}
		node.children?.forEach(walk);
	};
	return (tree) => walk(tree);
}

// lastmod per guide from its frontmatter (updatedDate, else pubDate).
const lastmodByUrl = new Map();
const blogDir = path.resolve('./src/content/blog');
if (fs.existsSync(blogDir)) {
	for (const file of fs.readdirSync(blogDir)) {
		if (!/\.(md|mdx)$/.test(file)) continue;
		const head = fs.readFileSync(path.join(blogDir, file), 'utf8').split(/^---\s*$/m)[1] ?? '';
		const grab = (key) => head.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm'))?.[1];
		const d = new Date(grab('updatedDate') ?? grab('pubDate') ?? '');
		if (!Number.isNaN(d.valueOf())) {
			lastmodByUrl.set(`${SITE}/blog/${file.replace(/\.(md|mdx)$/, '')}/`, d.toISOString());
		}
	}
}

// https://astro.build/config
export default defineConfig({
	site: SITE,
	markdown: { rehypePlugins: [rehypeSponsoredAmazonLinks, rehypeInlineChecklist] },
	integrations: [
		mdx(),
		sitemap({
			// /go/ pages are tracked redirects to Whop, not content.
			filter: (page) => !page.includes('/go/'),
			serialize(item) {
				const lastmod = lastmodByUrl.get(item.url);
				if (lastmod) item.lastmod = lastmod;
				return item;
			},
		}),
	],
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
