/* THE SPATIAL PROBE — the measuring instrument of the spatial law.
 *
 * It runs inside a page and measures GEOMETRY. Every number it returns is a
 * fact about what a browser actually rendered: a rect, a computed style, a
 * scroll width, a character count. It never decides whether a fact is a
 * defect. That decision belongs to the project's own policy and baseline,
 * which live on the Node side (spatial-check.mjs). That split is deliberate:
 * this file is identical in every project, so a measurement taken in one
 * project means exactly what it means in another.
 *
 * The six modes of spatial hallucination, and where each one is measured:
 *
 *   1. unjustified gaps     — a hole between two stacked siblings, or dead
 *                              space under a short cell in a row
 *   2. orphan elements      — a short cell holding a picture, stranded beside
 *                              the tall column next to it
 *   3. scattered actions    — two loud controls in one container, pushed to
 *                              opposite edges
 *   4. false hierarchy      — the title's weight against the page, and how
 *                              much of the page is set in the loud voice
 *   5. accidental wrapping  — a row that breaks and leaves one orphan on the
 *                              last row, a clipped row, or a page that scrolls
 *                              sideways
 *   6. spatially expensive  — how far down the page the first thing you can
 *                              actually DO is
 *
 * The probe is injected into the page under test, so it must not assume
 * anything about the host: no global `window` (the document and its window
 * are passed in), no theme assumption (loudness is measured as contrast
 * against whatever is behind the element, so it works in light and dark), no
 * class names (findings are reported by tag and class so a human can find
 * them, never matched by them).
 */
