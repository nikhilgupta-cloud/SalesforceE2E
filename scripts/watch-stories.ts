/**
 * watch-stories.ts — Auto-regenerate tests when user stories change
 *
 * Watches prompts/user-stories/ for file changes.
 * When a .md story file is saved, automatically:
 *   • Detects whether the story is new or updated (via MD5 hash)
 *   • Calls Claude Code CLI to regenerate scenarios and test code
 *   • Writes updated blocks into the relevant spec file
 *
 * No ANTHROPIC_API_KEY required — uses Claude Code CLI auth.
 *
 * Usage:  npm run watch:stories
 *         (keep this running in a terminal while editing user stories)
 */
import * as fs   from 'fs';
import * as path from 'path';
import { generateTestsFromUserStories } from './generate-tests';

// Directories to watch — both single-story and multi-story layouts are supported
const WATCH_DIRS: Array<{ dir: string; label: string }> = [
  { dir: path.join('prompts', 'user-stories'), label: 'prompts/user-stories/' },
  { dir: 'user-stories',                       label: 'user-stories/' },
];

const existing = WATCH_DIRS.filter(d => fs.existsSync(d.dir));
if (existing.length === 0) {
  console.error('[watch] No story directories found (checked prompts/user-stories/ and user-stories/)');
  process.exit(1);
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function onStoryChange(dirLabel: string, filename: string | null) {
  // Only react to non-template .md files
  if (!filename || !filename.endsWith('.md') || filename.startsWith('_')) return;

  // Debounce: editors often fire multiple events per save; wait 1.5s for them to settle
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    console.log(`\n[watch] Story changed: ${dirLabel}${filename}`);
    console.log('[watch] Running test generation — this may take a moment…');

    try {
      const result = await generateTestsFromUserStories();

      if (result.notice) {
        console.log(`[watch]   ${result.notice}`);
      } else if (result.added === 0 && result.updated === 0) {
        console.log(`[watch]   No changes detected (story may be unchanged or unparseable)`);
      } else {
        const parts: string[] = [];
        if (result.added)   parts.push(`${result.added} new`);
        if (result.updated) parts.push(`${result.updated} updated`);
        if (result.skipped) parts.push(`${result.skipped} skipped`);
        console.log(`[watch]   Done — ${parts.join(' · ')}`);
      }
    } catch (err: any) {
      console.error('[watch]   Generation error:', err.message);
    }

    console.log('[watch] Watching for next change…');
  }, 1500);
}

for (const { dir, label } of existing) {
  console.log(`[watch] Watching ${label}`);
  fs.watch(dir, { persistent: true }, (_event, filename) => {
    onStoryChange(label, filename);
  });
}
console.log('[watch] Edit any .md file in the above directories to trigger generation');
console.log('[watch] Press Ctrl+C to stop\n');
