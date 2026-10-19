// Topic hubs: guides are grouped by topic, judged from their slug, so new
// pipeline posts are classified automatically with no frontmatter changes.

export interface Topic {
	key: string;
	label: string;
	title: string; // page <title> stem
	intro: string;
}

export const TOPICS: Topic[] = [
	{
		key: 'cable-management',
		label: 'Cable management',
		title: 'Cable Management Guides',
		intro:
			'Guides to taming desk cables: ties and straps, routing on standing desks, labeling, and quick-release setups.',
	},
	{
		key: 'laptop-stands',
		label: 'Laptop stands',
		title: 'Laptop Stand Guides',
		intro:
			'Guides to choosing and setting up a laptop stand, from travel stands to matching your laptop screen to an external monitor.',
	},
	{
		key: 'monitor-stands',
		label: 'Monitor stands',
		title: 'Monitor Stand Guides',
		intro:
			'Guides to monitor stands and monitor arms, and how monitor height affects posture and desk space.',
	},
	{
		key: 'desk-lamps',
		label: 'Desk lamps',
		title: 'Desk Lamp Guides',
		intro:
			'Guides to desk lighting: choosing an LED lamp, placing it for posture and glare, and lighting video calls.',
	},
	{
		key: 'desk-pads',
		label: 'Desk pads',
		title: 'Desk Pad Guides',
		intro:
			'Guides to desk pads and mats: sizing, materials, wrist comfort, and keeping them clean.',
	},
	{
		key: 'desk-organizers',
		label: 'Desk organizers',
		title: 'Desk Organizer Guides',
		intro:
			'Guides to desk organizers, paper trays and drawers, and setting them up for a clutter-free desk.',
	},
	{
		key: 'usb-hubs',
		label: 'USB hubs',
		title: 'USB Hub Guides',
		intro:
			'Guides to USB hubs: how many ports you need, powered and USB-C hubs, materials, and fixing common problems.',
	},
	{
		key: 'webcams',
		label: 'Webcams',
		title: 'Webcam Guides',
		intro:
			'Guides to webcams for video calls: choosing one, field of view, low light, and camera height and placement.',
	},
	{
		key: 'keyboards-and-mice',
		label: 'Keyboards and mice',
		title: 'Keyboard and Mouse Guides',
		intro:
			'Guides to wireless keyboards and mice for the office: combos, switch types, and sharing one set between two computers.',
	},
	{
		key: 'wireless-charging',
		label: 'Wireless charging',
		title: 'Wireless Charging Guides',
		intro:
			'Guides to wireless charging pads, stands and charging mouse pads for the desk.',
	},
	{
		key: 'desk-fans',
		label: 'Desk fans',
		title: 'Desk Fan Guides',
		intro:
			'Guides to USB desk fans: choosing one, noise on calls, positioning, and using a fan to cool a laptop.',
	},
	{
		key: 'setup-basics',
		label: 'Desk setup basics',
		title: 'Desk Setup Basics',
		intro: 'General desk setup guides that do not fit a single product category.',
	},
];

const RULES: [RegExp, string][] = [
	[/webcam/, 'webcams'],
	[/wireless-charg|charging-pad/, 'wireless-charging'],
	[/desk-fan|usb-fan/, 'desk-fans'],
	[/lamp/, 'desk-lamps'],
	[/usb-hub|usb-c-hub|usb-ports/, 'usb-hubs'],
	[/keyboard|mouse-combo/, 'keyboards-and-mice'],
	[/cable|cord/, 'cable-management'],
	[/laptop-stand|align-your-laptop|riser/, 'laptop-stands'],
	[/monitor-stand|monitor-arm|wali/, 'monitor-stands'],
	[/desk-pad|desk-mat|pu-leather/, 'desk-pads'],
	[/organizer|tray/, 'desk-organizers'],
];

export function topicKeyForSlug(slug: string): string {
	for (const [re, key] of RULES) if (re.test(slug)) return key;
	return 'setup-basics';
}

export function topicByKey(key: string): Topic {
	return TOPICS.find((t) => t.key === key) ?? TOPICS[TOPICS.length - 1];
}

const STOP = new Set(
	'a an the of for to and or in on with your you is are how what which vs best guide practical buying home office desk setup setups worth right'.split(
		' ',
	),
);
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => !STOP.has(w)) ?? []);

interface PostLike {
	id: string;
	data: { title: string; pubDate: Date };
}

// Four related guides: same topic first, then closest title overlap, then newest.
export function relatedFor<T extends PostLike>(post: T, all: T[], n = 4): T[] {
	const myTopic = topicKeyForSlug(post.id);
	const mine = words(post.data.title);
	return all
		.filter((p) => p.id !== post.id)
		.map((p) => {
			const theirs = words(p.data.title);
			const shared = [...mine].filter((w) => theirs.has(w)).length;
			const score = (topicKeyForSlug(p.id) === myTopic ? 100 : 0) + shared;
			return { p, score };
		})
		.sort((a, b) => b.score - a.score || b.p.data.pubDate.valueOf() - a.p.data.pubDate.valueOf())
		.slice(0, n)
		.map((x) => x.p);
}