(function () {
  "use strict";

  // A hole of dead space must be at least this tall to be a hole. A 24px gap
  // between two paragraphs is reading; a 200px gap is somebody's grid.
  var DEAD = 72;
  // A cell filling less than this fraction of its row band is "stranded".
  var SHORT = 0.5;
  // Two loud controls further apart than this fraction of their container
  // are "scattered".
  var EDGE = 0.55;
  // Colour distance at which a surface counts as loud against its backdrop.
  var CONTRAST = 60;

  function sel(el) {
    if (!el) return "?";
    var tag = el.tagName ? el.tagName.toLowerCase() : "?";
    if (el.id) return tag + "#" + el.id;
    var cls = String(el.className || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (cls.length) return tag + "." + cls.join(".");
    return tag;
  }

  function parseColor(c) {
    if (!c) return null;
    var m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1]
      .split(/[,\s/]+/)
      .filter(Boolean)
      .map(Number);
    if (p.length < 3 || p.some(isNaN)) return null;
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }

  function dist(a, b) {
    var dr = a[0] - b[0];
    var dg = a[1] - b[1];
    var db = a[2] - b[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function visible(el, win) {
    var cs = win.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (Number(cs.opacity) < 0.15) return false;
    var r = el.getBoundingClientRect();
    return !!(r.width && r.height);
  }

  function kids(el, win) {
    var out = [];
    for (var i = 0; i < el.children.length; i++) {
      if (visible(el.children[i], win)) out.push(el.children[i]);
    }
    return out;
  }

  /** The nearest opaque background behind an element. */
  function backdrop(el, win) {
    var e = el.parentElement;
    while (e) {
      var cs = win.getComputedStyle(e);
      var c = parseColor(cs.backgroundColor);
      if (c && c[3] > 0.5) return c;
      e = e.parentElement;
    }
    return [255, 255, 255, 1];
  }

  /**
   * A LOUD control: one that carries its own weight on the page.
   *
   * Loudness is measured as contrast against the surface behind it, never as
   * an absolute colour. A theme that paints its accent dark and a theme that
   * paints it light are both allowed to have one loud control; what neither
   * may have is thirty controls that all shout at once.
   */
  function loudControl(el, win) {
    var cs = win.getComputedStyle(el);
    var own = parseColor(cs.backgroundColor);
    if (own && own[3] > 0.5 && dist(own, backdrop(el, win)) > CONTRAST) return true;
    var sides = ["borderLeftWidth", "borderTopWidth", "borderRightWidth", "borderBottomWidth"];
    for (var i = 0; i < sides.length; i++) {
      if ((parseFloat(cs[sides[i]]) || 0) >= 3) return true;
    }
    return false;
  }

  /** Does this element hold a picture? An icon is not a picture. */
  function hasMedia(el) {
    var direct = /^(IMG|VIDEO|FIGURE|CANVAS|PICTURE)$/.test(el.tagName);
    if (direct) return true;
    var found = el.querySelector("img, video, figure, canvas, picture");
    if (!found) return false;
    // A tiny inline SVG is an icon, not an illustration.
    if (found.tagName === "svg" || found.tagName === "SVG") {
      var r = found.getBoundingClientRect();
      return r.width >= 80 && r.height >= 80;
    }
    return true;
  }

  function isHeading(el) {
    return /^H[1-6]$/.test(el.tagName);
  }

  /**
   * Band a list of children into rows by vertical overlap.
   *
   * One algorithm for all three layouts, because all three have the same
   * question to answer: which children share a row, and how much empty space
   * is left under the short ones. A flex row, a flex column and a grid all
   * band the same way — a column simply has one child per band.
   */
  function band(items) {
    var sorted = items.slice().sort(function (a, b) {
      return a.r.top - b.r.top;
    });
    var bands = [];
    for (var i = 0; i < sorted.length; i++) {
      var it = sorted[i];
      var last = bands[bands.length - 1];
      if (last && it.r.top < last.bottom - 4) {
        last.items.push(it);
        last.top = Math.min(last.top, it.r.top);
        last.bottom = Math.max(last.bottom, it.r.bottom);
      } else {
        bands.push({ items: [it], top: it.r.top, bottom: it.r.bottom });
      }
    }
    return bands;
  }

  function push(findings, kind, s, metric, detail) {
    for (var i = 0; i < findings.length; i++) {
      if (findings[i].kind === kind && findings[i].sel === s) {
        if (metric > findings[i].metric) {
          findings[i].metric = metric;
          findings[i].detail = detail;
        }
        return;
      }
    }
    findings.push({ kind: kind, sel: s, metric: Math.round(metric), detail: detail || "" });
  }

  function measure(route, w, d) {
    var win = d.defaultView || window;
    var rec = { route: route, w: w, findings: [] };
    var main = d.querySelector("main#content") || d.querySelector("main") || d.body;
    if (!main) {
      rec.error = "no main";
      return rec;
    }
    var F = rec.findings;

    var all = main.querySelectorAll("*");
    var doc = d.documentElement;

    // ---- 5a. the page scrolls sideways ------------------------------------
    if (doc.scrollWidth > doc.clientWidth + 1) {
      var worst = null;
      var every = d.querySelectorAll("*");
      for (var i = 0; i < every.length; i++) {
        var r = every[i].getBoundingClientRect();
        if (r.right > doc.clientWidth + 1) {
          var over = r.right - doc.clientWidth;
          if (!worst || over > worst.over) worst = { over: over, s: sel(every[i]) };
        }
      }
      push(F, "overflow", worst ? worst.s : "document", worst ? worst.over : 0,
        "the page scrolls sideways by " + Math.round(worst ? worst.over : 0) + "px");
    }

    // ---- 1 and 2. dead space, orphans --------------------------------------
    // For every container that lays its children out, band the children and
    // ask of each band: is there a hole, and is anything stranded in it?
    for (var ci = 0; ci < all.length; ci++) {
      var cont = all[ci];
      var cs = win.getComputedStyle(cont);
      var lays = cs.display === "flex" || cs.display === "grid" || cs.display === "inline-flex";
      if (!lays) continue;
      var ch = kids(cont, win);
      if (ch.length < 2) continue;

      var items = [];
      for (var k = 0; k < ch.length; k++) {
        items.push({ el: ch[k], r: ch[k].getBoundingClientRect() });
      }
      var bands = band(items);

      // The hole BETWEEN two rows. A gap beside a heading is a section break
      // — that is what whitespace is FOR — so it is not a hole. A gap in the
      // middle of a run of peers is a hole.
      for (var b = 0; b + 1 < bands.length; b++) {
        var gap = bands[b + 1].top - bands[b].bottom;
        if (gap <= DEAD) continue;
        var lower = bands[b + 1].items[0].el;
        var upper = bands[b].items[bands[b].items.length - 1].el;
        if (isHeading(lower) || isHeading(upper)) continue;
        push(F, "dead", sel(upper), gap,
          gap + "px of empty space under " + sel(upper));
      }

      // The hole UNDER a short cell in a row of taller cells.
      for (var bi = 0; bi < bands.length; bi++) {
        var band1 = bands[bi];
        var bandH = band1.bottom - band1.top;
        if (bandH < DEAD) continue;
        for (var ii = 0; ii < band1.items.length; ii++) {
          var it = band1.items[ii];
          var hole = band1.bottom - it.r.bottom;
          if (hole < DEAD) continue;
          if (it.r.height >= bandH * SHORT) continue;
          var kind = hasMedia(it.el) ? "orphan" : "dead";
          push(F, kind, sel(it.el), hole,
            kind === "orphan"
              ? sel(it.el) + " fills " + Math.round((it.r.height / bandH) * 100) +
                "% of a row " + Math.round(bandH) + "px tall, leaving " + Math.round(hole) + "px empty"
              : sel(it.el) + " leaves " + Math.round(hole) + "px empty beneath it in a " +
                Math.round(bandH) + "px row");
        }
      }
    }

    // ---- 5b. a row that breaks and leaves one orphan on the last row ------
    // "Navigation breaks wherever it runs out of room" is the failure. A row
    // that wraps and leaves its last item alone on a new line is the reader
    // being handed an accident. A row that wraps into two full rows is a
    // design decision, not an accident.
    //
    // Only HORIZONTAL rows are candidates. A vertical menu is not a row that
    // broke — it was always a column — and a grid's rows are the design. A
    // column flex, a block list of links and a grid are all left alone.
    function isHorizontalRow(el, cs) {
      if (cs.display === "flex" || cs.display === "inline-flex") {
        return cs.flexDirection === "row" || cs.flexDirection === "row-reverse";
      }
      if (cs.display === "grid" || cs.display === "inline-grid") return false;
      if (cs.display === "block" || cs.display === "inline") {
        // A block row of inline content is the other way a row breaks: the
        // text simply runs out of room. A block row of block children is a
        // list, and a list was always a list.
        var kk = kids(el, win);
        if (kk.length < 2) return false;
        var inlineCount = 0;
        for (var q = 0; q < kk.length; q++) {
          var d2 = win.getComputedStyle(kk[q]).display;
          if (d2 === "inline" || d2 === "inline-block" || d2 === "inline-flex" || d2 === "inline-grid") {
            inlineCount++;
          }
        }
        return inlineCount === kk.length;
      }
      return false;
    }

    var hosts = [];
    var navs = d.querySelectorAll('nav, [role="navigation"], header nav, header .topbar');
    for (var nv = 0; nv < navs.length; nv++) {
      var ncs = win.getComputedStyle(navs[nv]);
      if (!isHorizontalRow(navs[nv], ncs)) continue;
      // A nav that cannot wrap cannot break.
      var nwrap = ncs.display === "flex" || ncs.display === "inline-flex" ? ncs.flexWrap === "wrap" : true;
      if (nwrap) hosts.push({ el: navs[nv], min: 2 });
    }
    for (var wi = 0; wi < all.length; wi++) {
      var wcs = win.getComputedStyle(all[wi]);
      if (
        (wcs.display === "flex" || wcs.display === "inline-flex") &&
        (wcs.flexDirection === "row" || wcs.flexDirection === "row-reverse") &&
        wcs.flexWrap === "wrap"
      ) {
        hosts.push({ el: all[wi], min: 3 });
      }
    }
    for (var hi = 0; hi < hosts.length; hi++) {
      var host = hosts[hi];
      var hk = kids(host.el, win);
      if (hk.length < host.min) continue;
      var hitems = [];
      for (var hj = 0; hj < hk.length; hj++) {
        hitems.push({ el: hk[hj], r: hk[hj].getBoundingClientRect() });
      }
      var hbands = band(hitems);
      if (hbands.length < 2) continue;
      // A row that never held more than one item is a LIST, not a broken
      // row. A vertical list of four theme choices is four bands of one; a
      // row of four links that wrapped into two lines is two bands of two
      // and one. Only the second is an accident.
      var widest = 0;
      for (var wb = 0; wb < hbands.length; wb++) {
        if (hbands[wb].items.length > widest) widest = hbands[wb].items.length;
      }
      if (widest < 2) continue;
      var lastBand = hbands[hbands.length - 1];
      if (lastBand.items.length !== 1) continue;
      push(F, "wrap", sel(host.el), hbands.length,
        sel(host.el) + " breaks into " + hbands.length + " rows and leaves " +
        sel(lastBand.items[0].el) + " alone on the last one");
    }

    // ---- 5c. a row that is clipped rather than wrapped ---------------------
    for (var oi = 0; oi < all.length; oi++) {
      var oe = all[oi];
      if (oe === d.body || oe === doc) continue;
      var ocs = win.getComputedStyle(oe);
      if (ocs.overflowX !== "hidden" && ocs.overflowX !== "clip") continue;
      if (oe.clientWidth <= 40) continue;
      if (oe.scrollWidth > oe.clientWidth + 2) {
        // A frame that crops a picture on purpose is not a row that lost its
        // content. The palace plates are sprite crops — a 400%-wide image
        // inside a 3:4 window with overflow hidden — and that is the picture
        // working, not a defect.
        if (oe.querySelector("img, picture, video, canvas")) continue;
        push(F, "clip", sel(oe), oe.scrollWidth - oe.clientWidth,
          sel(oe) + " hides " + (oe.scrollWidth - oe.clientWidth) + "px of its own content");
      }
    }

    // ---- 3. scattered actions ----------------------------------------------
    // Two loud controls in one container, pushed to opposite edges.
    for (var si = 0; si < all.length; si++) {
      var scont = all[si];
      var scs = win.getComputedStyle(scont);
      if (scs.display !== "flex" && scs.display !== "grid" && scs.display !== "block") continue;
      var sks = kids(scont, win);
      var ctl = [];
      for (var sk = 0; sk < sks.length; sk++) {
        if (/^(A|BUTTON)$/.test(sks[sk].tagName) && loudControl(sks[sk], win)) ctl.push(sks[sk]);
      }
      if (ctl.length < 2) continue;
      var scr = scont.getBoundingClientRect();
      if (scr.width < 200) continue;
      for (var p1 = 0; p1 < ctl.length; p1++) {
        for (var p2 = p1 + 1; p2 < ctl.length; p2++) {
          var r1 = ctl[p1].getBoundingClientRect();
          var r2 = ctl[p2].getBoundingClientRect();
          var cx1 = r1.left + r1.width / 2;
          var cx2 = r2.left + r2.width / 2;
          var apart = Math.abs(cx1 - cx2) / scr.width;
          if (apart > EDGE) {
            push(F, "scattered", sel(scont), apart * 100,
              sel(ctl[p1]) + " and " + sel(ctl[p2]) + " sit " +
              Math.round(apart * 100) + "% apart in " + sel(scont));
          }
        }
      }
    }

    // ---- 4. false hierarchy ------------------------------------------------
    var h1 = main.querySelector("h1");
    var h1size = h1 ? parseFloat(win.getComputedStyle(h1).fontSize) : 0;
    var largest = 0;
    var largestInfo = null;
    var ramp = {};
    var peerChars = 0;
    var totalChars = 0;
    var peers = 0;
    for (var mi = 0; mi < all.length; mi++) {
      var el = all[mi];
      var cs2 = win.getComputedStyle(el);
      if (cs2.display === "none" || cs2.visibility === "hidden") continue;
      var r2 = el.getBoundingClientRect();
      if (!r2.width || !r2.height) continue;
      var own = "";
      for (var cn = 0; cn < el.childNodes.length; cn++) {
        if (el.childNodes[cn].nodeType === 3) own += el.childNodes[cn].nodeValue;
      }
      own = own.replace(/\s+/g, " ").trim();
      if (!own) continue;
      totalChars += own.length;
      var size = parseFloat(cs2.fontSize);
      var key = String(Math.round(size * 10) / 10);
      ramp[key] = (ramp[key] || 0) + own.length;
      if (el.tagName !== "H1" && size > largest) {
        largest = size;
        largestInfo = {
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || "").slice(0, 40),
          size: size,
          text: own.slice(0, 40),
        };
      }
      var weight = Number(cs2.fontWeight) || 400;
      if (weight >= 600 && size >= 15 && size < h1size && el.tagName !== "OPTION") {
        var loudAncestor = false;
        for (var anc = el.parentElement; anc && anc !== main; anc = anc.parentElement) {
          var acs = win.getComputedStyle(anc);
          if (
            (Number(acs.fontWeight) || 400) >= 600 &&
            parseFloat(acs.fontSize) >= 15 &&
            parseFloat(acs.fontSize) < h1size
          ) {
            loudAncestor = true;
            break;
          }
        }
        if (!loudAncestor) {
          peers++;
          peerChars += own.length;
        }
      }
    }
    rec.hierarchy = {
      h1: h1size,
      h1Count: main.querySelectorAll("h1").length,
      largest: largest,
      largestInfo: largestInfo,
      ratio: h1size && largest ? Math.round((h1size / largest) * 100) / 100 : null,
      peers: peers,
      share: totalChars ? Math.round((peerChars / totalChars) * 100) / 100 : 0,
      ramp: ramp,
    };
    rec.chars = totalChars;

    // ---- 6. spatially expensive information --------------------------------
    // How far down the page the first thing you can DO is. A reader who must
    // scroll before they can act is paying for the layout.
    var acts = main.querySelectorAll("a, button, input, select, textarea");
    var firstY = null;
    var firstSel = null;
    for (var ai = 0; ai < acts.length; ai++) {
      var ae = acts[ai];
      if (!visible(ae, win)) continue;
      var ar = ae.getBoundingClientRect();
      var actable = /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName) || loudControl(ae, win);
      if (!actable) continue;
      var y = ar.top + (win.scrollY || 0);
      if (firstY === null || y < firstY) {
        firstY = y;
        firstSel = sel(ae);
      }
    }
    rec.firstAction = { y: firstY === null ? null : Math.round(firstY), sel: firstSel };
    return rec;
  }

  window.__SPATIAL_MEASURE__ = measure;
  window.__SPATIAL_DEFAULTS__ = { DEAD: DEAD, SHORT: SHORT, EDGE: EDGE, CONTRAST: CONTRAST };
})();
