// Places the free-checklist signup (Omnisend embedded form) inside the article body,
// roughly a third of the way down, so readers meet it while reading, not after.
// The Omnisend snippet fills the placeholder div by its id, and that id can only
// appear once per page, so this inserts exactly one.
const FORM_ID = 'omnisend-embedded-v2-6aafbc1ca6a711b3326c1ddd';

export default function rehypeInlineChecklist() {
	return (tree) => {
		const kids = tree.children;
		const slot = {
			type: 'element',
			tagName: 'div',
			properties: { id: FORM_ID, className: ['checklist-capture-slot'] },
			children: [],
		};
		const h2 = kids.map((n, i) => (n.type === 'element' && n.tagName === 'h2' ? i : -1)).filter((i) => i >= 0);
		let at = kids.length; // fallback: end of the article body
		if (h2.length >= 3) {
			at = h2[2]; // before the third section heading
		} else {
			// posts without section headings: after the 4th paragraph
			const ps = kids.map((n, i) => (n.type === 'element' && n.tagName === 'p' ? i : -1)).filter((i) => i >= 0);
			if (ps.length >= 5) at = ps[3] + 1;
		}
		kids.splice(at, 0, slot);
	};
}
