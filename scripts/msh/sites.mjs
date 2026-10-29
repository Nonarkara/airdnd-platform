/**
 * Site profiles for the MSH instruments.
 *
 * The instruments (the line ruler, the hole probe, the route sweep, the
 * chrome/task audit) were written for one³. The law is the same for every
 * site in this repository, so the instruments are too; only three things
 * differ per site, and they live here:
 *
 *   identity  the title prefix the page must carry before anything is
 *             measured (a probe that measures the wrong page and reports
 *             "clean" is worse than no probe)
 *   routes    [name, path] — every view the site serves
 *   tasks     [name, path, task] — the job a reader comes to each view to do,
 *             used by the first-screen audit
 *
 * Pick one with MSH_SITE=sabai (default: otop, so every existing command and
 * receipt keeps working unchanged).
 */

import { ROUTES } from '../otop/routes.mjs';

/**
 * one³'s views, as the instruments need them.
 *
 * The register lives in scripts/otop/routes.mjs and reads the paths from the
 * APPLICATION's own route table — so it cannot fall behind the site. It used
 * to be null here, with the comment "the instruments' own one³ lists stay
 * canonical", which was true for as long as every instrument kept its own
 * list. There were five of them, and each was correct on the day it was
 * written and wrong the next time a view was added: the spatial snapshot
 * knew about six views, the MSH audit about fourteen, the route sweep about
 * fifteen, and the hole probe about seven. The Critic view shipped with no
 * receipt at all.
 *
 * So the list is not "the instruments' own" any more. There is ONE list,
 * and this is it.
 */
const OTOP_ROUTES = ROUTES.map((r) => [r.name, r.path + (r.query || '')]);
const OTOP_TASKS = ROUTES.map((r) => [r.name, r.path + (r.query || ''), r.task]);

export const SITES = {
  otop: {
    identity: 'one³',
    routes: OTOP_ROUTES,
    tasks: OTOP_TASKS,
  },
  sabai: {
    identity: 'Sabai Sabai',
    routes: [
      ['inventory', '/'],
      ['live', '/?view=feed'],
      ['map', '/map'],
      ['places', '/places'],
      ['health', '/health'],
      ['insights', '/insights'],
      ['analytics', '/analytics'],
      ['method', '/methodology'],
      ['faq', '/faq'],
      ['paper', '/paper'],
      ['sociology', '/sociology'],
      ['public-works', '/public-works'],
      ['matching', '/matching'],
    ],
    tasks: [
      ['inventory', '/', 'find a parlour near me and call it'],
      ['map', '/map', 'see where the parlours are, and how sure that is'],
      ['live', '/?view=feed', 'see what was just posted'],
      ['health', '/health', 'plan an outreach visit'],
      ['analytics', '/analytics', 'read the industry in numbers'],
      ['places', '/places', "look through one venue's photos"],
    ],
  },
};

export function activeSite() {
  const key = (process.env.MSH_SITE || 'otop').toLowerCase();
  const site = SITES[key];
  if (!site) throw new Error(`MSH_SITE=${key} is not a known site (${Object.keys(SITES).join(', ')})`);
  return { key, ...site };
}
