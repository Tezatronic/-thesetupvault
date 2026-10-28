// Safety net: the writer must not publish Amazon links (Associates account is closed).
// 1) A line that is only a "[Check current price](amazon link)" style CTA is deleted.
// 2) Any other markdown link to Amazon is turned back into plain text.
const AMAZON = String.raw`https?:\/\/(?:[a-z0-9-]+\.)*(?:amazon\.[a-z.]+|amzn\.to|a\.co)[^)\s]*`;

export function stripRetailLinks(markdown) {
  const removed = [];
  const lineOnly = new RegExp(String.raw`^[ \t]*\[[^\]]*\]\(${AMAZON}\)[ \t]*\r?\n?`, 'gim');
  let out = markdown.replace(lineOnly, m => { removed.push(m.trim()); return ''; });
  const inline = new RegExp(String.raw`\[([^\]]+)\]\(${AMAZON}\)`, 'gi');
  out = out.replace(inline, (m, text) => { removed.push(m); return text; });
  return { markdown: out.replace(/\n{3,}/g, '\n\n'), removed };
}
