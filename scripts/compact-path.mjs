// Lossless compaction of the map outlines for dist/.
//
// data/map.json stores every outline as absolute "M x,y L x,y … Z" with one
// decimal. The build rewrites them as relative moves on the same 0.1 grid
// ("M360.6 629.6l-.7-.6-2.3-.3…z"): the integer arithmetic keeps every vertex
// exactly where it was. Repeated vertices (zero-length segments) and a last
// vertex equal to the first (Z closes the ring anyway) are dropped. The same
// idea as svgo's convertPathData, limited to what these files contain, so the
// build needs no extra dependency.

const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

/** Rings of [x, y] vertices (in tenths, as integers) of an M/L/Z path, absolute or relative. */
export function rings(d) {
  const out = [];
  let ring = null;
  let x = 0;
  let y = 0;
  let start = [0, 0];
  for (const m of d.matchAll(/([MmLlZz])([^MmLlZz]*)/g)) {
    const cmd = m[1];
    const nums = (m[2].match(NUMBER) || []).map((v) => Math.round(Number(v) * 10));
    if (/[^\d\s,.+\-eE]/.test(m[2])) throw new Error('unexpected path data: ' + m[2].slice(0, 20));
    if (cmd === 'Z' || cmd === 'z') {
      if (nums.length) throw new Error('numbers after Z');
      x = start[0];
      y = start[1];
      ring = null;
      continue;
    }
    if (nums.length === 0 || nums.length % 2) throw new Error('odd coordinate count in ' + cmd);
    const rel = cmd === 'm' || cmd === 'l';
    for (let i = 0; i < nums.length; i += 2) {
      x = rel ? x + nums[i] : nums[i];
      y = rel ? y + nums[i + 1] : nums[i + 1];
      if (i === 0 && (cmd === 'M' || cmd === 'm')) {
        ring = [];
        out.push(ring);
        start = [x, y];
      }
      if (!ring) throw new Error('line before move');
      ring.push([x, y]);
    }
  }
  return out;
}

/** Drop repeated vertices and a closing vertex equal to the first. */
export function simplifyRing(ring) {
  const out = [];
  for (const p of ring) {
    const q = out.at(-1);
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
  }
  if (out.length > 1 && out.at(-1)[0] === out[0][0] && out.at(-1)[1] === out[0][1]) out.pop();
  return out;
}

/** Tenths as the shortest SVG number: 5 → ".5", -7 → "-.7", 30 → "3", 0 → "0". */
function num(t) {
  const a = Math.abs(t);
  const int = Math.floor(a / 10);
  const frac = a % 10;
  return (t < 0 ? '-' : '') + (int ? String(int) : frac ? '' : '0') + (frac ? '.' + frac : '');
}

/** Join numbers with a space only where the SVG path grammar needs one. */
function joinNumbers(list) {
  let out = '';
  for (const s of list) {
    const needsSpace = out && s[0] !== '-' && !(s[0] === '.' && /\.\d*$/.test(out));
    out += (needsSpace ? ' ' : '') + s;
  }
  return out;
}

export function compactPath(d) {
  let out = '';
  for (const ring of rings(d).map(simplifyRing)) {
    if (!ring.length) continue;
    out += 'M' + joinNumbers([num(ring[0][0]), num(ring[0][1])]);
    const rel = [];
    for (let i = 1; i < ring.length; i++) {
      rel.push(num(ring[i][0] - ring[i - 1][0]), num(ring[i][1] - ring[i - 1][1]));
    }
    if (rel.length) out += 'l' + joinNumbers(rel);
    out += 'z';
  }
  return out;
}
