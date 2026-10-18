import DeskGuideCover from '../assets/product-cover-desk-setup-guide.png';
import PlannerCover from '../assets/product-cover-desk-setup-planner.png';

// Single source of truth for the two owned products (used by /products and the home page).
export const PRODUCTS = [
	{
		id: 'cable-guide',
		title: 'The Ultimate Desk Setup & Cable Management Guide',
		shortTitle: 'Cable Management Guide',
		description:
			"A short, practical PDF guide for getting your cables under control. It walks you through picking the setup profile that matches your desk — Minimalist, Dual-Screen Standard, Power User, or Hybrid Worker — then gives you that profile's cable-routing plan and checklist.",
		outcome: 'Pick your setup profile and follow its cable-routing plan and checklist.',
		audience: 'Best for: fixing cable clutter on the desk you already have.',
		price: '$10',
		originalPrice: '$12.50',
		url: '/go/cable-guide/',
		cover: DeskGuideCover,
	},
	{
		id: 'desk-planner',
		title: 'The Complete Desk Setup Planner',
		shortTitle: 'Desk Setup Planner',
		description:
			"A 34-page planning workbook for figuring out your whole workspace before you buy anything else. Diagnose what's not working, measure your space, plan monitor and cable placement, organize what you already have, and work out what's actually worth upgrading first.",
		outcome: 'Plan your whole workspace and decide what is worth upgrading before you buy.',
		audience: 'Best for: planning or reworking your whole workspace before you spend another dollar.',
		price: '$19',
		originalPrice: undefined as string | undefined,
		url: '/go/desk-planner/',
		cover: PlannerCover,
	},
];

// Which owned product fits a guide, judged from its slug. Accessory topics
// (USB hubs, webcams, fans, keyboards, chargers) deliberately get none —
// matches the existing scripts/product-ctas.json mapping.
export function productForSlug(slug: string) {
	if (/usb|webcam|fan|keyboard|mouse|charg/.test(slug)) return undefined;
	if (/cable|cord/.test(slug)) return PRODUCTS[0];
	if (/lamp|monitor|laptop|stand|organizer|tray|drawer|desk-pad|desk-mat|pad/.test(slug)) return PRODUCTS[1];
	return undefined;
}
