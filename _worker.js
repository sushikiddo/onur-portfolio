var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// auth.mjs
var encoder = new TextEncoder();
var ITERATIONS = 1e5;
var SESSION_SECONDS = 8 * 60 * 60;
var hex = /* @__PURE__ */ __name((bytes) => Array.from(new Uint8Array(bytes), (x2) => x2.toString(16).padStart(2, "0")).join(""), "hex");
var unhex = /* @__PURE__ */ __name((text) => {
  if (typeof text !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(text)) throw new Error("Invalid authentication record");
  return Uint8Array.from(text.match(/../g), (x2) => parseInt(x2, 16));
}, "unhex");
var randomHex = /* @__PURE__ */ __name((bytes) => hex(crypto.getRandomValues(new Uint8Array(bytes))), "randomHex");
var digest = /* @__PURE__ */ __name(async (text) => hex(await crypto.subtle.digest("SHA-256", encoder.encode(text))), "digest");
async function derive(password, salt, iterations) {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > ITERATIONS) throw new Error("Invalid authentication record");
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(salt), iterations }, key, 256));
}
__name(derive, "derive");
function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i2 = 0; i2 < a.length; i2++) diff |= a.charCodeAt(i2) ^ b.charCodeAt(i2);
  return diff === 0;
}
__name(equal, "equal");
var json = /* @__PURE__ */ __name((body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } }), "json");
async function bodyJSON(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 4096 || length < 0) throw Object.assign(new Error("Request too large"), { status: 413 });
  const text = await request.text();
  if (encoder.encode(text).length > 4096) throw Object.assign(new Error("Request too large"), { status: 413 });
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw 0;
    return value;
  } catch {
    throw Object.assign(new Error("Invalid request"), { status: 400 });
  }
}
__name(bodyJSON, "bodyJSON");
function tokenFrom(request) {
  const value = (request.headers.get("Cookie") || "").split(";").map((s) => s.trim()).find((s) => s.startsWith("session="));
  const token = value?.slice(8);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
__name(tokenFrom, "tokenFrom");
var cookie = /* @__PURE__ */ __name((value, maxAge) => `session=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`, "cookie");
async function limit(request, env, kind) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bucket = await digest(`${kind}:${ip}`);
  const now = Math.floor(Date.now() / 1e3);
  const row = await env.DB.prepare(`INSERT INTO attempts (bucket,count,reset_at) VALUES (?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,
    reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count,reset_at`).bind(bucket, now + 60, now, now).first();
  return { allowed: row.count <= 5, bucket };
}
__name(limit, "limit");
async function record(env) {
  return env.DB.prepare("SELECT salt,hash,iterations FROM auth WHERE id='admin'").first();
}
__name(record, "record");
async function matches(password, rec) {
  return !!rec && typeof password === "string" && password.length <= 256 && equal(await derive(password, rec.salt, rec.iterations), rec.hash);
}
__name(matches, "matches");
async function isAuthenticated(request, env) {
  const token = tokenFrom(request);
  if (!token) return false;
  const row = await env.DB.prepare("SELECT expires FROM sessions WHERE token_hash=? AND expires>?").bind(await digest(token), Math.floor(Date.now() / 1e3)).first();
  return !!row;
}
__name(isAuthenticated, "isAuthenticated");
async function login(request, env) {
  const attempt = await limit(request, env, "login");
  if (!attempt.allowed) return json({ error: "Too many attempts. Please wait one minute." }, 429, { "Retry-After": "60" });
  const input = await bodyJSON(request);
  const rec = await record(env);
  if (!await matches(input.password, rec)) return json({ error: "Parola yanl\u0131\u015F" }, 401);
  const token = randomHex(32), now = Math.floor(Date.now() / 1e3);
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM attempts WHERE bucket=?").bind(attempt.bucket),
    env.DB.prepare("DELETE FROM sessions WHERE expires<=?").bind(now),
    env.DB.prepare("INSERT INTO sessions(token_hash,expires) SELECT ?,? WHERE EXISTS (SELECT 1 FROM auth WHERE id='admin' AND hash=?)").bind(await digest(token), now + SESSION_SECONDS, rec.hash)
  ]);
  if (!results[2].meta.changes) return json({ error: "Password changed. Sign in again." }, 409);
  return json({ ok: true }, 200, { "Set-Cookie": cookie(token, SESSION_SECONDS) });
}
__name(login, "login");
async function logout(request, env) {
  const token = tokenFrom(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
  return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
}
__name(logout, "logout");
async function changePassword(request, env) {
  const attempt = await limit(request, env, "password");
  if (!attempt.allowed) return json({ error: "Too many attempts. Please wait one minute." }, 429, { "Retry-After": "60" });
  const input = await bodyJSON(request), rec = await record(env);
  if (!await matches(input.current, rec)) return json({ error: "Mevcut parola yanl\u0131\u015F" }, 403);
  if (typeof input.password !== "string" || input.password.length < 12 || input.password.length > 256) return json({ error: "Yeni parola 12\u2013256 karakter olmal\u0131" }, 400);
  const salt = randomHex(16), hash = await derive(input.password, salt, ITERATIONS);
  const results = await env.DB.batch([
    env.DB.prepare("UPDATE auth SET salt=?,hash=?,iterations=? WHERE id='admin' AND hash=?").bind(salt, hash, ITERATIONS, rec.hash),
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM attempts WHERE bucket=?").bind(attempt.bucket)
  ]);
  if (!results[0].meta.changes) return json({ error: "Password changed. Sign in again." }, 409);
  return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
}
__name(changePassword, "changePassword");

// node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = /* @__PURE__ */ __name(function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
}, "freb");
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = /* @__PURE__ */ __name((function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
}), "hMap");
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var shft = /* @__PURE__ */ __name(function(p) {
  return (p + 7) / 8 | 0;
}, "shft");
var slc = /* @__PURE__ */ __name(function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
}, "slc");
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = /* @__PURE__ */ __name(function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
}, "err");
var wbits = /* @__PURE__ */ __name(function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
}, "wbits");
var wbits16 = /* @__PURE__ */ __name(function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
}, "wbits16");
var hTree = /* @__PURE__ */ __name(function(d, mb) {
  var t = [];
  for (var i2 = 0; i2 < d.length; ++i2) {
    if (d[i2])
      t.push({ s: i2, f: d[i2] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i22 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i22].f ? i0++ : i22++];
    r = t[i0 != i1 && t[i0].f < t[i22].f ? i0++ : i22++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i2 = 1; i2 < s; ++i2) {
    if (t2[i2].s > maxSym)
      maxSym = t2[i2].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i2 = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (; i2 < s; ++i2) {
      var i2_1 = t2[i2].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i2].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i2;
    }
    for (; i2 >= 0 && dt; --i2) {
      var i2_3 = t2[i2].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
}, "hTree");
var ln = /* @__PURE__ */ __name(function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
}, "ln");
var lc = /* @__PURE__ */ __name(function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = /* @__PURE__ */ __name(function(v) {
    cl[cli++] = v;
  }, "w");
  for (var i2 = 1; i2 <= s; ++i2) {
    if (c[i2] == cln && i2 != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (; cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (; cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i2];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
}, "lc");
var clen = /* @__PURE__ */ __name(function(cf, cl) {
  var l = 0;
  for (var i2 = 0; i2 < cl.length; ++i2)
    l += cf[i2] * cl[i2];
  return l;
}, "clen");
var wfblk = /* @__PURE__ */ __name(function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i2 = 0; i2 < s; ++i2)
    out[o + i2 + 4] = dat[i2];
  return (o + 4 + s) * 8;
}, "wfblk");
var wblk = /* @__PURE__ */ __name(function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i2 = 0; i2 < lclt.length; ++i2)
    ++lcfreq[lclt[i2] & 31];
  for (var i2 = 0; i2 < lcdt.length; ++i2)
    ++lcfreq[lcdt[i2] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i2 = 0; i2 < nlcc; ++i2)
      wbits(out, p + 3 * i2, lct[clim[i2]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i2 = 0; i2 < clct.length; ++i2) {
        var len = clct[i2] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i2] >> 5 & 127), p += clct[i2] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i2 = 0; i2 < li; ++i2) {
    var sym = syms[i2];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
}, "wblk");
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = /* @__PURE__ */ __name(function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = /* @__PURE__ */ __name(function(i3) {
      return (dat[i3] ^ dat[i3 + 1] << bs1_1 ^ dat[i3 + 2] << bs2_1) & msk_1;
    }, "hsh");
    var syms = new i32(25e3);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i2 = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (; i2 + 2 < s; ++i2) {
      var hv = hsh(i2);
      var imod = i2 & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i2) {
        var rem = s - i2;
        if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i2 - bs, pos);
          li = lc_1 = eb = 0, bs = i2;
          for (var j = 0; j < 286; ++j)
            lf[j] = 0;
          for (var j = 0; j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i2 - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i2);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i2 + l] == dat[i2 + l - dif]) {
              var nl = 0;
              for (; nl < ml && dat[i2 + nl] == dat[i2 + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0; j < mmd; ++j) {
                  var ti = i2 - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i2 + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i2];
          ++lf[dat[i2]];
        }
      }
    }
    for (i2 = Math.max(i2, wi); i2 < s; ++i2) {
      syms[li++] = dat[i2];
      ++lf[dat[i2]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i2 - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i2, st.w = wi;
    }
  } else {
    for (var i2 = st.w || 0; i2 < s + lst; i2 += 65535) {
      var e = i2 + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i2, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
}, "dflt");
var crct = /* @__PURE__ */ (function() {
  var t = new Int32Array(256);
  for (var i2 = 0; i2 < 256; ++i2) {
    var c = i2, k = 9;
    while (--k)
      c = (c & 1 && -306674912) ^ c >>> 1;
    t[i2] = c;
  }
  return t;
})();
var crc = /* @__PURE__ */ __name(function() {
  var c = -1;
  return {
    p: /* @__PURE__ */ __name(function(d) {
      var cr = c;
      for (var i2 = 0; i2 < d.length; ++i2)
        cr = crct[cr & 255 ^ d[i2]] ^ cr >>> 8;
      c = cr;
    }, "p"),
    d: /* @__PURE__ */ __name(function() {
      return ~c;
    }, "d")
  };
}, "crc");
var dopt = /* @__PURE__ */ __name(function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
}, "dopt");
var mrg = /* @__PURE__ */ __name(function(a, b) {
  var o = {};
  for (var k in a)
    o[k] = a[k];
  for (var k in b)
    o[k] = b[k];
  return o;
}, "mrg");
var wbytes = /* @__PURE__ */ __name(function(d, b, v) {
  for (; v; ++b)
    d[b] = v, v >>>= 8;
}, "wbytes");
function deflateSync(data, opts) {
  return dopt(data, opts || {}, 0, 0);
}
__name(deflateSync, "deflateSync");
var fltn = /* @__PURE__ */ __name(function(d, p, t, o) {
  for (var k in d) {
    var val = d[k], n = p + k, op = o;
    if (Array.isArray(val))
      op = mrg(o, val[1]), val = val[0];
    if (ArrayBuffer.isView(val))
      t[n] = [val, op];
    else {
      t[n += "/"] = [new u8(0), op];
      fltn(val, n, t, o);
    }
  }
}, "fltn");
var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i2 = 0; i2 < str.length; ++i2)
      ar_1[i2] = str.charCodeAt(i2);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = /* @__PURE__ */ __name(function(v) {
    ar[ai++] = v;
  }, "w");
  for (var i2 = 0; i2 < l; ++i2) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i2 << 1));
      n.set(ar);
      ar = n;
    }
    var c = str.charCodeAt(i2);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
    else
      w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
  }
  return slc(ar, 0, ai);
}
__name(strToU8, "strToU8");
var exfl = /* @__PURE__ */ __name(function(ex) {
  var le = 0;
  if (ex) {
    for (var k in ex) {
      var l = ex[k].length;
      if (l > 65535)
        err(9);
      le += l + 4;
    }
  }
  return le;
}, "exfl");
var wzh = /* @__PURE__ */ __name(function(d, b, f, fn, u, c, ce, co) {
  var fl2 = fn.length, ex = f.extra, col = co && co.length;
  var exl = exfl(ex);
  wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
  if (ce != null)
    d[b++] = 20, d[b++] = f.os;
  d[b] = 20, b += 2;
  d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
  d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
  var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
  if (y < 0 || y > 119)
    err(10);
  wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
  if (c != -1) {
    wbytes(d, b, f.crc);
    wbytes(d, b + 4, c < 0 ? -c - 2 : c);
    wbytes(d, b + 8, f.size);
  }
  wbytes(d, b + 12, fl2);
  wbytes(d, b + 14, exl), b += 16;
  if (ce != null) {
    wbytes(d, b, col);
    wbytes(d, b + 6, f.attrs);
    wbytes(d, b + 10, ce), b += 14;
  }
  d.set(fn, b);
  b += fl2;
  if (exl) {
    for (var k in ex) {
      var exf = ex[k], l = exf.length;
      wbytes(d, b, +k);
      wbytes(d, b + 2, l);
      d.set(exf, b + 4), b += 4 + l;
    }
  }
  if (col)
    d.set(co, b), b += col;
  return b;
}, "wzh");
var wzf = /* @__PURE__ */ __name(function(o, b, c, d, e) {
  wbytes(o, b, 101010256);
  wbytes(o, b + 8, c);
  wbytes(o, b + 10, c);
  wbytes(o, b + 12, d);
  wbytes(o, b + 16, e);
}, "wzf");
function zipSync(data, opts) {
  if (!opts)
    opts = {};
  var r = {};
  var files = [];
  fltn(data, "", r, opts);
  var o = 0;
  var tot = 0;
  for (var fn in r) {
    var _a2 = r[fn], file = _a2[0], p = _a2[1];
    var compression = p.level == 0 ? 0 : 8;
    var f = strToU8(fn), s = f.length;
    var com = p.comment, m = com && strToU8(com), ms = m && m.length;
    var exl = exfl(p.extra);
    if (s > 65535)
      err(11);
    var d = compression ? deflateSync(file, p) : file, l = d.length;
    var c = crc();
    c.p(file);
    files.push(mrg(p, {
      size: file.length,
      crc: c.d(),
      c: d,
      f,
      m,
      u: s != fn.length || m && com.length != ms,
      o,
      compression
    }));
    o += 30 + s + exl + l;
    tot += 76 + 2 * (s + exl) + (ms || 0) + l;
  }
  var out = new u8(tot + 22), oe = o, cdl = tot - o;
  for (var i2 = 0; i2 < files.length; ++i2) {
    var f = files[i2];
    wzh(out, f.o, f, f.f, f.u, f.c.length);
    var badd = 30 + f.f.length + exfl(f.extra);
    out.set(f.c, f.o + badd);
    wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
  }
  wzf(out, o, files.length, cdl, oe);
  return out;
}
__name(zipSync, "zipSync");

// content.mjs
const CURRENT_SITE_PAGES={"index.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"tr\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>Anasayfa | Onur Can Orhan</title><meta content=\"Teknoloji, tasarım ve yeni fikirlerle ilgileniyorum. Bu sitede kendimi, çalışmalarımı ve ilgi alanlarımı tanıtıyorum.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"tr_TR\"/><meta property=\"og:title\" content=\"Anasayfa | Onur Can Orhan\"/><meta property=\"og:description\" content=\"Teknoloji, tasarım ve yeni fikirlerle ilgileniyorum. Bu sitede kendimi, çalışmalarımı ve ilgi alanlarımı tanıtıyorum.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"assets/js/site.js\"></script><script defer=\"\" src=\"assets/js/enhancements.js\"></script><script defer src=\"assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"images/logo.svg\"/></head><body class=\"page-home\"><a class=\"skip\" href=\"#main\">İçeriğe geç</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Anasayfa\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menü</button><nav aria-label=\"Ana menü\" class=\"navlinks\" id=\"primary-nav\"><a aria-current=\"page\" href=\"index.html\">Anasayfa</a><a href=\"hakkimda.html\">Hakkımda</a><a href=\"projeler.html\">Projeler</a><a href=\"blog.html\">Blog</a><a href=\"galeri.html\">Galeri</a><a href=\"iletisim.html\">İletişim</a><a class=\"lang\" hreflang=\"en\" href=\"en/index.html\" lang=\"en\">EN</a><button aria-label=\"Temayı değiştir\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"hero cinematic-hero\" aria-labelledby=\"hero-heading\"><div class=\"hero-atmosphere\" aria-hidden=\"true\"><span class=\"light light-one\"></span><span class=\"light light-two\"></span><div class=\"hero-grid\"></div></div><div class=\"wrap hero-layout\"><div class=\"hero-copy\"><p class=\"eyebrow hero-status\"><span aria-hidden=\"true\"></span>ÖĞRENCİ PORTFOLYOSU · ANTALYA, TR</p><p class=\"hero-identity\">ONUR CAN ORHAN <span>/ PORTFOLIO 2026</span></p><h1 id=\"hero-heading\">Merak.<br/>Kod.<br/><em>Yeni d&#252;nyalar.</em></h1><p class=\"hero-tagline\" data-field=\"hero-title-tr\">Her satır kod, yeni bir dünyanın başlangıcı.</p><p class=\"lead\" data-field=\"hero-subtitle-tr\">Onur Can Orhan · Bilgisayar Programcılığı öğrencisi · Oyun geliştirici adayı</p><div class=\"actions\"><a class=\"btn\" href=\"projeler.html\">Projelerimi Keşfet <span aria-hidden=\"true\">↗</span></a><a class=\"btn ghost\" href=\"hakkimda.html\">Hakkımda <span aria-hidden=\"true\">→</span></a></div></div><div class=\"hero-world\" aria-hidden=\"true\"><div class=\"network-halo\"></div><canvas id=\"heroSculpture\"></canvas><div class=\"network-cross cross-one\">+</div><div class=\"network-cross cross-two\">+</div><div class=\"network-label\"><span class=\"network-live\"></span> SYSTEM / EXPLORING</div><div class=\"network-coordinate\">36.89 N<br/>30.70 E</div><div class=\"network-caption\"><span>01 / DIGITAL EXPLORATION</span><strong>Ideas have no boundaries.</strong></div><div class=\"network-axis\"><span>X</span><i></i><span>Y</span></div></div></div><div class=\"wrap hero-rail\"><a href=\"#selected-work\">KEŞFETMEK İÇİN KAYDIR <span aria-hidden=\"true\">↓</span></a><span>PYTHON <i>/</i> CSS <i>/</i> GAME DEVELOPMENT</span></div></section><div class=\"discipline-strip\" aria-label=\"Odak alanlar&#305;\"><div class=\"wrap\"><span>WEB DEVELOPMENT</span><i aria-hidden=\"true\">+</i><span>CREATIVE CODING</span><i aria-hidden=\"true\">+</i><span>GAME DESIGN</span><i aria-hidden=\"true\">+</i><span>ALWAYS LEARNING</span></div></div><section class=\"wrap section home-intro\"><div class=\"intro-heading\"><p class=\"eyebrow\">YAZILIM × YARATICILIK</p><h2>Merakla başlar.<br/>Üreterek gelişir.</h2></div><p class=\"lead\" data-field=\"bio-short-tr\">Onur Can Orhan Bilgisayar Öğrencisi | Oyun Geliştirici Adayı Yazılım ve yaratıcılığın buluştuğu noktada kendimi geliştiriyorum. Python ve CSS öğreniyor, gelecekte kendi oyunlarımı geliştirmeyi hedefliyorum.</p></section><section class=\"wrap section home-projects editorial-work\" id=\"selected-work\"><div class=\"section-heading\"><div><p class=\"eyebrow\">01 / SEÇİLİ ÇALIŞMALAR</p><h2>Se&#231;ili<br/><em>&#231;al&#305;&#351;malar.</em></h2></div><p>Öğrenme sürecimden oyunlar,<br/>denemeler ve görsel keşifler.</p></div><div class=\"grid tiles phantom-tiles\"><!-- PROJECTS:START --><article data-project-id=\"4\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">04</span><img data-image=\"project-4\" src=\"assets/img/komur-cover.svg\" alt=\"Kömür masaüstü kedisi illüstrasyonu\" width=\"1000\" height=\"650\" loading=\"lazy\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-4-category-tr\">Masaüstü Uygulaması</p><h3 data-field=\"project-4-title-tr\">Kömür</h3><p data-field=\"project-4-desc-tr\">Yerel AI, isteğe bağlı ses, hafıza ve günlük işler için Python masaüstü kedisi.</p><a class=\"btn ghost project-open\" href=\"komur.html\">Proje ve indirmeler</a></div></article><article data-project-id=\"1\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">01</span><img alt=\"Space Survivor oyun ekranı\" data-image=\"project-1\" loading=\"lazy\" src=\"oyun/tanitim-gorseli.png\" width=\"1440\" height=\"900\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-1-category-tr\">Oyun</p><h3 data-field=\"project-1-title-tr\">Space Survivor</h3><p data-field=\"project-1-desc-tr\">Tarayıcıda oynanabilen, HTML5 Canvas ve JavaScript ile geliştirilmiş uzay temalı oyun denemem.</p><a class=\"btn ghost project-open\" href=\"oyun/index.html\">Oyunu Oyna</a></div></article><article data-project-id=\"2\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">02</span><img alt=\"Hareketli Tipografi\" data-image=\"project-2\" loading=\"lazy\" src=\"assets/img/project-2.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-2-category-tr\">Grafik Tasarım</p><h3 data-field=\"project-2-title-tr\">Hareketli Tipografi</h3><p data-field=\"project-2-desc-tr\">Animasyon ilkeleri ve yazı hareketleri için örnek proje kartı.</p></div></article><article data-project-id=\"3\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">03</span><img alt=\"Dijital İllüstrasyon\" data-image=\"project-3\" loading=\"lazy\" src=\"assets/img/project-3.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-3-category-tr\">Grafik Tasarım</p><h3 data-field=\"project-3-title-tr\">Dijital İllüstrasyon</h3><p data-field=\"project-3-desc-tr\">Katmanlar ve renk uyumu üzerine örnek proje kartı.</p></div></article><!-- PROJECTS:END --></div><p><a class=\"btn ghost\" href=\"projeler.html\">Tümünü gör</a></p></section><section class=\"wrap section home-journal\"><div class=\"section-heading\"><div><p class=\"eyebrow\">02 / GÖRSEL GÜNLÜK</p><h2>Başka bir<br/><em>bakış açısı.</em></h2></div></div><div class=\"grid tiles phantom-tiles\"><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Çizim · eskiz defteri\" data-image=\"gallery-1\" loading=\"lazy\" src=\"assets/img/gallery-1.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-1-title-tr\">Çizim · eskiz defteri</h3><p data-field=\"gallery-1-desc-tr\">Çizim ve eskiz pratiğinden esinlenen soyut bir çalışma.</p></div></article><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Oyun dünyaları · renk ve atmosfer\" data-image=\"gallery-2\" loading=\"lazy\" src=\"assets/img/gallery-2.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-2-title-tr\">Oyun dünyaları · renk ve atmosfer</h3><p data-field=\"gallery-2-desc-tr\">Çizim ve eskiz pratiğinden esinlenen soyut bir çalışma.</p></div></article><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Sinema · ışık ve kadraj\" data-image=\"gallery-3\" loading=\"lazy\" src=\"assets/img/gallery-3.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-3-title-tr\">Sinema · ışık ve kadraj</h3><p data-field=\"gallery-3-desc-tr\">Çizim ve eskiz pratiğinden esinlenen soyut bir çalışma.</p></div></article></div><p><a class=\"btn ghost\" href=\"galeri.html\">Tümünü gör</a></p></section><section class=\"wrap section focus-section process-section\" aria-labelledby=\"focus-title\"><div><p class=\"eyebrow\">ÖĞREN / ÜRET / PAYLAŞ</p><h2 id=\"focus-title\">Bir fikir.<br/><em>Bir sonraki ad&#305;m.</em></h2></div><div class=\"focus-grid\"><article class=\"focus-card\"><span class=\"focus-number\" aria-hidden=\"true\">01</span><h3>Web temelleri</h3><p>Semantik HTML, responsive CSS ve erişilebilir etkileşimler.</p></article><article class=\"focus-card\"><span class=\"focus-number\" aria-hidden=\"true\">02</span><h3>Oyun geliştirme</h3><p>JavaScript ve Canvas ile küçük tarayıcı denemeleri.</p></article><article class=\"focus-card\"><span class=\"focus-number\" aria-hidden=\"true\">03</span><h3>Görsel keşif</h3><p>Tipografi, katman ve renk örnekleriyle öğrenme.</p></article></div></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">BİR SONRAKİ SAYFA</p><h2>Her fikir<br/><em>bir merhaba ile başlar.</em></h2></div><a class=\"footer-arrow\" href=\"iletisim.html\" aria-label=\"İletişime geç\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Kod. Merak. Yeni dünyalar.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Öğrenci portfolyosu · HTML5 ve CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Yönetici paneli</a> · <a href=\"kaynak.txt\">Kaynaklar</a></span></div></div></footer></body></html>","hakkimda.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"tr\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>Hakkımda | Onur Can Orhan</title><meta content=\"Eğitim yolculuğum, ilgi alanlarım ve becerilerim.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"tr_TR\"/><meta property=\"og:title\" content=\"Hakkımda | Onur Can Orhan\"/><meta property=\"og:description\" content=\"Eğitim yolculuğum, ilgi alanlarım ve becerilerim.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/hakkimda.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"assets/js/site.js\"></script><script defer=\"\" src=\"assets/js/enhancements.js\"></script><script defer src=\"assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"images/logo.svg\"/></head><body class=\"page-about\"><a class=\"skip\" href=\"#main\">İçeriğe geç</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Anasayfa\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menü</button><nav aria-label=\"Ana menü\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Anasayfa</a><a aria-current=\"page\" href=\"hakkimda.html\">Hakkımda</a><a href=\"projeler.html\">Projeler</a><a href=\"blog.html\">Blog</a><a href=\"galeri.html\">Galeri</a><a href=\"iletisim.html\">İletişim</a><a class=\"lang\" hreflang=\"en\" href=\"en/about.html\" lang=\"en\">EN</a><button aria-label=\"Temayı değiştir\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\" data-page-number=\"01\"><p class=\"eyebrow\">01 / PİKSELLERİN ARDINDAKİ KİŞİ</p><h1>Hakkımda</h1><p class=\"lead\">Bilgisayar Programc&#x131;l&#x131;&#x11f;&#x131; &#xF6;&#x11f;rencisi olarak yaz&#x131;l&#x131;m&#x131;n temellerini &#xF6;&#x11f;reniyor; &#xE7;izim, oyunlar ve g&#xF6;rsel anlat&#x131;m &#xFC;zerinden kendi y&#xF6;n&#xFC;m&#xFC; ar&#x131;yorum.</p><p class=\"eyebrow page-intro\">&#xD6;&#x11f;RENC&#x130; / YAZILIM TEMELLER&#x130; / OYUN GEL&#x130;&#x15E;T&#x130;RMEYE &#x130;LG&#x130;</p></p></section><section class=\"wrap section\"><div class=\"profile\"><div class=\"portrait\"><img alt=\"Profil fotoğrafı\" data-image=\"portrait\" src=\"media/ca0f9d19-9aba-45cc-8397-46078135933c.png\" width=\"1000\" height=\"650\" decoding=\"async\" loading=\"lazy\"/></div><div class=\"panel\"><h2>Özgeçmiş</h2><div class=\"bio-copy\" data-field=\"bio-tr\">Merhaba, ben Onur Can Orhan. Akdeniz Üniversitesi Bilgisayar bölümünde öğrenciyim. Python ve CSS öğrenerek programlama ve web tasarımının temellerini çalışıyorum. Bilgimi küçük uygulamalarla pekiştirmeyi hedefliyorum. Çizim yapmak, oyun oynamak ve film izlemek ilgi alanlarım arasında. Oyunların görsel tasarımına, hikâye anlatımına ve teknik yapısına merak duyuyorum. Uzun vadede teknik ve görsel ilgilerimi bir araya getirerek kendi oyun projelerimi geliştirmek istiyorum.</div></div></div></section><section class=\"wrap section education-section\" aria-labelledby=\"education-title\"><div class=\"section-heading\"><div><p class=\"eyebrow\">LEARNING / 2026</p><h2>Geleceğin temelleri.</h2></div></div><div class=\"education-grid\"><div class=\"education-marker\" aria-hidden=\"true\">01</div><div><p class=\"eyebrow\">EĞİTİM</p><h3 data-field=\"bio-school-tr\">Akdeniz Üniversitesi</h3><p data-field=\"bio-degree-tr\">Bilgisayar Programcılığı · 1. sınıf</p></div><span class=\"education-tag\">ÖĞRENMEYE DEVAM</span></div></section><section class=\"wrap section learning-path\"><div class=\"section-heading\"><div><p class=\"eyebrow\">BUGÜNKÜ YÖNÜM</p><h2>Öğrenme hedeflerim</h2></div><p>Tamamlanmış başarılar değil, ilerlemek istediğim çalışma başlıkları.</p></div><ol class=\"process-list\"><li><strong>01 · Öğren</strong><span>Dersler ve alıştırmalarla programlama ve web temellerini güçlendir.</span></li><li><strong>02 · Uygula</strong><span>Yeni bilgileri küçük projelerde dene ve öğrendiklerini not al.</span></li><li><strong>03 · Keşfet</strong><span>Oyun geliştirmede kullanılan araç ve yöntemleri zamanla tanı.</span></li></ol></section><section class=\"wrap section schedule-section\"><p class=\"eyebrow\">DERS NOTLARI / D&#xD6;NEM &#x130;&#xC7;&#x130;</p><h2>Haftalık ders programı</h2><div class=\"schedule-scroll\" role=\"region\" aria-label=\"Ders programı, yatay kaydırılabilir\" tabindex=\"0\"><table class=\"schedule-table\"><caption>Haftalık ders saatleri</caption><thead><tr><th scope=\"col\">Gün</th><th scope=\"col\" data-field=\"schedule-time-0\">09:00–10:50</th><th scope=\"col\" data-field=\"schedule-time-1\">11:00–12:50</th><th scope=\"col\" data-field=\"schedule-time-2\">14:00–15:50</th></tr></thead><tbody><tr><th scope=\"row\">Pazartesi</th><td data-field=\"course-0-0-tr\">—</td><td data-field=\"course-0-1-tr\">—</td><td data-field=\"course-0-2-tr\">—</td></tr><tr><th scope=\"row\">Salı</th><td data-field=\"course-1-0-tr\">—</td><td data-field=\"course-1-1-tr\">—</td><td data-field=\"course-1-2-tr\">—</td></tr><tr><th scope=\"row\">Çarşamba</th><td data-field=\"course-2-0-tr\">—</td><td data-field=\"course-2-1-tr\">—</td><td data-field=\"course-2-2-tr\">—</td></tr><tr><th scope=\"row\">Perşembe</th><td data-field=\"course-3-0-tr\">—</td><td data-field=\"course-3-1-tr\">—</td><td data-field=\"course-3-2-tr\">—</td></tr><tr><th scope=\"row\">Cuma</th><td data-field=\"course-4-0-tr\">—</td><td data-field=\"course-4-1-tr\">—</td><td data-field=\"course-4-2-tr\">—</td></tr></tbody></table></div></section><section class=\"wrap section feature\"><div class=\"panel\"><p class=\"eyebrow\">MERAK ALANLARI</p><h2>İlgi alanları</h2><h3>İlgi alanlarım</h3><ul><li>Web tasarımı</li><li>Dijital çizim</li><li>Teknoloji</li></ul><h3>Öğrenme önceliklerim</h3><ol><li>HTML5</li><li>CSS3</li><li>JavaScript</li></ol></div><div class=\"panel\"><p class=\"eyebrow\">&#xD6;&#x11f;RENME G&#xDC;NDEM&#x130;</p><h2>Geli&#x15F;tirdi&#x11f;im beceriler</h2><div class=\"skill\"><div class=\"skillhead\"><strong>HTML5</strong><span data-field=\"skill-0\">Öğreniyorum</span></div><div class=\"track\" aria-hidden=\"true\" hidden><div class=\"fill\" data-skill-fill=\"0\" style=\"width: 0%;\"></div></div></div><div class=\"skill\"><div class=\"skillhead\"><strong>CSS3</strong><span data-field=\"skill-1\">Öğreniyorum</span></div><div class=\"track\" aria-hidden=\"true\" hidden><div class=\"fill\" data-skill-fill=\"1\" style=\"width: 0%;\"></div></div></div><div class=\"skill\"><div class=\"skillhead\"><strong>JavaScript</strong><span data-field=\"skill-2\">Keşfediyorum</span></div><div class=\"track\" aria-hidden=\"true\" hidden><div class=\"fill\" data-skill-fill=\"2\" style=\"width: 0%;\"></div></div></div><div class=\"skill\"><div class=\"skillhead\"><strong>Design</strong><span data-field=\"skill-3\">Keşfediyorum</span></div><div class=\"track\" aria-hidden=\"true\" hidden><div class=\"fill\" data-skill-fill=\"3\" style=\"width: 0%;\"></div></div></div></div></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">BİR SONRAKİ SAYFA</p><h2>Her fikir<br/><em>bir merhaba ile başlar.</em></h2></div><a class=\"footer-arrow\" href=\"iletisim.html\" aria-label=\"İletişime geç\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Kod. Merak. Yeni dünyalar.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Öğrenci portfolyosu · HTML5 ve CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Yönetici paneli</a> · <a href=\"kaynak.txt\">Kaynaklar</a></span></div></div></footer></body></html>","projeler.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"tr\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>Projelerim | Onur Can Orhan</title><meta content=\"Oyunlarım, masaüstü uygulamalarım ve grafik tasarım çalışmalarım.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"tr_TR\"/><meta property=\"og:title\" content=\"Projelerim | Onur Can Orhan\"/><meta property=\"og:description\" content=\"Grafik Animasyon 1 dersi için hazırladığım veya örnek olarak incelediğim çalışmalar.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/projeler.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"assets/js/site.js\"></script><script defer=\"\" src=\"assets/js/enhancements.js\"></script><script defer src=\"assets/js/cinematic.js\"></script><script defer src=\"assets/js/projects-extra.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"images/logo.svg\"/></head><body class=\"page-projects\"><a class=\"skip\" href=\"#main\">İçeriğe geç</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Anasayfa\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menü</button><nav aria-label=\"Ana menü\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Anasayfa</a><a href=\"hakkimda.html\">Hakkımda</a><a aria-current=\"page\" href=\"projeler.html\">Projeler</a><a href=\"blog.html\">Blog</a><a href=\"galeri.html\">Galeri</a><a href=\"iletisim.html\">İletişim</a><a class=\"lang\" hreflang=\"en\" href=\"en/projects.html\" lang=\"en\">EN</a><button aria-label=\"Temayı değiştir\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\" data-page-number=\"02\"><p class=\"eyebrow\">02 / FİKİRDEN ETKİLEŞİME</p><h1>Projelerim</h1><p class=\"lead\">Space Survivor bu portfolyodaki oynanabilir projem. Di&#x11f;er kartlar ise tamamlanm&#x131;&#x15F; i&#x15F;ler de&#x11f;il, geli&#x15F;tirmeyi d&#xFC;&#x15F;&#xFC;nd&#xFC;&#x11f;&#xFC;m tasar&#x131;m fikirleridir.</p></section><section class=\"wrap section\"><h2>Projeler ve çalışmalar</h2><div class=\"project-filters\" role=\"group\" aria-label=\"Proje kategorileri\"><button type=\"button\" class=\"project-filter active\" data-filter=\"all\" aria-pressed=\"true\">Tümü</button><span class=\"project-filter-options\"></span></div><p class=\"project-empty\" hidden>Bu kategoride proje bulunmuyor.</p><div class=\"grid tiles phantom-tiles\"><!-- PROJECTS:START --><article data-project-id=\"4\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">04</span><img data-image=\"project-4\" src=\"assets/img/komur-cover.svg\" alt=\"Kömür masaüstü kedisi illüstrasyonu\" width=\"1000\" height=\"650\" loading=\"lazy\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-4-category-tr\">Masaüstü Uygulaması</p><h3 data-field=\"project-4-title-tr\">Kömür</h3><p data-field=\"project-4-desc-tr\">Yerel AI, isteğe bağlı ses, hafıza ve günlük işler için Python masaüstü kedisi.</p><a class=\"btn ghost project-open\" href=\"komur.html\">Proje ve indirmeler</a><details class=\"project-case\"><summary>Süreç ve sonuç</summary><div class=\"case-sections\"><section><h4>Teknolojiler</h4><p>Python, Tkinter, Pillow, SQLite, Ollama, PyInstaller, Inno Setup.</p></section><section><h4>Sürüm</h4><p>1.1.0 · Windows 10/11 x64.</p></section><section><h4>Token</h4><p>Toplam geliştirme tüketimi bilinmiyor; doğrulanabilir toplam kayıt bulunmuyor.</p></section></div></details></div></article><article id=\"project-1\" data-project-id=\"1\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">01</span><img alt=\"Space Survivor oyun ekranı\" data-image=\"project-1\" loading=\"eager\" fetchpriority=\"high\" src=\"oyun/tanitim-gorseli.png\" width=\"1440\" height=\"900\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-1-category-tr\">Oyun</p><h3 data-field=\"project-1-title-tr\">Space Survivor</h3><p data-field=\"project-1-desc-tr\">Tarayıcıda oynanabilen, HTML5 Canvas ve JavaScript ile geliştirilmiş uzay temalı oyun denemem.</p><a class=\"btn ghost project-open\" href=\"oyun/index.html\">Oyunu Oyna</a><details class=\"project-case\"><summary>Süreç ve sonuç</summary><div class=\"case-sections\"><section><h4>Amaç</h4><p data-field=\"project-1-purpose-tr\">Tarayıcıda oynanabilen bir uzay hayatta kalma oyunu geliştirmek.</p></section><section><h4>Kullanılan teknolojiler</h4><p data-field=\"project-1-tech-tr\">HTML5 Canvas, CSS3 ve JavaScript.</p></section><section><h4>Uygulama aşamaları</h4><p data-field=\"project-1-steps-tr\">Oyun alanı ve arayüz; klavye ve dokunmatik kontroller; düşman dalgaları, çarpışma ve skor sistemi.</p></section><section><h4>Sonuç / mevcut durum</h4><p data-field=\"project-1-result-tr\">Space Survivor bu sitede oynanabilir. Skor, duraklatma ve yeniden başlatma işlevleri bulunur.</p></section><section><h4>Karşılaşılan sorunlar</h4><p data-field=\"project-1-challenges-tr\">Geliştirme sırasında karşılaşılan sorunlar henüz belgelenmedi.</p></section></div></details><div class=\"project-gallery-source\" hidden><img data-image=\"project-1-detail-1\" src=\"assets/img/comparison-placeholder.svg\" alt=\"Ek proje görseli 1\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/><img data-image=\"project-1-detail-2\" src=\"assets/img/comparison-placeholder.svg\" alt=\"Ek proje görseli 2\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/></div></div></article><article id=\"project-2\" data-project-id=\"2\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">02</span><img alt=\"Hareketli Tipografi\" data-image=\"project-2\" loading=\"lazy\" src=\"assets/img/project-2.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-2-category-tr\">Grafik Tasarım</p><h3 data-field=\"project-2-title-tr\">Hareketli Tipografi</h3><p data-field=\"project-2-desc-tr\">Animasyon ilkeleri ve yazı hareketleri için örnek proje kartı.</p><details class=\"project-case\"><summary>Süreç ve sonuç</summary><div class=\"case-sections\"><section><h4>Amaç</h4><p data-field=\"project-2-purpose-tr\">Yazı hareketleri ve animasyon ilkelerini incelemek için ayrılmış örnek çalışma.</p></section><section><h4>Kullanılan teknolojiler</h4><p data-field=\"project-2-tech-tr\">Henüz uygulama aracı veya teknoloji seçilmedi.</p></section><section><h4>Uygulama aşamaları</h4><p data-field=\"project-2-steps-tr\">Planlanan sıra: referans inceleme, storyboard, hareket denemeleri ve değerlendirme.</p></section><section><h4>Sonuç / mevcut durum</h4><p data-field=\"project-2-result-tr\">Bu kart bir örnektir. Tamamlanmış bir animasyon veya teslim edilmiş çalışma göstermez.</p></section><section><h4>Karşılaşılan sorunlar</h4><p data-field=\"project-2-challenges-tr\">Uygulama sorunu bildirilmiyor: bu kart henüz bir örnek çalışma alanıdır.</p></section></div></details><div class=\"project-gallery-source\" hidden><img data-image=\"project-2-detail-1\" src=\"assets/img/comparison-placeholder.svg\" alt=\"Ek proje görseli 1\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/><img data-image=\"project-2-detail-2\" src=\"assets/img/comparison-placeholder.svg\" alt=\"Ek proje görseli 2\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/></div></div></article><article id=\"project-3\" data-project-id=\"3\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">03</span><img alt=\"Dijital İllüstrasyon\" data-image=\"project-3\" loading=\"lazy\" src=\"assets/img/project-3.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-3-category-tr\">Grafik Tasarım</p><h3 data-field=\"project-3-title-tr\">Dijital İllüstrasyon</h3><p data-field=\"project-3-desc-tr\">Katmanlar ve renk uyumu üzerine örnek proje kartı.</p><details class=\"project-case\"><summary>Süreç ve sonuç</summary><div class=\"case-sections\"><section><h4>Amaç</h4><p data-field=\"project-3-purpose-tr\">Katman ve renk uyumunu incelemek için ayrılmış örnek çalışma.</p></section><section><h4>Kullanılan teknolojiler</h4><p data-field=\"project-3-tech-tr\">Henüz uygulama aracı veya teknoloji seçilmedi.</p></section><section><h4>Uygulama aşamaları</h4><p data-field=\"project-3-steps-tr\">Planlanan sıra: eskiz, renk paleti, katman düzeni ve değerlendirme.</p></section><section><h4>Sonuç / mevcut durum</h4><p data-field=\"project-3-result-tr\">Bu kart bir örnektir. Gerçek proje görseli ve çalışma süreci henüz eklenmedi.</p></section><section><h4>Karşılaşılan sorunlar</h4><p data-field=\"project-3-challenges-tr\">Uygulama sorunu bildirilmiyor: bu kart henüz bir örnek çalışma alanıdır.</p></section></div></details><div class=\"project-gallery-source\" hidden><img data-image=\"project-3-detail-1\" src=\"assets/img/comparison-placeholder.svg\" alt=\"Ek proje görseli 1\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/><img data-image=\"project-3-detail-2\" src=\"assets/img/comparison-placeholder.svg\" alt=\"Ek proje görseli 2\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/></div></div></article><!-- PROJECTS:END --></div></section><section class=\"wrap section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">Y&#xD6;NTEM / K&#xDC;&#xC7;&#xDC;K ADIMLAR</p><h2>Bir fikri nas&#x131;l geli&#x15F;tiriyorum?</h2></div><p>Bu, izlemeyi hedefledi&#x11f;im s&#xFC;re&#xE7;tir; her ad&#x131;m t&#xFC;m projelerde tamamlanm&#x131;&#x15F; de&#x11f;ildir.</p></div><ol class=\"process-list\"><li><strong>01 &#xB7; Ara&#x15F;t&#x131;r</strong><span>Konuyu netle&#x15F;tir ve &#xF6;rneklere bak.</span></li><li><strong>02 &#xB7; Taslakla</strong><span>Aray&#xFC;z veya g&#xF6;rsel dili k&#xFC;&#xE7;&#xFC;k denemelerle kur.</span></li><li><strong>03 &#xB7; Uygula</strong><span>&#xD6;&#x11f;rendiklerini &#xE7;al&#x131;&#x15F;an bir prototipe d&#xF6;n&#xFC;&#x15F;t&#xFC;r.</span></li><li><strong>04 &#xB7; G&#xF6;zden ge&#xE7;ir</strong><span>Sonucu kontrol et, eksikleri not al ve sonraki ad&#x131;m&#x131; belirle.</span></li></ol></section><section class=\"wrap section\" aria-labelledby=\"comparison-title\"><p class=\"eyebrow\">GÖRSEL SÜREÇ</p><h2 id=\"comparison-title\">Photoshop: önce / sonra</h2><p class=\"comparison-note\" data-comparison-note>Hazırlık alanı: henüz gerçek Photoshop projesi eklenmedi. Görseller yer tutucudur; tamamlanmış çalışma göstermez.</p><figure class=\"comparison\" data-comparison><div class=\"comparison-stage\"><img class=\"compare-after\" data-image=\"project-compare-after\" src=\"assets/img/comparison-placeholder.svg\" alt=\"Düzenleme sonrası görseli; yer tutucu\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/><img class=\"compare-before\" data-image=\"project-compare-before\" src=\"assets/img/comparison-placeholder.svg\" alt=\"Düzenleme öncesi orijinal görsel; yer tutucu\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/><span class=\"compare-divider\" aria-hidden=\"true\"></span><span class=\"compare-tag before\" aria-hidden=\"true\">Önce</span><span class=\"compare-tag after\" aria-hidden=\"true\">Sonra</span></div><figcaption><span data-field=\"project-compare-caption-tr\">Orijinal görseller hazır olduğunda gerçek düzenleme sürecini belgelemek için ayrılmış alan.</span></figcaption><div class=\"comparison-control\" hidden><label for=\"compare-range\">Önce görselinin görünürlük oranı</label><input id=\"compare-range\" type=\"range\" min=\"0\" max=\"100\" value=\"50\" step=\"1\" aria-describedby=\"compare-help\"/><p id=\"compare-help\" class=\"note\">Sürgüyü sürükleyin veya ok tuşlarını kullanın. Home: yalnızca sonra. End: yalnızca önce.</p></div></figure></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">BİR SONRAKİ SAYFA</p><h2>Her fikir<br/><em>bir merhaba ile başlar.</em></h2></div><a class=\"footer-arrow\" href=\"iletisim.html\" aria-label=\"İletişime geç\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Kod. Merak. Yeni dünyalar.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Öğrenci portfolyosu · HTML5 ve CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Yönetici paneli</a> · <a href=\"kaynak.txt\">Kaynaklar</a></span></div></div></footer></body></html>","galeri.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"tr\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>Görsel çalışmalar | Onur Can Orhan</title><meta content=\"Çizim, oyun dünyaları ve sinema üzerine üç soyut görsel çalışma.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"tr_TR\"/><meta property=\"og:title\" content=\"Görsel çalışmalar | Onur Can Orhan\"/><meta property=\"og:description\" content=\"Çizim, oyun dünyaları ve sinema üzerine üç soyut görsel çalışma.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/galeri.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"assets/js/site.js\"></script><script defer=\"\" src=\"assets/js/enhancements.js\"></script><script defer src=\"assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"images/logo.svg\"/></head><body class=\"page-gallery\"><a class=\"skip\" href=\"#main\">İçeriğe geç</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Anasayfa\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menü</button><nav aria-label=\"Ana menü\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Anasayfa</a><a href=\"hakkimda.html\">Hakkımda</a><a href=\"projeler.html\">Projeler</a><a href=\"blog.html\">Blog</a><a aria-current=\"page\" href=\"galeri.html\">Galeri</a><a href=\"iletisim.html\">İletişim</a><a class=\"lang\" hreflang=\"en\" href=\"en/gallery.html\" lang=\"en\">EN</a><button aria-label=\"Temayı değiştir\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\" data-page-number=\"03\"><p class=\"eyebrow\">03 / KİŞİSEL BİR BAKIŞ</p><h1>Görsel çalışmalar</h1><p class=\"lead\">Çizim, oyun dünyaları ve sinema üzerine üç soyut görsel çalışma.</p></section><section class=\"wrap section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">G&#xD6;RSEL DEFTER&#x130; / 03 &#xC7;ALI&#x15E;MA</p><h2>G&#xF6;rsel &#xE7;al&#x131;&#x15F;malar ? konsept eskizleri</h2></div><p>&#xC7;izim, oyun d&#xFC;nyalar&#x131; ve sinema dilinden esinlenen &#xF6;zg&#xFC;n soyut ill&#xFC;strasyonlar.</p></div><div class=\"grid gallery\"><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Çizim · eskiz defteri\" data-image=\"gallery-1\" loading=\"lazy\" src=\"assets/img/gallery-1.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-1-title-tr\">Çizim · eskiz defteri</h3><p data-field=\"gallery-1-desc-tr\">Çizim ve eskiz pratiğinden esinlenen soyut bir çalışma.</p></div></article><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Oyun dünyaları · renk ve atmosfer\" data-image=\"gallery-2\" loading=\"lazy\" src=\"assets/img/gallery-2.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-2-title-tr\">Oyun dünyaları · renk ve atmosfer</h3><p data-field=\"gallery-2-desc-tr\">Çizim ve eskiz pratiğinden esinlenen soyut bir çalışma.</p></div></article><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Sinema · ışık ve kadraj\" data-image=\"gallery-3\" loading=\"lazy\" src=\"assets/img/gallery-3.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-3-title-tr\">Sinema · ışık ve kadraj</h3><p data-field=\"gallery-3-desc-tr\">Çizim ve eskiz pratiğinden esinlenen soyut bir çalışma.</p></div></article></div></section><section class=\"wrap section\"><h2>Bu çalışmalar hakkında</h2><p>Bu soyut illüstrasyonlar portfolyo için hazırlanmış görsel çalışmalardır; kişisel fotoğraf veya tamamlanmış ders teslimi değildir.</p></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">BİR SONRAKİ SAYFA</p><h2>Her fikir<br/><em>bir merhaba ile başlar.</em></h2></div><a class=\"footer-arrow\" href=\"iletisim.html\" aria-label=\"İletişime geç\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Kod. Merak. Yeni dünyalar.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Öğrenci portfolyosu · HTML5 ve CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Yönetici paneli</a> · <a href=\"kaynak.txt\">Kaynaklar</a></span></div></div></footer></body></html>","blog.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"tr\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>Teknoloji blogum | Onur Can Orhan</title><meta content=\"HTML, CSS ve yaz&#x131;l&#x131;m ara&#xE7;lar&#x131; hakk&#x131;nda &#xF6;&#x11f;renme notlar&#x131;.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"tr_TR\"/><meta property=\"og:title\" content=\"Teknoloji blogum | Onur Can Orhan\"/><meta property=\"og:description\" content=\"HTML, CSS ve yaz&#x131;l&#x131;m ara&#xE7;lar&#x131; hakk&#x131;nda &#xF6;&#x11f;renme notlar&#x131;.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/blog.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"assets/js/site.js\"></script><script defer=\"\" src=\"assets/js/enhancements.js\"></script><script defer src=\"assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"images/logo.svg\"/></head><body class=\"page-blog\"><a class=\"skip\" href=\"#main\">İçeriğe geç</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Anasayfa\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menü</button><nav aria-label=\"Ana menü\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Anasayfa</a><a href=\"hakkimda.html\">Hakkımda</a><a href=\"projeler.html\">Projeler</a><a aria-current=\"page\" href=\"blog.html\">Blog</a><a href=\"galeri.html\">Galeri</a><a href=\"iletisim.html\">İletişim</a><a class=\"lang\" hreflang=\"en\" href=\"en/blog.html\" lang=\"en\">EN</a><button aria-label=\"Temayı değiştir\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\" data-page-number=\"04\"><p class=\"eyebrow\">04 / ÖĞRENME YOLCULUĞUNDAN NOTLAR</p><h1>Teknoloji blogum</h1><p class=\"lead\">HTML, CSS ve yaz&#x131;l&#x131;m ara&#xE7;lar&#x131; &#xFC;zerine okuduklar&#x131;m&#x131; k&#x131;sa, uygulanabilir notlara d&#xF6;n&#xFC;&#x15F;t&#xFC;r&#xFC;yorum.</p><p class=\"eyebrow page-intro\">&#xD6;&#x11f;RENME NOTLARI / WEB / ARA&#xC7;LAR</p></section><nav class=\"wrap journal-index\" aria-label=\"Yazı dizini\"><a href=\"#article-1\"><span>01</span>HTML5 ve Semantik Web Tasarımı<span aria-hidden=\"true\">↘</span></a><a href=\"#article-2\"><span>02</span>CSS3 ile Responsive Tasarım<span aria-hidden=\"true\">↘</span></a><a href=\"#article-3\"><span>03</span>Yazılım Geliştirmede Yapay Zekâ<span aria-hidden=\"true\">↘</span></a></nav><section class=\"wrap section journal\"><div class=\"section-heading\"><div><p class=\"eyebrow\">OKUMA L&#x130;STES&#x130; / 03 KONU</p><h2>&#xD6;&#x11f;renme notlar&#x131;</h2></div><p>Bu yaz&#x131;lar ba&#x15F;lang&#x131;&#xE7; d&#xFC;zeyi konu &#xF6;zetleridir; uzmanl&#x131;k iddias&#x131; ta&#x15F;&#x131;maz.</p></div><article class=\"card article\" id=\"article-1\"><div class=\"visual image\"><img alt=\"HTML5 ve Semantik Web Tasarımı konu görseli\" src=\"assets/img/blog-html.svg\" width=\"1000\" height=\"650\" decoding=\"async\" loading=\"lazy\"/></div><div class=\"inner content\"><h2 data-field=\"blog-1-title-tr\">HTML5 ve Semantik Web Tasarımı</h2><p data-field=\"blog-1-intro-tr\">HTML5, bir sayfanın yalnızca nasıl göründüğünü değil, içeriğinin ne anlama geldiğini de tanımlamayı sağlar.</p><h3>Temel kavramlar</h3><p data-field=\"blog-1-p1-tr\">header, nav, main, article ve footer gibi semantik etiketler sayfanın bölümlerini belirginleştirir. Bu, erişilebilirlik teknolojileri ve arama motorları için içeriğin anlaşılmasını kolaylaştırır.</p><h3>Uygulama ve iyi pratikler</h3><p data-field=\"blog-1-p2-tr\">İyi bir HTML sayfasında başlık hiyerarşisi tutarlı olmalıdır. Bir h1 ana konuyu anlatırken h2 başlıkları alt bölümleri ayırır. Form etiketleri alanları açıkça tanımlamalı; görsellerin alt metinleri amacını belirtmelidir.</p><h3>Sonuç</h3><p data-field=\"blog-1-p3-tr\">Örneğin bir portfolyo sayfasında nav ana menüyü, main asıl içeriği, article ise bağımsız bir blog yazısını temsil edebilir. Semantik HTML, CSS olmasa bile anlamlı kalan bir yapı kurar.</p></div></article><article class=\"card article\" id=\"article-2\"><div class=\"visual image\"><img alt=\"CSS3 ile Responsive Tasarım konu görseli\" src=\"assets/img/blog-css.svg\" width=\"1000\" height=\"650\" decoding=\"async\" loading=\"lazy\"/></div><div class=\"inner content\"><h2 data-field=\"blog-2-title-tr\">CSS3 ile Responsive Tasarım</h2><p data-field=\"blog-2-intro-tr\">Responsive tasarım, bir sitenin farklı ekran genişliklerinde okunabilir ve kullanılabilir olmasını amaçlar.</p><h3>Temel kavramlar</h3><p data-field=\"blog-2-p1-tr\">CSS Grid çok sütunlu kart düzenleri için, Flexbox ise menüler ve tek boyutlu hizalamalar için kullanışlıdır. Media query kuralları ekran daraldığında sütun sayısını veya navigasyon davranışını değiştirebilir.</p><h3>Uygulama ve iyi pratikler</h3><p data-field=\"blog-2-p2-tr\">Sabit genişlikler yerine max-width, yüzde ve clamp gibi esnek ölçüler kullanmak taşmayı azaltır. Mobilde dokunmatik hedefler yeterince büyük olmalı, metinler yatay kaydırma gerektirmemelidir.</p><h3>Sonuç</h3><p data-field=\"blog-2-p3-tr\">Bu projede masaüstünde üç sütunlu olan kartlar tablette ikiye, telefonda bire iner. Bu davranış tasarımın yalnızca küçültülmesi değil, içeriğin yeniden düzenlenmesidir.</p></div></article><article class=\"card article\" id=\"article-3\"><div class=\"visual image\"><img alt=\"Yazılım Geliştirmede Yapay Zekâ konu görseli\" src=\"assets/img/blog-ai.svg\" width=\"1000\" height=\"650\" decoding=\"async\" loading=\"lazy\"/></div><div class=\"inner content\"><h2 data-field=\"blog-3-title-tr\">Yazılım Geliştirmede Yapay Zekâ</h2><p data-field=\"blog-3-intro-tr\">Yapay zekâ araçları kod üretimi, açıklama, hata ayıklama ve test senaryosu hazırlamada yardımcı olabilir.</p><h3>Temel kavramlar</h3><p data-field=\"blog-3-p1-tr\">Bir modelin önerdiği kod doğrudan doğru kabul edilmemelidir. Üretilen kod gözden geçirilmeli, bağımlılıklar incelenmeli ve otomatik testler çalıştırılmalıdır.</p><h3>Uygulama ve iyi pratikler</h3><p data-field=\"blog-3-p2-tr\">Geliştirici, araca açık gereksinimler vererek daha iyi sonuç alabilir. Örneğin “mobil uyumlu bir menü yaz” demek yerine klavye erişimi, ekran boyutları ve hata durumları da belirtilmelidir.</p><h3>Sonuç</h3><p data-field=\"blog-3-p3-tr\">Yapay zekâ verimliliği artırabilir ancak doğrulama sorumluluğunu ortadan kaldırmaz. Özellikle güvenlik, kişisel veriler ve gerçek dışı içerikler dikkatle değerlendirilmelidir.</p></div></article></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">BİR SONRAKİ SAYFA</p><h2>Her fikir<br/><em>bir merhaba ile başlar.</em></h2></div><a class=\"footer-arrow\" href=\"iletisim.html\" aria-label=\"İletişime geç\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Kod. Merak. Yeni dünyalar.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Öğrenci portfolyosu · HTML5 ve CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Yönetici paneli</a> · <a href=\"kaynak.txt\">Kaynaklar</a></span></div></div></footer></body></html>","iletisim.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"tr\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>İletişim | Onur Can Orhan</title><meta content=\"Benimle iletişime geçmek için bilgileri ve örnek formu kullanabilirsiniz.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"tr_TR\"/><meta property=\"og:title\" content=\"İletişim | Onur Can Orhan\"/><meta property=\"og:description\" content=\"Benimle iletişime geçmek için bilgileri ve örnek formu kullanabilirsiniz.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/iletisim.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"assets/js/site.js?v=contact-20261113\"></script><script defer=\"\" src=\"assets/js/enhancements.js\"></script><script defer src=\"assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"images/logo.svg\"/></head><body class=\"page-contact\"><a class=\"skip\" href=\"#main\">İçeriğe geç</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Anasayfa\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menü</button><nav aria-label=\"Ana menü\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Anasayfa</a><a href=\"hakkimda.html\">Hakkımda</a><a href=\"projeler.html\">Projeler</a><a href=\"blog.html\">Blog</a><a href=\"galeri.html\">Galeri</a><a aria-current=\"page\" href=\"iletisim.html\">İletişim</a><a class=\"lang\" hreflang=\"en\" href=\"en/contact.html\" lang=\"en\">EN</a><button aria-label=\"Temayı değiştir\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\" data-page-number=\"05\"><p class=\"eyebrow\">05 / BİR MERHABA İLE BAŞLAR</p><h1>İletişim</h1><p class=\"lead\">Bir proje veya iş birliği fikrin mi var? Aşağıdaki formdan bana yazabilirsin.</p><p class=\"eyebrow page-intro\">&#x130;LET&#x130;&#x15E;&#x130;M / &#xD6;&#x11f;RENC&#x130; PORTFOLYOSU</p></section><section class=\"wrap section feature\"><div class=\"panel\"><h2>İletişim bilgileri</h2><p><strong>Adres:</strong> <span data-field=\"address-tr\">Antalya, Türkiye</span></p><p><strong>Telefon:</strong> <a class=\"contact-link\" data-contact-link=\"phone\" href=\"tel:+905412608920\"><span data-field=\"phone\">+90 541 260 89 20</span><span aria-hidden=\"true\">↗</span></a></p><p><strong>E-mail:</strong> <a class=\"contact-link\" data-contact-link=\"email\" href=\"mailto:onurcan147258@gmail.com\"><span data-field=\"email\">onurcan147258@gmail.com</span><span aria-hidden=\"true\">↗</span></a></p></div><div class=\"panel\"><h2>İletişim formu</h2><p class=\"note\">Mesajın özel gelen kutuma iletilir.</p><form data-contact-form=\"\"><label for=\"name\">Ad soyad</label><input autocomplete=\"name\" id=\"name\" maxlength=\"100\" name=\"name\" required=\"\"/><label for=\"email\">E-posta</label><input autocomplete=\"email\" id=\"email\" name=\"email\" required=\"\" type=\"email\"/><label for=\"subject\">Konu</label><input id=\"subject\" maxlength=\"150\" name=\"subject\" required=\"\"/><label for=\"message\">Mesaj</label><textarea id=\"message\" minlength=\"10\" name=\"message\" required=\"\" maxlength=\"5000\"></textarea><button class=\"btn\" type=\"submit\">Mesaj gönder</button><p id=\"form-status\" role=\"status\"></p><div hidden aria-hidden=\"true\"><input name=\"website\" tabindex=\"-1\" autocomplete=\"off\"></div></form></div></section><section class=\"wrap section\"><h2>Gizlilik notu</h2><p>Adın, e-posta adresin ve mesajın talebine yanıt vermek için saklanır. Mesajları yalnızca site yöneticisi görebilir.</p></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">BİR SONRAKİ SAYFA</p><h2>Her fikir<br/><em>bir merhaba ile başlar.</em></h2></div><a class=\"footer-arrow\" href=\"iletisim.html\" aria-label=\"İletişime geç\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Kod. Merak. Yeni dünyalar.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Öğrenci portfolyosu · HTML5 ve CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Yönetici paneli</a> · <a href=\"kaynak.txt\">Kaynaklar</a></span></div></div></footer></body></html>","en/index.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"en\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>Home | Onur Can Orhan</title><meta content=\"I enjoy technology, design and new ideas. This website introduces my interests and projects.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"en_US\"/><meta property=\"og:title\" content=\"Home | Onur Can Orhan\"/><meta property=\"og:description\" content=\"I enjoy technology, design and new ideas. This website introduces my interests and projects.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/en/index.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"../assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"../assets/js/site.js\"></script><script defer=\"\" src=\"../assets/js/enhancements.js\"></script><script defer src=\"../assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"../images/logo.svg\"/></head><body class=\"page-home\"><a class=\"skip\" href=\"#main\">Skip to content</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Home\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menu</button><nav aria-label=\"Main navigation\" class=\"navlinks\" id=\"primary-nav\"><a aria-current=\"page\" href=\"index.html\">Home</a><a href=\"about.html\">About</a><a href=\"projects.html\">Projects</a><a href=\"blog.html\">Blog</a><a href=\"gallery.html\">Gallery</a><a href=\"contact.html\">Contact</a><a class=\"lang\" hreflang=\"tr\" href=\"../index.html\" lang=\"tr\">TR</a><button aria-label=\"Toggle theme\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"hero cinematic-hero\" aria-labelledby=\"hero-heading\"><div class=\"hero-atmosphere\" aria-hidden=\"true\"><span class=\"light light-one\"></span><span class=\"light light-two\"></span><div class=\"hero-grid\"></div></div><div class=\"wrap hero-layout\"><div class=\"hero-copy\"><p class=\"eyebrow hero-status\"><span aria-hidden=\"true\"></span>STUDENT PORTFOLIO · ANTALYA, TR</p><p class=\"hero-identity\">ONUR CAN ORHAN <span>/ PORTFOLIO 2026</span></p><h1 id=\"hero-heading\">Curiosity.<br/>Code.<br/><em>New worlds.</em></h1><p class=\"hero-tagline\" data-field=\"hero-title-en\">Every line of code is the beginning of a new world.</p><p class=\"lead\" data-field=\"hero-subtitle-en\">Onur Can Orhan · Computer Programming student · Aspiring game developer</p><div class=\"actions\"><a class=\"btn\" href=\"projects.html\">Explore my projects <span aria-hidden=\"true\">↗</span></a><a class=\"btn ghost\" href=\"about.html\">About me <span aria-hidden=\"true\">→</span></a></div></div><div class=\"hero-world\" aria-hidden=\"true\"><div class=\"network-halo\"></div><canvas id=\"heroSculpture\"></canvas><div class=\"network-cross cross-one\">+</div><div class=\"network-cross cross-two\">+</div><div class=\"network-label\"><span class=\"network-live\"></span> SYSTEM / EXPLORING</div><div class=\"network-coordinate\">36.89 N<br/>30.70 E</div><div class=\"network-caption\"><span>01 / DIGITAL EXPLORATION</span><strong>Ideas have no boundaries.</strong></div><div class=\"network-axis\"><span>X</span><i></i><span>Y</span></div></div></div><div class=\"wrap hero-rail\"><a href=\"#selected-work\">SCROLL TO EXPLORE <span aria-hidden=\"true\">↓</span></a><span>PYTHON <i>/</i> CSS <i>/</i> GAME DEVELOPMENT</span></div></section><div class=\"discipline-strip\" aria-label=\"Areas of interest\"><div class=\"wrap\"><span>WEB DEVELOPMENT</span><i aria-hidden=\"true\">+</i><span>CREATIVE CODING</span><i aria-hidden=\"true\">+</i><span>GAME DESIGN</span><i aria-hidden=\"true\">+</i><span>ALWAYS LEARNING</span></div></div><section class=\"wrap section home-intro\"><div class=\"intro-heading\"><p class=\"eyebrow\">CODE &times; CREATIVITY</p><h2>Start with curiosity.<br/>Grow by creating.</h2></div><p class=\"lead\" data-field=\"bio-short-en\">Onur Can Orhan Computer Programming Student | Aspiring Game Developer Exploring the intersection of technology and creativity. Currently learning Python and CSS, with the goal of developing my own video games.</p></section><section class=\"wrap section home-projects editorial-work\" id=\"selected-work\"><div class=\"section-heading\"><div><p class=\"eyebrow\">01 / SELECTED WORK</p><h2>Selected<br/><em>work.</em></h2></div><p>Games, experiments and visual explorations<br/>from my learning journey.</p></div><div class=\"grid tiles phantom-tiles\"><!-- PROJECTS:START --><article data-project-id=\"4\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">04</span><img data-image=\"project-4\" src=\"../assets/img/komur-cover.svg\" alt=\"Kömür desktop cat illustration\" width=\"1000\" height=\"650\" loading=\"lazy\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-4-category-en\">Desktop application</p><h3 data-field=\"project-4-title-en\">Kömür</h3><p data-field=\"project-4-desc-en\">A Python desktop cat with local AI, optional voice, memory and everyday assistance.</p><a class=\"btn ghost project-open\" href=\"komur.html\">Project and downloads</a></div></article><article data-project-id=\"1\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">01</span><img alt=\"Space Survivor browser game screen\" data-image=\"project-1\" loading=\"lazy\" src=\"../oyun/tanitim-gorseli.png\" width=\"1440\" height=\"900\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-1-category-en\">Game</p><h3 data-field=\"project-1-title-en\">Space Survivor</h3><p data-field=\"project-1-desc-en\">A playable space-themed browser game built with HTML5 Canvas and JavaScript.</p><a class=\"btn ghost project-open\" href=\"../oyun/index.html\">Play Game</a></div></article><article data-project-id=\"2\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">02</span><img alt=\"Kinetic Typography\" data-image=\"project-2\" loading=\"lazy\" src=\"../assets/img/project-2.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-2-category-en\">Graphic Design</p><h3 data-field=\"project-2-title-en\">Kinetic Typography</h3><p data-field=\"project-2-desc-en\">Example project card exploring animation principles and type.</p></div></article><article data-project-id=\"3\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">03</span><img alt=\"Digital Illustration\" data-image=\"project-3\" loading=\"lazy\" src=\"../assets/img/project-3.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-3-category-en\">Graphic Design</p><h3 data-field=\"project-3-title-en\">Digital Illustration</h3><p data-field=\"project-3-desc-en\">Example project card exploring layers and color harmony.</p></div></article><!-- PROJECTS:END --></div><p><a class=\"btn ghost\" href=\"projects.html\">View all</a></p></section><section class=\"wrap section home-journal\"><div class=\"section-heading\"><div><p class=\"eyebrow\">02 / VISUAL JOURNAL</p><h2>A different<br/><em>perspective.</em></h2></div></div><div class=\"grid tiles phantom-tiles\"><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Drawing · sketchbook\" data-image=\"gallery-1\" loading=\"lazy\" src=\"../assets/img/gallery-1.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-1-title-en\">Drawing · sketchbook</h3><p data-field=\"gallery-1-desc-en\">An abstract study inspired by drawing and sketchbook practice.</p></div></article><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Game worlds · colour and atmosphere\" data-image=\"gallery-2\" loading=\"lazy\" src=\"../assets/img/gallery-2.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-2-title-en\">Game worlds · colour and atmosphere</h3><p data-field=\"gallery-2-desc-en\">An abstract study inspired by drawing and sketchbook practice.</p></div></article><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Cinema · light and framing\" data-image=\"gallery-3\" loading=\"lazy\" src=\"../assets/img/gallery-3.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-3-title-en\">Cinema · light and framing</h3><p data-field=\"gallery-3-desc-en\">An abstract study inspired by drawing and sketchbook practice.</p></div></article></div><p><a class=\"btn ghost\" href=\"gallery.html\">View all</a></p></section><section class=\"wrap section focus-section process-section\" aria-labelledby=\"focus-title\"><div><p class=\"eyebrow\">LEARN / BUILD / SHARE</p><h2 id=\"focus-title\">An idea.<br/><em>The next step.</em></h2></div><div class=\"focus-grid\"><article class=\"focus-card\"><span class=\"focus-number\" aria-hidden=\"true\">01</span><h3>Web fundamentals</h3><p>Semantic HTML, responsive CSS and accessible interactions.</p></article><article class=\"focus-card\"><span class=\"focus-number\" aria-hidden=\"true\">02</span><h3>Game development</h3><p>Small browser experiments with JavaScript and Canvas.</p></article><article class=\"focus-card\"><span class=\"focus-number\" aria-hidden=\"true\">03</span><h3>Visual exploration</h3><p>Learning through examples of typography, layers and colour.</p></article></div></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">NEXT CHAPTER</p><h2>Every idea starts<br/><em>with a conversation.</em></h2></div><a class=\"footer-arrow\" href=\"contact.html\" aria-label=\"Contact me\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Code. Curiosity. New worlds.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Student portfolio · HTML5 and CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Admin panel</a> · <a href=\"../kaynak.txt\">Sources</a></span></div></div></footer></body></html>","en/about.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"en\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>About me | Onur Can Orhan</title><meta content=\"My educational journey, interests and skills.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"en_US\"/><meta property=\"og:title\" content=\"About me | Onur Can Orhan\"/><meta property=\"og:description\" content=\"My educational journey, interests and skills.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/en/about.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"../assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"../assets/js/site.js\"></script><script defer=\"\" src=\"../assets/js/enhancements.js\"></script><script defer src=\"../assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"../images/logo.svg\"/></head><body class=\"page-about\"><a class=\"skip\" href=\"#main\">Skip to content</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Home\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menu</button><nav aria-label=\"Main navigation\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Home</a><a aria-current=\"page\" href=\"about.html\">About</a><a href=\"projects.html\">Projects</a><a href=\"blog.html\">Blog</a><a href=\"gallery.html\">Gallery</a><a href=\"contact.html\">Contact</a><a class=\"lang\" hreflang=\"tr\" href=\"../hakkimda.html\" lang=\"tr\">TR</a><button aria-label=\"Toggle theme\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\" data-page-number=\"01\"><p class=\"eyebrow\">01 / THE PERSON BEHIND THE PIXELS</p><h1>About me</h1><p class=\"lead\">I'm a Computer Programming student building my software foundations and exploring the overlap between drawing, games and visual storytelling.</p><p class=\"eyebrow page-intro\">STUDENT / SOFTWARE FOUNDATIONS / INTERESTED IN GAME DEVELOPMENT</p></section><section class=\"wrap section\"><div class=\"profile\"><div class=\"portrait\"><img alt=\"Illustration of a coding and drawing desk\" data-image=\"portrait\" src=\"../media/ca0f9d19-9aba-45cc-8397-46078135933c.png\" width=\"1000\" height=\"650\" decoding=\"async\" loading=\"lazy\"/></div><div class=\"panel\"><h2>Biography</h2><div class=\"bio-copy\" data-field=\"bio-en\">Hello, I’m Onur Can Orhan. I am a first-year Computer Programming student at Akdeniz University. I am learning Python and CSS to build a foundation in programming and web design. I want to reinforce what I learn through small practical exercises. My interests include drawing, video games and films. I am curious about the visual design, storytelling and technical structure of games. In the long term, I hope to combine my technical and visual interests by developing my own game projects.</div></div></div></section><section class=\"wrap section education-section\" aria-labelledby=\"education-title\"><div class=\"section-heading\"><div><p class=\"eyebrow\">LEARNING / 2026</p><h2 id=\"education-title\">My learning journey.</h2><p class=\"lead\">My current focus is strengthening class concepts through small practical exercises.</p></div></div><div class=\"education-grid\"><div class=\"education-marker\" aria-hidden=\"true\">01</div><div><p class=\"eyebrow\">EDUCATION</p><h3 data-field=\"bio-school-en\">Akdeniz University</h3><p data-field=\"bio-degree-en\">Computer Programming · First year</p></div><span class=\"education-tag\">LEARNING IN PROGRESS</span></div></section><section class=\"wrap section learning-path\"><div class=\"section-heading\"><div><p class=\"eyebrow\">CURRENT DIRECTION</p><h2>What I am working towards</h2></div><p>A learning plan, not a list of completed milestones.</p></div><ol class=\"process-list\"><li><strong>01 ? Learn</strong><span>Build programming and web foundations through coursework and practice.</span></li><li><strong>02 ? Make</strong><span>Apply new ideas in small projects and document what I learn.</span></li><li><strong>03 ? Explore</strong><span>Gradually investigate tools and techniques used in game development.</span></li></ol></section><section class=\"wrap section schedule-section\"><p class=\"eyebrow\">CLASS NOTES / CURRENT TERM</p><h2>Weekly timetable</h2><p class=\"note\">The schedule appears here when it has been updated in the content editor.</p><div class=\"schedule-scroll\" role=\"region\" aria-label=\"Weekly timetable, scroll horizontally\" tabindex=\"0\"><table class=\"schedule-table\"><caption>Weekly class times</caption><thead><tr><th scope=\"col\">Day</th><th scope=\"col\" data-field=\"schedule-time-0\">09:00–10:50</th><th scope=\"col\" data-field=\"schedule-time-1\">11:00–12:50</th><th scope=\"col\" data-field=\"schedule-time-2\">14:00–15:50</th></tr></thead><tbody><tr><th scope=\"row\">Monday</th><td data-field=\"course-0-0-en\">—</td><td data-field=\"course-0-1-en\">—</td><td data-field=\"course-0-2-en\">—</td></tr><tr><th scope=\"row\">Tuesday</th><td data-field=\"course-1-0-en\">—</td><td data-field=\"course-1-1-en\">—</td><td data-field=\"course-1-2-en\">—</td></tr><tr><th scope=\"row\">Wednesday</th><td data-field=\"course-2-0-en\">—</td><td data-field=\"course-2-1-en\">—</td><td data-field=\"course-2-2-en\">—</td></tr><tr><th scope=\"row\">Thursday</th><td data-field=\"course-3-0-en\">—</td><td data-field=\"course-3-1-en\">—</td><td data-field=\"course-3-2-en\">—</td></tr><tr><th scope=\"row\">Friday</th><td data-field=\"course-4-0-en\">—</td><td data-field=\"course-4-1-en\">—</td><td data-field=\"course-4-2-en\">—</td></tr></tbody></table></div></section><section class=\"wrap section feature\"><div class=\"panel\"><p class=\"eyebrow\">AREAS OF CURIOSITY</p><h2>Interests</h2><h3>My interests</h3><ul><li>Web design</li><li>Digital illustration</li><li>Technology</li></ul><h3>Learning priorities</h3><ol><li>HTML5</li><li>CSS3</li><li>JavaScript</li></ol></div><div class=\"panel\"><p class=\"eyebrow\">CURRENT LEARNING</p><h2>Skills I am developing</h2><div class=\"skill\"><div class=\"skillhead\"><strong>HTML5</strong><span data-field=\"skill-0\">Öğreniyorum</span></div><div class=\"track\" aria-hidden=\"true\" hidden><div class=\"fill\" data-skill-fill=\"0\" style=\"width: 0%;\"></div></div></div><div class=\"skill\"><div class=\"skillhead\"><strong>CSS3</strong><span data-field=\"skill-1\">Öğreniyorum</span></div><div class=\"track\" aria-hidden=\"true\" hidden><div class=\"fill\" data-skill-fill=\"1\" style=\"width: 0%;\"></div></div></div><div class=\"skill\"><div class=\"skillhead\"><strong>JavaScript</strong><span data-field=\"skill-2\">Keşfediyorum</span></div><div class=\"track\" aria-hidden=\"true\" hidden><div class=\"fill\" data-skill-fill=\"2\" style=\"width: 0%;\"></div></div></div><div class=\"skill\"><div class=\"skillhead\"><strong>Design</strong><span data-field=\"skill-3\">Keşfediyorum</span></div><div class=\"track\" aria-hidden=\"true\" hidden><div class=\"fill\" data-skill-fill=\"3\" style=\"width: 0%;\"></div></div></div></div></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">NEXT CHAPTER</p><h2>Every idea starts<br/><em>with a conversation.</em></h2></div><a class=\"footer-arrow\" href=\"contact.html\" aria-label=\"Contact me\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Code. Curiosity. New worlds.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Student portfolio · HTML5 and CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Admin panel</a> · <a href=\"../kaynak.txt\">Sources</a></span></div></div></footer></body></html>","en/projects.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"en\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>My projects | Onur Can Orhan</title><meta content=\"My games, desktop applications and graphic design studies.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"en_US\"/><meta property=\"og:title\" content=\"My projects | Onur Can Orhan\"/><meta property=\"og:description\" content=\"My Graphic Animation 1 coursework and clearly labeled example projects.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/en/projects.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"../assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"../assets/js/site.js\"></script><script defer=\"\" src=\"../assets/js/enhancements.js\"></script><script defer src=\"../assets/js/cinematic.js\"></script><script defer src=\"../assets/js/projects-extra.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"../images/logo.svg\"/></head><body class=\"page-projects\"><a class=\"skip\" href=\"#main\">Skip to content</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Home\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menu</button><nav aria-label=\"Main navigation\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Home</a><a href=\"about.html\">About</a><a aria-current=\"page\" href=\"projects.html\">Projects</a><a href=\"blog.html\">Blog</a><a href=\"gallery.html\">Gallery</a><a href=\"contact.html\">Contact</a><a class=\"lang\" hreflang=\"tr\" href=\"../projeler.html\" lang=\"tr\">TR</a><button aria-label=\"Toggle theme\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\" data-page-number=\"02\"><p class=\"eyebrow\">02 / IDEAS INTO INTERACTION</p><h1>My projects</h1><p class=\"lead\">Space Survivor is the current playable project. The remaining cards are design ideas in progress, clearly marked as concepts rather than completed coursework.</p><p class=\"eyebrow page-intro\">GAME / COURSEWORK / DESIGN EXPLORATIONS</p></section><section class=\"wrap section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">SELECTED WORK / 01 BUILT PROJECT</p><h2>Projects and working ideas</h2></div><p>Each card shows its current status. Open the details to read about its purpose, tools and stage.</p></div><div class=\"project-filters\" role=\"group\" aria-label=\"Project categories\"><button type=\"button\" class=\"project-filter active\" data-filter=\"all\" aria-pressed=\"true\">All</button><span class=\"project-filter-options\"></span></div><p class=\"project-empty\" hidden>No projects in this category.</p><div class=\"grid tiles phantom-tiles\"><!-- PROJECTS:START --><article data-project-id=\"4\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">04</span><img data-image=\"project-4\" src=\"../assets/img/komur-cover.svg\" alt=\"Kömür desktop cat illustration\" width=\"1000\" height=\"650\" loading=\"lazy\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-4-category-en\">Desktop application</p><h3 data-field=\"project-4-title-en\">Kömür</h3><p data-field=\"project-4-desc-en\">A Python desktop cat with local AI, optional voice, memory and everyday assistance.</p><a class=\"btn ghost project-open\" href=\"komur.html\">Project and downloads</a><details class=\"project-case\"><summary>Process and outcome</summary><div class=\"case-sections\"><section><h4>Technology</h4><p>Python, Tkinter, Pillow, SQLite, Ollama, PyInstaller, Inno Setup.</p></section><section><h4>Version</h4><p>1.1.0 · Windows 10/11 x64.</p></section><section><h4>Token</h4><p>Total development usage is unknown; no verifiable aggregate record is included.</p></section></div></details></div></article><article id=\"project-1\" data-project-id=\"1\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">01</span><img alt=\"Space Survivor browser game screen\" data-image=\"project-1\" loading=\"eager\" fetchpriority=\"high\" src=\"../oyun/tanitim-gorseli.png\" width=\"1440\" height=\"900\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-1-category-en\">Game</p><h3 data-field=\"project-1-title-en\">Space Survivor</h3><p data-field=\"project-1-desc-en\">A playable space-themed browser game built with HTML5 Canvas and JavaScript.</p><a class=\"btn ghost project-open\" href=\"../oyun/index.html\">Play Game</a><details class=\"project-case\"><summary>Process and outcome</summary><div class=\"case-sections\"><section><h4>Purpose</h4><p data-field=\"project-1-purpose-en\">Develop a space survival game playable in a browser.</p></section><section><h4>Technologies</h4><p data-field=\"project-1-tech-en\">HTML5 Canvas, CSS3 and JavaScript.</p></section><section><h4>Implementation stages</h4><p data-field=\"project-1-steps-en\">Game area and interface; keyboard and touch controls; enemy waves, collisions and scoring.</p></section><section><h4>Result / current status</h4><p data-field=\"project-1-result-en\">Space Survivor is playable on this site, with scoring, pause and restart controls.</p></section><section><h4>Challenges</h4><p data-field=\"project-1-challenges-en\">Development challenges have not been documented yet.</p></section></div></details><div class=\"project-gallery-source\" hidden><img data-image=\"project-1-detail-1\" src=\"../assets/img/comparison-placeholder.svg\" alt=\"Additional project image 1\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/><img data-image=\"project-1-detail-2\" src=\"../assets/img/comparison-placeholder.svg\" alt=\"Additional project image 2\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/></div></div></article><article id=\"project-2\" data-project-id=\"2\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">02</span><img alt=\"Kinetic Typography\" data-image=\"project-2\" loading=\"lazy\" src=\"../assets/img/project-2.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-2-category-en\">Graphic Design</p><h3 data-field=\"project-2-title-en\">Kinetic Typography</h3><p data-field=\"project-2-desc-en\">Example project card exploring animation principles and type.</p><details class=\"project-case\"><summary>Process and outcome</summary><div class=\"case-sections\"><section><h4>Purpose</h4><p data-field=\"project-2-purpose-en\">An example slot for exploring type movement and animation principles.</p></section><section><h4>Technologies</h4><p data-field=\"project-2-tech-en\">No production tool or technology has been selected yet.</p></section><section><h4>Implementation stages</h4><p data-field=\"project-2-steps-en\">Planned sequence: reference research, storyboard, motion studies and review.</p></section><section><h4>Result / current status</h4><p data-field=\"project-2-result-en\">This is an example card, not a completed animation or submitted assignment.</p></section><section><h4>Challenges</h4><p data-field=\"project-2-challenges-en\">No implementation challenges to report: this is an example project slot.</p></section></div></details><div class=\"project-gallery-source\" hidden><img data-image=\"project-2-detail-1\" src=\"../assets/img/comparison-placeholder.svg\" alt=\"Additional project image 1\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/><img data-image=\"project-2-detail-2\" src=\"../assets/img/comparison-placeholder.svg\" alt=\"Additional project image 2\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/></div></div></article><article id=\"project-3\" data-project-id=\"3\" class=\"card style1 phantom-tile\"><div class=\"visual image\" data-parallax><span class=\"project-index\" aria-hidden=\"true\">03</span><img alt=\"Digital Illustration\" data-image=\"project-3\" loading=\"lazy\" src=\"../assets/img/project-3.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><p class=\"project-category\" data-field=\"project-3-category-en\">Graphic Design</p><h3 data-field=\"project-3-title-en\">Digital Illustration</h3><p data-field=\"project-3-desc-en\">Example project card exploring layers and color harmony.</p><details class=\"project-case\"><summary>Process and outcome</summary><div class=\"case-sections\"><section><h4>Purpose</h4><p data-field=\"project-3-purpose-en\">An example slot for exploring layers and colour harmony.</p></section><section><h4>Technologies</h4><p data-field=\"project-3-tech-en\">No production tool or technology has been selected yet.</p></section><section><h4>Implementation stages</h4><p data-field=\"project-3-steps-en\">Planned sequence: sketch, colour palette, layer organisation and review.</p></section><section><h4>Result / current status</h4><p data-field=\"project-3-result-en\">This is an example card. Actual project images and process documentation have not been added yet.</p></section><section><h4>Challenges</h4><p data-field=\"project-3-challenges-en\">No implementation challenges to report: this is an example project slot.</p></section></div></details><div class=\"project-gallery-source\" hidden><img data-image=\"project-3-detail-1\" src=\"../assets/img/comparison-placeholder.svg\" alt=\"Additional project image 1\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/><img data-image=\"project-3-detail-2\" src=\"../assets/img/comparison-placeholder.svg\" alt=\"Additional project image 2\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/></div></div></article><!-- PROJECTS:END --></div></section><section class=\"wrap section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">METHOD / SMALL STEPS</p><h2>How I approach an idea</h2></div><p>This is the process I aim to follow; not every stage is complete for every project.</p></div><ol class=\"process-list\"><li><strong>01 &#xB7; Explore</strong><span>Clarify the topic and look at relevant examples.</span></li><li><strong>02 &#xB7; Sketch</strong><span>Try the interface or visual direction in small studies.</span></li><li><strong>03 &#xB7; Build</strong><span>Turn what I have learned into a working prototype.</span></li><li><strong>04 &#xB7; Review</strong><span>Check the result, note gaps and choose a next step.</span></li></ol></section><section class=\"wrap section\" aria-labelledby=\"comparison-title\"><p class=\"eyebrow\">NEXT STEP / IMAGE EDITING</p><h2 id=\"comparison-title\">Comparison workspace</h2><p class=\"comparison-note\" data-comparison-note>Preparation area: no real Photoshop project has been added. The images are placeholders, not completed work.</p><figure class=\"comparison\" data-comparison><div class=\"comparison-stage\"><img class=\"compare-after\" data-image=\"project-compare-after\" src=\"../assets/img/comparison-placeholder.svg\" alt=\"Image after editing; placeholder\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/><img class=\"compare-before\" data-image=\"project-compare-before\" src=\"../assets/img/comparison-placeholder.svg\" alt=\"Original image before editing; placeholder\" width=\"1200\" height=\"750\" loading=\"lazy\" decoding=\"async\"/><span class=\"compare-divider\" aria-hidden=\"true\"></span><span class=\"compare-tag before\" aria-hidden=\"true\">Before</span><span class=\"compare-tag after\" aria-hidden=\"true\">After</span></div><figcaption><span data-field=\"project-compare-caption-en\">A space to document an actual editing process when original images are available.</span></figcaption><div class=\"comparison-control\" hidden><label for=\"compare-range\">Before image visibility</label><input id=\"compare-range\" type=\"range\" min=\"0\" max=\"100\" value=\"50\" step=\"1\" aria-describedby=\"compare-help\"/><p id=\"compare-help\" class=\"note\">Drag the slider or use the arrow keys. Home: after only. End: before only.</p></div></figure></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">NEXT CHAPTER</p><h2>Every idea starts<br/><em>with a conversation.</em></h2></div><a class=\"footer-arrow\" href=\"contact.html\" aria-label=\"Contact me\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Code. Curiosity. New worlds.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Student portfolio · HTML5 and CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Admin panel</a> · <a href=\"../kaynak.txt\">Sources</a></span></div></div></footer></body></html>","en/gallery.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"en\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>Visual studies | Onur Can Orhan</title><meta content=\"Three abstract visual studies inspired by drawing, game worlds and cinema.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"en_US\"/><meta property=\"og:title\" content=\"Visual studies | Onur Can Orhan\"/><meta property=\"og:description\" content=\"Three abstract visual studies inspired by drawing, game worlds and cinema.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/en/gallery.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"../assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"../assets/js/site.js\"></script><script defer=\"\" src=\"../assets/js/enhancements.js\"></script><script defer src=\"../assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"../images/logo.svg\"/></head><body class=\"page-gallery\"><a class=\"skip\" href=\"#main\">Skip to content</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Home\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menu</button><nav aria-label=\"Main navigation\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Home</a><a href=\"about.html\">About</a><a href=\"projects.html\">Projects</a><a href=\"blog.html\">Blog</a><a aria-current=\"page\" href=\"gallery.html\">Gallery</a><a href=\"contact.html\">Contact</a><a class=\"lang\" hreflang=\"tr\" href=\"../galeri.html\" lang=\"tr\">TR</a><button aria-label=\"Toggle theme\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\" data-page-number=\"03\"><p class=\"eyebrow\">03 / A PERSONAL PERSPECTIVE</p><h1>Visual studies</h1><p class=\"lead\">Three abstract visual studies inspired by drawing, game worlds and cinema.</p></section><section class=\"wrap section\"><h2>Visual studies · concept sketches</h2><div class=\"grid gallery\"><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Drawing · sketchbook\" data-image=\"gallery-1\" loading=\"lazy\" src=\"../assets/img/gallery-1.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-1-title-en\">Drawing · sketchbook</h3><p data-field=\"gallery-1-desc-en\">An abstract study inspired by drawing and sketchbook practice.</p></div></article><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Game worlds · colour and atmosphere\" data-image=\"gallery-2\" loading=\"lazy\" src=\"../assets/img/gallery-2.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-2-title-en\">Game worlds · colour and atmosphere</h3><p data-field=\"gallery-2-desc-en\">An abstract study inspired by drawing and sketchbook practice.</p></div></article><article class=\"card style1 phantom-tile\"><div class=\"visual image\"><img alt=\"Cinema · light and framing\" data-image=\"gallery-3\" loading=\"lazy\" src=\"../assets/img/gallery-3.svg\" width=\"1000\" height=\"650\" decoding=\"async\"/></div><div class=\"inner content\"><h3 data-field=\"gallery-3-title-en\">Cinema · light and framing</h3><p data-field=\"gallery-3-desc-en\">An abstract study inspired by drawing and sketchbook practice.</p></div></article></div></section><section class=\"wrap section\"><h2>About these studies</h2><p>These are original abstract illustrations made for this portfolio, not personal photographs or finished class assignments.</p></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">NEXT CHAPTER</p><h2>Every idea starts<br/><em>with a conversation.</em></h2></div><a class=\"footer-arrow\" href=\"contact.html\" aria-label=\"Contact me\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Code. Curiosity. New worlds.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Student portfolio · HTML5 and CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Admin panel</a> · <a href=\"../kaynak.txt\">Sources</a></span></div></div></footer></body></html>","en/blog.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"en\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>Technology blog | Onur Can Orhan</title><meta content=\"Learning notes on HTML, CSS and software tools.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"en_US\"/><meta property=\"og:title\" content=\"Technology blog | Onur Can Orhan\"/><meta property=\"og:description\" content=\"Learning notes on HTML, CSS and software tools.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/en/blog.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"../assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"../assets/js/site.js\"></script><script defer=\"\" src=\"../assets/js/enhancements.js\"></script><script defer src=\"../assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"../images/logo.svg\"/></head><body class=\"page-blog\"><a class=\"skip\" href=\"#main\">Skip to content</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Home\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menu</button><nav aria-label=\"Main navigation\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Home</a><a href=\"about.html\">About</a><a href=\"projects.html\">Projects</a><a aria-current=\"page\" href=\"blog.html\">Blog</a><a href=\"gallery.html\">Gallery</a><a href=\"contact.html\">Contact</a><a class=\"lang\" hreflang=\"tr\" href=\"../blog.html\" lang=\"tr\">TR</a><button aria-label=\"Toggle theme\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\" data-page-number=\"04\"><p class=\"eyebrow\">04 / NOTES FROM THE JOURNEY</p><h1>Technology blog</h1><p class=\"lead\">I turn what I read and learn about HTML, CSS and software tools into short, practical notes.</p><p class=\"eyebrow page-intro\">LEARNING NOTES / WEB / TOOLS</p></section><nav class=\"wrap journal-index\" aria-label=\"Article index\"><a href=\"#article-1\"><span>01</span>HTML5 and Semantic Web Design<span aria-hidden=\"true\">&#8600;</span></a><a href=\"#article-2\"><span>02</span>Responsive Design with CSS3<span aria-hidden=\"true\">&#8600;</span></a><a href=\"#article-3\"><span>03</span>Artificial Intelligence in Software Development<span aria-hidden=\"true\">&#8600;</span></a></nav><section class=\"wrap section journal\"><div class=\"section-heading\"><div><p class=\"eyebrow\">READING LIST / 03 TOPICS</p><h2>Learning notes</h2></div><p>These are introductory topic summaries, not claims of professional expertise or personal field experience.</p></div><article class=\"card article\" id=\"article-1\"><div class=\"visual image\"><img alt=\"HTML5 and Semantic Web Design topic illustration\" src=\"../assets/img/blog-html.svg\" width=\"1000\" height=\"650\" decoding=\"async\" loading=\"lazy\"/></div><div class=\"inner content\"><h2 data-field=\"blog-1-title-en\">HTML5 and Semantic Web Design</h2><p data-field=\"blog-1-intro-en\">HTML5 helps define not only how a page looks but also what its content means.</p><h3>Core concepts</h3><p data-field=\"blog-1-p1-en\">Semantic tags such as header, nav, main, article and footer describe page regions. This makes content easier to interpret for assistive technology and search engines.</p><h3>Practice and good habits</h3><p data-field=\"blog-1-p2-en\">A good HTML page uses a consistent heading hierarchy. The h1 names the main topic and h2 headings separate major sections. Form labels identify fields, and image alt text describes their purpose.</p><h3>Conclusion</h3><p data-field=\"blog-1-p3-en\">For example, a portfolio can use nav for the main menu, main for its primary content and article for an independent blog entry. Semantic markup retains meaning even without CSS.</p></div></article><article class=\"card article\" id=\"article-2\"><div class=\"visual image\"><img alt=\"Responsive Design with CSS3 topic illustration\" src=\"../assets/img/blog-css.svg\" width=\"1000\" height=\"650\" decoding=\"async\" loading=\"lazy\"/></div><div class=\"inner content\"><h2 data-field=\"blog-2-title-en\">Responsive Design with CSS3</h2><p data-field=\"blog-2-intro-en\">Responsive design aims to keep websites readable and usable across screen sizes.</p><h3>Core concepts</h3><p data-field=\"blog-2-p1-en\">CSS Grid is helpful for multi-column cards, while Flexbox handles navigation and one-dimensional alignment. Media queries can change columns or navigation when the viewport narrows.</p><h3>Practice and good habits</h3><p data-field=\"blog-2-p2-en\">Flexible measures such as max-width, percentages and clamp reduce overflow. Touch targets should be large enough, and mobile text should not require horizontal scrolling.</p><h3>Conclusion</h3><p data-field=\"blog-2-p3-en\">In this project, a three-column desktop layout becomes two columns on tablets and one on phones. This is a meaningful reflow of content rather than simply shrinking it.</p></div></article><article class=\"card article\" id=\"article-3\"><div class=\"visual image\"><img alt=\"Artificial Intelligence in Software Development topic illustration\" src=\"../assets/img/blog-ai.svg\" width=\"1000\" height=\"650\" decoding=\"async\" loading=\"lazy\"/></div><div class=\"inner content\"><h2 data-field=\"blog-3-title-en\">Artificial Intelligence in Software Development</h2><p data-field=\"blog-3-intro-en\">AI tools can assist with writing code, explaining concepts, debugging and generating tests.</p><h3>Core concepts</h3><p data-field=\"blog-3-p1-en\">Model-generated code should not be trusted without verification. Developers should review it, inspect dependencies and run automated tests.</p><h3>Practice and good habits</h3><p data-field=\"blog-3-p2-en\">Clear requirements improve results. Rather than requesting a mobile menu alone, developers should specify keyboard access, viewport behavior and error cases.</p><h3>Conclusion</h3><p data-field=\"blog-3-p3-en\">AI can improve productivity but does not remove responsibility for correctness. Security, personal information and fabricated claims require careful review.</p></div></article></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">NEXT CHAPTER</p><h2>Every idea starts<br/><em>with a conversation.</em></h2></div><a class=\"footer-arrow\" href=\"contact.html\" aria-label=\"Contact me\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Code. Curiosity. New worlds.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Student portfolio · HTML5 and CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Admin panel</a> · <a href=\"../kaynak.txt\">Sources</a></span></div></div></footer></body></html>","en/contact.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"en\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>Contact | Onur Can Orhan</title><meta content=\"Contact details and a demonstration form.\" name=\"description\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"en_US\"/><meta property=\"og:title\" content=\"Contact | Onur Can Orhan\"/><meta property=\"og:description\" content=\"Contact details and a demonstration form.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/en/contact.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"../assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"../assets/js/site.js?v=contact-20261113\"></script><script defer=\"\" src=\"../assets/js/enhancements.js\"></script><script defer src=\"../assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"../images/logo.svg\"/></head><body class=\"page-contact\"><a class=\"skip\" href=\"#main\">Skip to content</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Home\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menu</button><nav aria-label=\"Main navigation\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Home</a><a href=\"about.html\">About</a><a href=\"projects.html\">Projects</a><a href=\"blog.html\">Blog</a><a href=\"gallery.html\">Gallery</a><a aria-current=\"page\" href=\"contact.html\">Contact</a><a class=\"lang\" hreflang=\"tr\" href=\"../iletisim.html\" lang=\"tr\">TR</a><button aria-label=\"Toggle theme\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\" data-page-number=\"05\"><p class=\"eyebrow\">05 / LET’S START A CONVERSATION</p><h1>Contact</h1><p class=\"lead\">Have a project or collaboration idea? Send me a message using the form below.</p><p class=\"eyebrow page-intro\">CONTACT / STUDENT PORTFOLIO</p></section><section class=\"wrap section feature\"><div class=\"panel\"><h2>Contact details</h2><p><strong>Address:</strong> <span data-field=\"address-en\">Antalya, Türkiye</span></p><p><strong>Phone:</strong> <a class=\"contact-link\" data-contact-link=\"phone\" href=\"tel:+905412608920\"><span data-field=\"phone\">+90 541 260 89 20</span><span aria-hidden=\"true\">↗</span></a></p><p><strong>E-mail:</strong> <a class=\"contact-link\" data-contact-link=\"email\" href=\"mailto:onurcan147258@gmail.com\"><span data-field=\"email\">onurcan147258@gmail.com</span><span aria-hidden=\"true\">↗</span></a></p></div><div class=\"panel\"><h2>Contact form</h2><p class=\"note\">Your message will be delivered to my private inbox.</p><form data-contact-form=\"\"><label for=\"name\">Full name</label><input autocomplete=\"name\" id=\"name\" maxlength=\"100\" name=\"name\" required=\"\"/><label for=\"email\">Email</label><input autocomplete=\"email\" id=\"email\" name=\"email\" required=\"\" type=\"email\"/><label for=\"subject\">Subject</label><input id=\"subject\" maxlength=\"150\" name=\"subject\" required=\"\"/><label for=\"message\">Message</label><textarea id=\"message\" minlength=\"10\" name=\"message\" required=\"\" maxlength=\"5000\"></textarea><button class=\"btn\" type=\"submit\">Send message</button><p id=\"form-status\" role=\"status\"></p><div hidden aria-hidden=\"true\"><input name=\"website\" tabindex=\"-1\" autocomplete=\"off\"></div></form></div></section><section class=\"wrap section\"><h2>Privacy note</h2><p>Your name, email and message are stored securely to respond to your enquiry. Messages are visible only to the site administrator.</p></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">NEXT CHAPTER</p><h2>Every idea starts<br/><em>with a conversation.</em></h2></div><a class=\"footer-arrow\" href=\"contact.html\" aria-label=\"Contact me\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Code. Curiosity. New worlds.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Student portfolio · HTML5 and CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Admin panel</a> · <a href=\"../kaynak.txt\">Sources</a></span></div></div></footer></body></html>","komur.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"tr\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>Kömür | Onur Can Orhan</title><meta name=\"description\" content=\"Kömür masaüstü kedisi: indirme, kaynak kodları, geliştirme ve token bilgisi.\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"tr_TR\"/><meta property=\"og:title\" content=\"Projelerim | Onur Can Orhan\"/><meta property=\"og:description\" content=\"Grafik Animasyon 1 dersi için hazırladığım veya örnek olarak incelediğim çalışmalar.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/projeler.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"assets/js/site.js\"></script><script defer=\"\" src=\"assets/js/enhancements.js\"></script><script defer src=\"assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"images/logo.svg\"/><style>.komur-cover{display:block;width:100%;height:auto;border-radius:20px;max-height:540px;object-fit:cover}.komur-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.2rem}.komur-panel{padding:1.5rem;border:1px solid currentColor;border-radius:16px}.komur-table{overflow-x:auto}.komur-table table{width:100%;border-collapse:collapse}.komur-table th,.komur-table td{text-align:left;padding:1rem;border-bottom:1px solid currentColor}.komur-hash{white-space:pre-wrap;overflow-wrap:anywhere;padding:1rem;border:1px solid currentColor;border-radius:12px}.actions{display:flex;flex-wrap:wrap;gap:.8rem}.page-komur p,.page-komur li{line-height:1.8}@media(max-width:650px){.komur-grid{grid-template-columns:1fr}.actions .btn{width:100%;text-align:center}}</style></head><body class=\"page-komur\"><a class=\"skip\" href=\"#main\">İçeriğe geç</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Anasayfa\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menü</button><nav aria-label=\"Ana menü\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Anasayfa</a><a href=\"hakkimda.html\">Hakkımda</a><a aria-current=\"page\" href=\"projeler.html\">Projeler</a><a href=\"blog.html\">Blog</a><a href=\"galeri.html\">Galeri</a><a href=\"iletisim.html\">İletişim</a><a class=\"lang\" hreflang=\"en\" href=\"en/komur.html\" lang=\"en\">EN</a><button aria-label=\"Temayı değiştir\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\"><p class=\"eyebrow\" data-field=\"project-4-p1-tr\">MASAÜSTÜ UYGULAMASI / 1.1.0</p><h1 data-field=\"project-4-title-tr\">Kömür</h1><p class=\"lead\" data-field=\"project-4-p2-tr\">Masaüstünde yaşayan bir kedi. Türkçe sohbet, yerel AI, ses ve günlük işler için bir yardımcı.</p><div class=\"actions\"><a class=\"btn\" href=\"https://github.com/sushikiddo/komur/releases/download/v1.1.0/Komur-Setup-1.1.0-x64.exe\">Windows için indir · 1.1.0</a><a class=\"btn ghost\" href=\"https://github.com/sushikiddo/komur\">Kaynak kodları ve README</a><a class=\"btn ghost\" href=\"https://github.com/sushikiddo/komur/releases/download/v1.1.0/Komur-Kaynak-v4.zip\">Kaynak ZIP</a></div><p class=\"note\" data-field=\"project-4-p3-tr\">Windows 10/11 · 64 bit · 142 MB · Python kurulumu gerekmez</p></section>\n<section class=\"wrap section\"><img class=\"komur-cover\" src=\"assets/img/komur-cover.svg\" alt=\"Kömür için hazırlanmış siyah-beyaz kedi illüstrasyonu; uygulama ekran görüntüsü değildir\" width=\"1000\" height=\"650\"/><h2>Ne işe yarıyor?</h2><p data-field=\"project-4-p4-tr\">Kömür, siyah-beyaz masaüstü kedisini bir yardımcı arayüzüne dönüştüren Python projem. Kediye çift tıklayıp sohbet edebilir, not tutabilir, hatırlatıcı kurabilir ve desteklenen bilgisayar komutlarını başlatabilirsiniz. Animasyonlar ve medya tepkileri karaktere eşlik eder.</p><div class=\"komur-grid\"><article class=\"komur-panel\"><h3>Sohbet ve ses</h3><p data-field=\"project-4-p5-tr\">Ollama üzerinden yerel sohbet; isteğe bağlı OpenAI ve Claude sağlayıcıları. Mikrofonla başlatılan konuşma yerel olarak metne çevrilir, Windows Türkçe sesiyle yanıt okunabilir.</p></article><article class=\"komur-panel\"><h3>Hafıza ve hatırlatıcı</h3><p data-field=\"project-4-p6-tr\">SQLite ile yerel geçmiş ve notlar. Tek seferlik veya tekrar eden hatırlatıcılar; uygulama kapalıyken bildirim üretilmez.</p></article><article class=\"komur-panel\"><h3>Ekran ve bilgisayar yardımı</h3><p data-field=\"project-4-p7-tr\">Seçili pencerenin metni ve erişilebilir kontrolleriyle yardım. Bazı PC işlemleri ayrıca onay gerektirir; her uygulama ve oyun desteklenmez.</p></article><article class=\"komur-panel\"><h3>Oyun ve medya</h3><p data-field=\"project-4-p8-tr\">Desteklenen Steam/Riot başlatma yolları, müzik/video tepkileri ve oyun odağında sakin davranış. İstemci açmak oyuna giriş veya indirme tamamlandı demek değildir.</p></article></div></section>\n<section class=\"wrap section\"><h2>Nasıl kullanılır?</h2><ol><li>Kurulum dosyasını indirin ve çalıştırın. Kurulum kullanıcı hesabına yapılır; kaldırıcı eklenir.</li><li>İsteğe bağlı yardımcıdan yerel AI ve ses modellerini kurun. İlk indirmeler ek disk alanı ve internet gerektirir.</li><li>Kediye çift tıklayın, mesajınızı yazın ve Enter ile gönderin.</li><li>“Not defterini aç”, “5 dakika sonra mola hatırlat”, “uyu” veya “dans et” komutlarını deneyin.</li><li>Ses için Konuş / Bitir düğmelerini kullanın; gönderimden önce tanınan metni kontrol edin.</li></ol><p data-field=\"project-4-p9-tr\">Standart yerel model için kılavuz 16 GB RAM ve yaklaşık 4,7 GB model indirmesi önerir; hafif profil yaklaşık 2,6 GB ve 8 GB RAM için sunulur. Ses modeli yaklaşık 486 MB ek indirme gerektirir. Değerler modele göre değişebilir.</p></section>\n<section class=\"wrap section\"><h2>Nasıl geliştirildi?</h2><p data-field=\"project-4-p10-tr\">Python ve Tkinter ile masaüstü arayüzü, Pillow ile çizim, pygame/Windows bileşenleriyle ses ve SQLite ile hafıza oluşturuldu. EXE PyInstaller, kurulum Inno Setup ile paketlenir. Kod; karakter, davranış, sohbet, sağlayıcılar, ses, ekran yardımı ve dağıtım modüllerine ayrılır.</p><p data-field=\"project-4-p11-tr\">AI araçlarından geliştirme desteği alındı. Kaynak paketi bütün üretim oturumlarını içermediğinden dosya bazında model atfı, insan/AI katkı yüzdesi ve toplam geliştirme süresi doğrulanamıyor. Ayrıntılı modül haritası, çalıştırma ve derleme komutları GitHub README’sinde yer alır.</p><h3>Token kullanımı</h3><div class=\"komur-table\"><table><thead><tr><th>Başlık</th><th>Doğrulanabilen bilgi</th></tr></thead><tbody><tr><td>Toplam geliştirme tüketimi</td><td>Doğrulanabilir toplam kayıt yok; bilinmiyor.</td></tr><tr><td>Uygulama sohbeti</td><td>Model, geçmiş ve araç adımlarına göre değişir; merkezi token raporu yok.</td></tr><tr><td>Koddaki sınırlar</td><td>Bazı isteklerde 600, Anthropic araç döngüsünde 4000 çıktı token sınırı. Gerçek tüketim değildir.</td></tr><tr><td>Yerel kullanım</td><td>Bulut API token ücreti yok; donanım ve elektrik tüketimi var.</td></tr><tr><td>Bulut kullanım</td><td>Seçilen API hesabına ve modelin gerçek kullanımına bağlı olabilir.</td></tr></tbody></table></div></section>\n<section class=\"wrap section\"><h2>Doğrulama ve sınırlar</h2><p data-field=\"project-4-p12-tr\">Bu yayın hazırlığında 73 Python dosyasının sözdizimi kontrol edildi; Desktop.rar içindeki EXE’nin SHA-256 değeri yanındaki özetle eşleşti. Paket içindeki önceki test raporu 200 başarılı test, 1 atlanan test ve 46 GUI senaryosu bildiriyor; bunlar bu hazırlıkta yeniden çalıştırılmış sonuçlar değildir. Temiz başka bir bilgisayarda tüm özellikler uçtan uca denenmedi.</p><p data-field=\"project-4-p13-tr\">Kurulum kod imzalı değildir; Windows yayımlayıcı uyarısı gösterebilir. Dosyayı kaynakla birlikte yayımlanan SHA-256 özetiyle doğrulayabilirsiniz.</p><a href=\"https://github.com/sushikiddo/komur/releases/download/v1.1.0/Komur-Setup-1.1.0-x64.exe.sha256\">SHA-256 dosyasını indir</a><pre class=\"komur-hash\"><code>ebcea72b23c45d5e1cb469780f7ecf5b068332b331420b62c24024f00e22a97f</code></pre><h3>Veriler ve paylaşım</h3><p data-field=\"project-4-p15-tr\">Geçmiş ve notlar bilgisayarda tutulur. Bulut sağlayıcısı seçilirse etkin bağlam o sağlayıcıya gidebilir; yerel moddaki web araması da arama sözcüklerini dış hizmete gönderir. İndirme paketi kişisel sohbet, API anahtarı ve AI modellerini içermez. Ana proje lisansı kaynak paketinde belirtilmemiştir; bağımlılıkların ayrı lisansları vardır.</p><p><a href=\"https://github.com/sushikiddo/komur\">Ayrıntılı teknik açıklama, kaynaklar ve kurulum adımları →</a></p></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">BİR SONRAKİ SAYFA</p><h2>Her fikir<br/><em>bir merhaba ile başlar.</em></h2></div><a class=\"footer-arrow\" href=\"iletisim.html\" aria-label=\"İletişime geç\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Kod. Merak. Yeni dünyalar.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Öğrenci portfolyosu · HTML5 ve CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Yönetici paneli</a> · <a href=\"kaynak.txt\">Kaynaklar</a></span></div></div></footer></body></html>","en/komur.html":"<!DOCTYPE html>\r\n\r\n<html lang=\"en\"><head><script>document.documentElement.classList.add('js');try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script><meta charset=\"utf-8\"/><meta content=\"width=device-width,initial-scale=1\" name=\"viewport\"/><title>Kömür | Onur Can Orhan</title><meta name=\"description\" content=\"Kömür desktop cat: download, source, development details and token information.\"/><meta property=\"og:type\" content=\"website\"/><meta property=\"og:site_name\" content=\"Onur Can Orhan\"/><meta property=\"og:locale\" content=\"en_US\"/><meta property=\"og:title\" content=\"My projects | Onur Can Orhan\"/><meta property=\"og:description\" content=\"My Graphic Animation 1 coursework and clearly labeled example projects.\"/><meta property=\"og:url\" content=\"https://onurcanorhan.pages.dev/en/projects.html\"/><meta property=\"og:image\" content=\"https://onurcanorhan.pages.dev/images/og-card.jpg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:card\" content=\"summary_large_image\"/><meta name=\"theme-color\" content=\"#080e1b\" media=\"(prefers-color-scheme: dark)\"/><meta name=\"theme-color\" content=\"#f1f2ee\" media=\"(prefers-color-scheme: light)\"/><link href=\"../assets/css/style.css\" rel=\"stylesheet\"/><script defer=\"\" src=\"../assets/js/site.js\"></script><script defer=\"\" src=\"../assets/js/enhancements.js\"></script><script defer src=\"../assets/js/cinematic.js\"></script><link rel=\"icon\" type=\"image/svg+xml\" href=\"../images/logo.svg\"/><style>.komur-cover{display:block;width:100%;height:auto;border-radius:20px;max-height:540px;object-fit:cover}.komur-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.2rem}.komur-panel{padding:1.5rem;border:1px solid currentColor;border-radius:16px}.komur-table{overflow-x:auto}.komur-table table{width:100%;border-collapse:collapse}.komur-table th,.komur-table td{text-align:left;padding:1rem;border-bottom:1px solid currentColor}.komur-hash{white-space:pre-wrap;overflow-wrap:anywhere;padding:1rem;border:1px solid currentColor;border-radius:12px}.actions{display:flex;flex-wrap:wrap;gap:.8rem}.page-komur p,.page-komur li{line-height:1.8}@media(max-width:650px){.komur-grid{grid-template-columns:1fr}.actions .btn{width:100%;text-align:center}}</style></head><body class=\"page-komur\"><a class=\"skip\" href=\"#main\">Skip to content</a><header class=\"top\"><div class=\"wrap nav\"><a class=\"logo\" href=\"index.html\" aria-label=\"Onur Can Orhan — Home\"><span class=\"logo-mark\" aria-hidden=\"true\">o<span>.</span></span><span class=\"logo-type\">ONUR CAN ORHAN<small>PORTFOLIO / 2026</small></span></a><button aria-controls=\"primary-nav\" aria-expanded=\"false\" class=\"menu\" data-menu=\"\" type=\"button\"><span class=\"menu-icon\" aria-hidden=\"true\"><i></i><i></i></span> Menu</button><nav aria-label=\"Main navigation\" class=\"navlinks\" id=\"primary-nav\"><a href=\"index.html\">Home</a><a href=\"about.html\">About</a><a aria-current=\"page\" href=\"projects.html\">Projects</a><a href=\"blog.html\">Blog</a><a href=\"gallery.html\">Gallery</a><a href=\"contact.html\">Contact</a><a class=\"lang\" hreflang=\"tr\" href=\"../komur.html\" lang=\"tr\">TR</a><button aria-label=\"Toggle theme\" class=\"theme\" data-theme-toggle=\"\" type=\"button\"><span aria-hidden=\"true\">◐</span></button></nav></div></header><main id=\"main\" tabindex=\"-1\"><section class=\"wrap pagehead\"><p class=\"eyebrow\" data-field=\"project-4-p1-en\">DESKTOP APPLICATION / 1.1.0</p><h1 data-field=\"project-4-title-en\">Kömür</h1><p class=\"lead\" data-field=\"project-4-p2-en\">A desktop cat with Turkish chat, local AI, optional voice and everyday assistance.</p><div class=\"actions\"><a class=\"btn\" href=\"https://github.com/sushikiddo/komur/releases/download/v1.1.0/Komur-Setup-1.1.0-x64.exe\">Download for Windows · 1.1.0</a><a class=\"btn ghost\" href=\"https://github.com/sushikiddo/komur\">Source and README</a><a class=\"btn ghost\" href=\"https://github.com/sushikiddo/komur/releases/download/v1.1.0/Komur-Kaynak-v4.zip\">Source ZIP</a></div><p class=\"note\" data-field=\"project-4-p3-en\">Windows 10/11 · x64 · 142 MB · No Python installation required</p></section>\n<section class=\"wrap section\"><img class=\"komur-cover\" src=\"../assets/img/komur-cover.svg\" alt=\"Illustrated black-and-white cat representing Kömür; not an application screenshot\" width=\"1000\" height=\"650\"/><h2>What does it do?</h2><p data-field=\"project-4-p4-en\">Kömür is my Python desktop companion project. Double-click the cat to chat, create notes and reminders, or request supported computer actions. Animations, sounds and reactions to supported media sessions accompany the character.</p><div class=\"komur-grid\"><article class=\"komur-panel\"><h3>Chat and voice</h3><p data-field=\"project-4-p5-en\">Local chat through Ollama, with optional OpenAI and Claude providers. Manually started microphone input is transcribed locally; Windows Turkish speech can read responses.</p></article><article class=\"komur-panel\"><h3>Memory and reminders</h3><p data-field=\"project-4-p6-en\">Local SQLite history, notes and one-off or recurring reminders. Notifications require the application to be running.</p></article><article class=\"komur-panel\"><h3>Screen and PC assistance</h3><p data-field=\"project-4-p7-en\">Text and accessible controls from a selected window. Sensitive actions require confirmation; not every application or game is supported.</p></article><article class=\"komur-panel\"><h3>Games and media</h3><p data-field=\"project-4-p8-en\">Supported Steam/Riot launch paths and music/video reactions. Opening a client does not prove sign-in or a completed download.</p></article></div></section>\n<section class=\"wrap section\"><h2>Installation and use</h2><ol><li>Download and run the per-user installer. An uninstaller is included.</li><li>Optionally install local AI and voice models using the setup helper. Initial downloads need internet and additional storage.</li><li>Double-click the cat, type a message and press Enter.</li><li>Try Turkish commands such as “Not defterini aç”, “5 dakika sonra mola hatırlat” or “dans et”.</li><li>Start and stop voice recording manually, then check the transcript before sending it.</li></ol><p data-field=\"project-4-p9-en\">The bundled guide recommends 16 GB RAM and approximately 4.7 GB of model download for the standard profile, or an approximately 2.6 GB lighter profile for 8 GB RAM. Voice recognition adds approximately 486 MB. Download sizes can change.</p></section>\n<section class=\"wrap section\"><h2>How it was developed</h2><p data-field=\"project-4-p10-en\">Python and Tkinter provide the desktop interface; Pillow handles drawing, pygame/Windows components handle sound, and SQLite stores memory. PyInstaller packages the executable and Inno Setup builds the installer. Character behavior, chat, providers, voice, screen assistance and distribution are separate modules.</p><p data-field=\"project-4-p11-en\">AI tools assisted development. The source archive does not include a complete generation history, so file-level model attribution, human/AI contribution percentages and total development time cannot be verified. The GitHub README provides the module map and build/run instructions.</p><h3>Token use</h3><div class=\"komur-table\"><table><thead><tr><th>Metric</th><th>Verified status</th></tr></thead><tbody><tr><td>Total development tokens</td><td>No verifiable aggregate record; unknown.</td></tr><tr><td>Application chat</td><td>Varies by model, history and tool steps. No centralized usage report.</td></tr><tr><td>Source limits</td><td>Some requests use a 600-token output cap; the Anthropic tool loop uses 4000. These are caps, not measured consumption.</td></tr><tr><td>Local mode</td><td>No cloud API token charge; hardware and electricity are still required.</td></tr><tr><td>Cloud providers</td><td>Charges may depend on the selected API account, model and actual usage.</td></tr></tbody></table></div></section>\n<section class=\"wrap section\"><h2>Checks and limitations</h2><p data-field=\"project-4-p12-en\">During publication preparation, 73 Python files passed syntax parsing and the installer extracted from Desktop.rar matched its accompanying SHA-256 checksum. The bundled historical report states 200 passed tests, one skipped test and 46 GUI scenarios; these are not newly rerun results. Complete end-to-end operation on a clean second computer was not checked here.</p><p data-field=\"project-4-p13-en\">The installer is unsigned and Windows may show a publisher warning. Verify its hash against the published checksum.</p><a href=\"https://github.com/sushikiddo/komur/releases/download/v1.1.0/Komur-Setup-1.1.0-x64.exe.sha256\">Download checksum</a><pre class=\"komur-hash\"><code>ebcea72b23c45d5e1cb469780f7ecf5b068332b331420b62c24024f00e22a97f</code></pre><h3>Data and licensing</h3><p data-field=\"project-4-p15-en\">History and notes are stored locally. If a cloud provider is selected, active context may be sent to it; web searches also send search terms to an external service. The package excludes personal chats, API keys and downloaded AI models. No main project license is specified in the source archive; dependencies have separate licenses.</p><p><a href=\"https://github.com/sushikiddo/komur\">Read the detailed technical documentation and source →</a></p></section></main><footer class=\"site-footer\"><div class=\"wrap footer-top\"><div><p class=\"eyebrow\">NEXT CHAPTER</p><h2>Every idea starts<br/><em>with a conversation.</em></h2></div><a class=\"footer-arrow\" href=\"contact.html\" aria-label=\"Contact me\">↗</a></div><div class=\"wrap footer-signature\"><span>ONUR CAN ORHAN<span class=\"signature-dot\">.</span></span><p>Code. Curiosity. New worlds.</p></div><div class=\"footer-bottom\"><div class=\"wrap footerflex\"><span>© 2026 · Student portfolio · HTML5 and CSS3</span><span><a class=\"adminlink\" href=\"/admin/\">Admin panel</a> · <a href=\"../kaynak.txt\">Sources</a></span></div></div></footer></body></html>"};
const CURRENT_SITE_ASSETS=["404.html","admin/admin.js","admin/index.html","admin/login.html","admin/login.js","admin/project-template.html","admin/project-tools.js","admin/session.js","assets/css/command.css","assets/css/fontawesome-all.min.css","assets/css/main.css","assets/css/motion.css","assets/css/noscript.css","assets/css/style.css","assets/fonts/bricolage-grotesque-latin-ext-wght-normal.woff2","assets/fonts/bricolage-grotesque-latin-wght-normal.woff2","assets/fonts/instrument-serif-latin-400-italic.woff2","assets/fonts/instrument-serif-latin-ext-400-italic.woff2","assets/fonts/jetbrains-mono-latin-ext-wght-normal.woff2","assets/fonts/jetbrains-mono-latin-wght-normal.woff2","assets/fonts/manrope-latin-ext-wght-normal.woff2","assets/fonts/manrope-latin-wght-normal.woff2","assets/img/blog-ai.svg","assets/img/blog-css.svg","assets/img/blog-html.svg","assets/img/comparison-placeholder.svg","assets/img/gallery-1.svg","assets/img/gallery-2.svg","assets/img/gallery-3.svg","assets/img/komur-cover.svg","assets/img/portrait.svg","assets/img/project-1.svg","assets/img/project-2.svg","assets/img/project-3.svg","assets/js/cinematic.js","assets/js/enhancements.js","assets/js/projects-extra.js","assets/js/site.js","assets/webfonts/fa-brands-400.woff","assets/webfonts/fa-brands-400.woff2","assets/webfonts/fa-regular-400.woff","assets/webfonts/fa-regular-400.woff2","assets/webfonts/fa-solid-900.woff","assets/webfonts/fa-solid-900.woff2","images/logo.svg","images/og-card.jpg","images/pic01.jpg","images/pic02.jpg","images/pic03.jpg","kaynak.txt","LICENSE-NOTE.txt","LICENSE-Phantom.txt","media/8927bb45-486d-4006-b79e-bdb903626fca.png","media/ca0f9d19-9aba-45cc-8397-46078135933c.png","oyun/game.js","oyun/index.html","oyun/style.css","oyun/tanitim-gorseli.png"];

function migrateSiteState(value) {
  if (value.siteVersion === "komur-20261117-v1") return value;
  const oldFields = deriveModel(value).fields;
  const oldImages = deriveModel(value).images;
  const oldPages = value.pages;
  const migrated = { ...value, pages: structuredClone(CURRENT_SITE_PAGES), assetFiles: CURRENT_SITE_ASSETS,
    siteVersion: "komur-20261117-v1", legacyPagesBefore20261117: value.legacyPagesBefore20261117 || oldPages };
  if (oldFields["project-4-title-tr"] && !/k[öo]m[üu]r/i.test(oldFields["project-4-title-tr"])) {
    throw controlled("Proje 4 kimliği mevcut bir çalışmayla çakışıyor; önce içerik birleştirilmelidir.", 409);
  }
  for (const [path, html] of Object.entries(migrated.pages)) {
    let updated = html.replace(FIELD_RE, (whole, open, tag, key, text, close, closeTag) =>
      tag.toLowerCase() === closeTag.toLowerCase() && Object.hasOwn(oldFields, key)
        ? open + esc(oldFields[key]) + close : whole);
    updated = updated.replace(IMAGE_RE, (whole, key) => {
      const image = oldImages[key];
      if (!image) return whole;
      const prefix = path.startsWith("en/") ? "../" : "";
      return whole.replace(/\bsrc="[^"]*"/i, 'src="' + prefix + image.replace(/^\//, "").replaceAll('"', "&quot;") + '"');
    });
    for (const m of (oldPages[path] || "").matchAll(PROJECT_RE)) {
      if (Number(m[1]) > 4 && !updated.includes('data-project-id="' + m[1] + '"')) updated = insertCard(updated, m[0]);
    }
    migrated.pages[path] = updated;
  }
  return migrated;
}

var PAGE_PATHS = ["index.html","hakkimda.html","projeler.html","galeri.html","blog.html","iletisim.html","en/index.html","en/about.html","en/projects.html","en/gallery.html","en/blog.html","en/contact.html","komur.html","en/komur.html"];
var MAX_UPLOAD = 5 * 1024 * 1024;
var CHUNK_SIZE = 512 * 1024;
var PAGE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin"
};
var FIELD_RE = /(<(?<tag>[a-z][a-z0-9]*)\b[^>]*\bdata-field="(?<key>[^"]+)"[^>]*>)(?<value>.*?)(<\/(?<close>[a-z][a-z0-9]*)\s*>)/gis;
var IMAGE_RE = /<img\b[^>]*\bdata-image="([^"]+)"[^>]*>/gis;
var PROJECT_RE = /<article\b(?=[^>]*\bdata-project-id="(\d+)")[^>]*>.*?<\/article>/gis;
var JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
var response = /* @__PURE__ */ __name((body, status = 200, headers = {}) => new Response(body, { status, headers }), "response");
var json2 = /* @__PURE__ */ __name((body, status = 200) => response(JSON.stringify(body), status, JSON_HEADERS), "json");
var controlled = /* @__PURE__ */ __name((message, status = 400) => Object.assign(new Error(message), { status }), "controlled");
var fail = /* @__PURE__ */ __name((err2) => json2({ error: String(err2?.message || "Request failed") }, Number(err2?.status) || 500), "fail");
var dbFor = /* @__PURE__ */ __name((env) => {
  if (!env?.DB) throw controlled("D1 database binding is missing", 500);
  return env.DB;
}, "dbFor");
var esc = /* @__PURE__ */ __name((value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), "esc");
function decodeEntities(text) {
  return String(text).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|#39);/gi, (match, entity) => {
    const e = entity.toLowerCase();
    if (e === "amp") return "&";
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "quot") return '"';
    if (e === "apos" || e === "#39") return "'";
    const n = e.startsWith("#x") ? parseInt(e.slice(2), 16) : Number(e.slice(1));
    try {
      return String.fromCodePoint(n);
    } catch {
      return match;
    }
  });
}
__name(decodeEntities, "decodeEntities");
function attr(tag, name) {
  const re = new RegExp(`(?:^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*(["'])(.*?)\\1`, "is");
  return re.exec(tag)?.[2] ?? "";
}
__name(attr, "attr");
function htmlText(markup) {
  return decodeEntities(String(markup).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
}
__name(htmlText, "htmlText");
function asBytes(blob) {
  if (blob instanceof ArrayBuffer) return new Uint8Array(blob);
  if (ArrayBuffer.isView(blob)) return new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength);
  if (Array.isArray(blob)) return Uint8Array.from(blob);
  if (blob && ArrayBuffer.isView(blob.buffer)) return new Uint8Array(blob.buffer.buffer, blob.buffer.byteOffset, blob.buffer.byteLength);
  throw controlled("Stored image chunk has an invalid format", 500);
}
__name(asBytes, "asBytes");
function validPages(value) {
  return value && typeof value === "object" && PAGE_PATHS.filter(p => !p.endsWith("komur.html")).every((p) => typeof value[p] === "string");
}
__name(validPages, "validPages");
function pagesFromRow(row) {
  if (!row) throw controlled("Portfolio content is not initialized", 503);
  let value;
  try {
    value = JSON.parse(row.value);
  } catch {
    throw controlled("Stored portfolio state is invalid", 500);
  }
  if (!validPages(value.pages)) throw controlled("Stored portfolio pages are incomplete", 500);
  return { row, value };
}
__name(pagesFromRow, "pagesFromRow");
async function readState(env) {
  const row = await dbFor(env).prepare("SELECT id, value, revision FROM state WHERE id = ?").bind("content").first();
  const state = pagesFromRow(row);
  return { row: state.row, value: migrateSiteState(state.value) };
}
__name(readState, "readState");
async function commitState(env, row, value) {
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).byteLength > 19e5) throw controlled("Portfolio content has reached the D1 state size limit", 413);
  const result = await dbFor(env).prepare("UPDATE state SET value = ?, revision = revision + 1 WHERE id = ? AND revision = ?").bind(serialized, "content", row.revision).run();
  if (!result.success || result.meta?.changes !== 1) throw controlled("Content changed in another request. Reload and try again.", 409);
}
__name(commitState, "commitState");
function deriveModel(state) {
  const fields = {};
  const images = {};
  for (const [path, source] of Object.entries(state.pages)) {
    for (const match of source.matchAll(FIELD_RE)) {
      if (match.groups.tag.toLowerCase() !== match.groups.close.toLowerCase()) continue;
      fields[match.groups.key] ??= htmlText(match.groups.value);
    }
    for (const match of source.matchAll(IMAGE_RE)) {
      const key = match[1];
      const src = attr(match[0], "src");
      if (src) images[key] ??= path.startsWith("en/") ? src.replace(/^\.\.\//, "") : src;
    }
  }
  const projects = [];
  for (const match of state.pages["projeler.html"].matchAll(PROJECT_RE)) {
    const id = Number(match[1]);
    projects.push({ id, title_tr: fields[`project-${id}-title-tr`] || "", title_en: fields[`project-${id}-title-en`] || "" });
  }
  return { fields, images, projects };
}
__name(deriveModel, "deriveModel");
async function staticRead(env, pathname) {
  if (!env?.ASSETS?.fetch) return null;
  let url = new URL(pathname, "https://portfolio-assets.invalid");
  for (let i = 0; i < 4; i++) {
    const result = await env.ASSETS.fetch(new Request(url));
    if (result.status >= 300 && result.status < 400 && result.headers.get("location")) {
      const next = new URL(result.headers.get("location"), url);
      if (next.origin !== url.origin) return null;
      url = next; continue;
    }
    return result.ok ? new Uint8Array(await result.arrayBuffer()) : null;
  }
  return null;
}
__name(staticRead, "staticRead");
async function loadProjectTemplate(state, env) {
  if (typeof state.template === "string" && state.template.includes("__ID__")) return state.template;
  const raw = await staticRead(env, "/admin/project-template.html");
  if (!raw) throw controlled("Project template is unavailable", 503);
  const template = new TextDecoder().decode(raw);
  if (!template.includes("__ID__")) throw controlled("Project template is invalid", 500);
  return template;
}
__name(loadProjectTemplate, "loadProjectTemplate");
function localizeTemplate(source, id, language, title, category) {
  let card = source.replaceAll("__ID__", String(id));
  if (language === "en") {
    card = card.replaceAll('-tr"', '-en"');
    for (const [before, after] of [
      ["S\xFCre\xE7 ve sonu\xE7", "Process and outcome"],
      ["Ama\xE7", "Purpose"],
      ["Kullan\u0131lan teknolojiler", "Technologies"],
      ["Uygulama a\u015Famalar\u0131", "Implementation stages"],
      ["Sonu\xE7 / mevcut durum", "Result / current status"],
      ["Kar\u015F\u0131la\u015F\u0131lan sorunlar", "Challenges"]
    ]) card = card.replaceAll(before, after);
    card = card.replace(/data-field="project-\d+-category-en">.*?<\/p>/s, `data-field="project-${id}-category-en">${esc(category)}</p>`);
    card = card.replace(/data-field="project-\d+-title-en">.*?<\/h3>/s, `data-field="project-${id}-title-en">${esc(title)}</h3>`);
    card = card.replace(/data-field="project-\d+-desc-en">.*?<\/p>/s, `data-field="project-${id}-desc-en">A new project draft. Details have not been added yet.</p>`);
    card = card.replace(/data-field="project-\d+-purpose-en">.*?<\/p>/s, `data-field="project-${id}-purpose-en">Not documented yet.</p>`);
    card = card.replace(/data-field="project-\d+-tech-en">.*?<\/p>/s, `data-field="project-${id}-tech-en">Not specified yet.</p>`);
    card = card.replace(/data-field="project-\d+-steps-en">.*?<\/p>/s, `data-field="project-${id}-steps-en">No implementation stages have been documented yet.</p>`);
    card = card.replace(/data-field="project-\d+-result-en">.*?<\/p>/s, `data-field="project-${id}-result-en">Draft \u2014 not presented as completed work.</p>`);
    card = card.replace(/data-field="project-\d+-challenges-en">.*?<\/p>/s, `data-field="project-${id}-challenges-en">Not documented yet.</p>`);
    card = card.replace(/alt="[^"]*"/, 'alt="Project draft illustration"');
  } else {
    card = card.replace(/data-field="project-\d+-category-tr">.*?<\/p>/s, `data-field="project-${id}-category-tr">${esc(category)}</p>`);
    card = card.replace(/data-field="project-\d+-title-tr">.*?<\/h3>/s, `data-field="project-${id}-title-tr">${esc(title)}</h3>`);
    card = card.replace(/data-field="project-\d+-desc-tr">.*?<\/p>/s, `data-field="project-${id}-desc-tr">Yeni proje tasla\u011F\u0131. Ayr\u0131nt\u0131lar hen\xFCz eklenmedi.</p>`);
    card = card.replace(/data-field="project-\d+-purpose-tr">.*?<\/p>/s, `data-field="project-${id}-purpose-tr">Hen\xFCz belgelenmedi.</p>`);
    card = card.replace(/data-field="project-\d+-tech-tr">.*?<\/p>/s, `data-field="project-${id}-tech-tr">Hen\xFCz belirtilmedi.</p>`);
    card = card.replace(/data-field="project-\d+-steps-tr">.*?<\/p>/s, `data-field="project-${id}-steps-tr">Uygulama a\u015Famalar\u0131 hen\xFCz belgelenmedi.</p>`);
    card = card.replace(/data-field="project-\d+-result-tr">.*?<\/p>/s, `data-field="project-${id}-result-tr">Taslak \u2014 tamamlanm\u0131\u015F \xE7al\u0131\u015Fma olarak sunulmaz.</p>`);
    card = card.replace(/data-field="project-\d+-challenges-tr">.*?<\/p>/s, `data-field="project-${id}-challenges-tr">Hen\xFCz belgelenmedi.</p>`);
    card = card.replace(/alt="[^"]*"/, 'alt="Proje tasla\u011F\u0131 ill\xFCstrasyonu"');
  }
  card = card.replace(/(<span class="project-index"[^>]*>).*?(<\/span>)/s, (_, a, b) => `${a}${String(id).padStart(2, "0")}${b}`);
  return card;
}
__name(localizeTemplate, "localizeTemplate");
function insertCard(source, card) {
  const marker = "<!-- PROJECTS:END -->";
  if (!source.includes("<!-- PROJECTS:START -->") || !source.includes(marker)) throw controlled("Project area is missing from a page", 500);
  return source.replace(marker, `${card}${marker}`);
}
__name(insertCard, "insertCard");
async function getModel(_request, env) {
  try {
    const { value } = await readState(env);
    return json2(deriveModel(value));
  } catch (err2) {
    return fail(err2);
  }
}
__name(getModel, "getModel");
async function servePage(request, env) {
  try {
    const pathname = new URL(request.url).pathname.replace(/^\/+/, "") || "index.html";
    const path = pathname.endsWith("/") ? `${pathname}index.html` : PAGE_PATHS.includes(pathname + ".html") ? pathname + ".html" : pathname;
    if (path === "oyun/index.html") {
      const bytes = await staticRead(env, "/oyun/index.html");
      return bytes ? response(bytes, 200, PAGE_HEADERS) : response("Not found", 404, { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" });
    }
    if (!PAGE_PATHS.includes(path)) return response("Not found", 404, { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" });
    const { value } = await readState(env);
    return response(value.pages[path], 200, PAGE_HEADERS);
  } catch (err2) {
    return response(String(err2?.message || "Unable to serve page"), Number(err2?.status) || 500, { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" });
  }
}
__name(servePage, "servePage");
async function saveFields(request, env) {
  try {
    const payload = await request.json();
    const fields = payload?.fields;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) throw controlled("Invalid fields");
    const { row, value } = await readState(env);
    const known = deriveModel(value).fields;
    for (const [key, text] of Object.entries(fields)) {
      if (!Object.hasOwn(known, key)) throw controlled(`Unknown content field: ${key}`);
      if (typeof text !== "string") throw controlled(`Field ${key} must be text`);
      if (text.length > 2e4) throw controlled(`Field ${key} exceeds 20,000 characters`);
    }
    let updated = 0;
    for (const path of PAGE_PATHS) {
      value.pages[path] = value.pages[path].replace(FIELD_RE, (whole, open, tag, key, oldValue, close, closeTag) => {
        if (!Object.hasOwn(fields, key)) return whole;
        if (tag.toLowerCase() !== closeTag.toLowerCase()) return whole;
        updated++;
        return `${open}${esc(fields[key])}${close}`;
      });
    }
    Object.assign(value.fields ||= {}, fields);
    await commitState(env, row, value);
    return json2({ updated });
  } catch (err2) {
    return fail(err2);
  }
}
__name(saveFields, "saveFields");
async function changeProject(request, env) {
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw controlled("Invalid project request");
    const { row, value } = await readState(env);
    const model = deriveModel(value);
    if (payload.action === "delete") {
      const id2 = Number(payload.id);
      if (!Number.isInteger(id2) || !model.projects.some((project) => project.id === id2)) throw controlled("Project not found", 404);
      const re = new RegExp(`<article\\b(?=[^>]*\\bdata-project-id="${id2}")[^>]*>[\\s\\S]*?<\\/article>`, "gi");
      for (const path of ["index.html", "projeler.html", "en/index.html", "en/projects.html"]) value.pages[path] = value.pages[path].replace(re, "");
      value.projects = model.projects.filter((project) => project.id !== id2);
      await commitState(env, row, value);
      return json2({ id: id2, model: deriveModel(value) });
    }
    if (payload.action !== "add") throw controlled("Invalid project action");
    const titleTr = payload.title_tr ?? "Yeni proje (taslak)";
    const titleEn = payload.title_en ?? "New project (draft)";
    const categoryTr = payload.category_tr ?? "Di\u011Fer";
    const categoryEn = payload.category_en ?? "Other";
    for (const [name, item, limit2] of [["Turkish title", titleTr, 160], ["English title", titleEn, 160], ["Turkish category", categoryTr, 80], ["English category", categoryEn, 80]]) {
      if (typeof item !== "string" || !item.trim() || item.length > limit2) throw controlled(`${name} must be 1\u2013${limit2} characters`);
    }
    const id = Math.max(Number(value.nextProjectId) || 4, ...model.projects.map((project) => project.id + 1), 4);
    const template = await loadProjectTemplate(value, env);
    for (const [path, lang, title, category, prefix] of [
      ["index.html", "tr", titleTr, categoryTr, ""],
      ["projeler.html", "tr", titleTr, categoryTr, ""],
      ["en/index.html", "en", titleEn, categoryEn, "../"],
      ["en/projects.html", "en", titleEn, categoryEn, "../"]
    ]) {
      const card = localizeTemplate(template, id, lang, title.trim(), category.trim()).replace(/src="assets\//g, `src="${prefix}assets/`);
      value.pages[path] = insertCard(value.pages[path], card);
    }
    value.nextProjectId = id + 1;
    value.projects = [...model.projects, { id, title_tr: titleTr.trim(), title_en: titleEn.trim() }];
    await commitState(env, row, value);
    return json2({ id, model: deriveModel(value) });
  } catch (err2) {
    return fail(err2);
  }
}
__name(changeProject, "changeProject");
function sniffImage(bytes, filename, declaredType) {
  const ext = String(filename || "").toLowerCase().match(/\.(png|jpe?g|webp|gif)$/)?.[1];
  if (!ext) throw controlled("Use PNG, JPG, WEBP or GIF");
  const is = /* @__PURE__ */ __name((...nums) => nums.every((n, i2) => bytes[i2] === n), "is");
  const valid = ext === "png" ? is(137, 80, 78, 71, 13, 10, 26, 10) : ext === "jpg" || ext === "jpeg" ? is(255, 216, 255) : ext === "gif" ? new TextDecoder().decode(bytes.subarray(0, 6)).match(/^GIF8[79]a$/) : is(82, 73, 70, 70) && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP";
  if (!valid) throw controlled("Image file signature does not match its extension");
  const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/gif";
  if (declaredType && declaredType !== "application/octet-stream" && declaredType !== mime) throw controlled("Image MIME type does not match its contents");
  return { ext: ext === "jpeg" ? "jpg" : ext, mime };
}
__name(sniffImage, "sniffImage");
async function uploadImage(request, env) {
  try {
    const form = await request.formData();
    const key = form.get("name");
    const file = form.get("file");
    if (typeof key !== "string" || !file || typeof file.arrayBuffer !== "function") throw controlled("Image key and file are required");
    const { row, value } = await readState(env);
    if (!Object.hasOwn(deriveModel(value).images, key)) throw controlled("Unknown image field");
    if (file.size < 1 || file.size > MAX_UPLOAD) throw controlled("Image must be no larger than 5 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { ext, mime } = sniffImage(bytes, file.name, file.type);
    const id = crypto.randomUUID();
    const path = `media/${id}.${ext}`;
    const statement = dbFor(env).prepare("INSERT INTO uploads(id, mime, size) VALUES(?, ?, ?)").bind(id, mime, bytes.length);
    const chunks = [];
    for (let offset = 0, part = 0; offset < bytes.length; offset += CHUNK_SIZE, part++) {
      chunks.push(dbFor(env).prepare("INSERT INTO upload_chunks(upload_id, part, data) VALUES(?, ?, ?)").bind(id, part, bytes.slice(offset, offset + CHUNK_SIZE).buffer));
    }
    await dbFor(env).batch([statement, ...chunks]);
    const relative = value.pages["en/index.html"].includes(`data-image="${key}"`) ? `../${path}` : path;
    for (const page of PAGE_PATHS) {
      const prefix = page.startsWith("en/") ? "../" : "";
      value.pages[page] = value.pages[page].replace(IMAGE_RE, (tag) => {
        if (attr(tag, "data-image") !== key) return tag;
        return tag.replace(/\bsrc="[^"]*"/i, `src="${prefix}${path}"`).replace(/; (?:placeholder|yer tutucu)/gi, "");
      });
    }
    value.images ||= {};
    value.images[key] = path;
    await commitState(env, row, value);
    return json2({ path });
  } catch (err2) {
    return fail(err2);
  }
}
__name(uploadImage, "uploadImage");
async function serveMedia(request, env) {
  try {
    const match = new URL(request.url).pathname.match(/^\/media\/([0-9a-f-]{36})\.(png|jpe?g|webp|gif)$/i);
    if (!match) return response("Not found", 404, { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" });
    const id = match[1];
    const db = dbFor(env);
    const row = await db.prepare("SELECT mime, size FROM uploads WHERE id = ?").bind(id).first();
    if (!row) return response("Not found", 404, { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" });
    const result = await db.prepare("SELECT data FROM upload_chunks WHERE upload_id = ? ORDER BY part").bind(id).all();
    const chunks = result.results || [];
    const normalized = chunks.map((item) => asBytes(item.data));
    const bytes = new Uint8Array(normalized.reduce((n, chunk) => n + chunk.byteLength, 0));
    let offset = 0;
    for (const chunk of normalized) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (bytes.length !== row.size) throw controlled("Stored image is incomplete", 500);
    return response(bytes, 200, {
      "content-type": row.mime,
      "content-length": String(row.size),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin"
    });
  } catch (err2) {
    return fail(err2);
  }
}
__name(serveMedia, "serveMedia");
var DEFAULT_ASSETS = [
  "kaynak.txt",
  "LICENSE-NOTE.txt",
  "LICENSE-Phantom.txt",
  "assets/css/style.css",
  "assets/css/main.css",
  "assets/css/noscript.css",
  "assets/css/fontawesome-all.min.css",
  "assets/js/site.js",
  "assets/js/enhancements.js",
  "assets/js/cinematic.js",
  "assets/js/projects-extra.js",
  "assets/img/blog-ai.svg",
  "assets/img/blog-css.svg",
  "assets/img/blog-html.svg",
  "assets/img/comparison-placeholder.svg",
  "assets/img/gallery-1.svg",
  "assets/img/gallery-2.svg",
  "assets/img/gallery-3.svg",
  "assets/img/portrait.svg",
  "assets/img/project-1.svg",
  "assets/img/project-2.svg",
  "assets/img/project-3.svg",
  "images/logo.svg",
  "oyun/index.html",
  "oyun/style.css",
  "oyun/game.js",
  "oyun/tanitim-gorseli.png"
];
var MIME_EXTS = { "image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "text/html; charset=utf-8": "html", "text/css; charset=utf-8": "css", "text/javascript; charset=utf-8": "js" };
async function exportZip(_request, env) {
  try {
    const { value } = await readState(env);
    const files = /* @__PURE__ */ Object.create(null);
    for (const [path, source] of Object.entries(value.pages)) {
      files[path] = new TextEncoder().encode(source.replace(/<a\b(?=[^>]*\bclass="adminlink")[^>]*>[\s\S]*?<\/a>\s*(?:·|Â·)?\s*/gi, ""));
    }
    const paths = Array.isArray(value.assetFiles) ? value.assetFiles : DEFAULT_ASSETS;
    for (const path of paths) {
      if (typeof path !== "string" || path.startsWith("/") || path.includes("..") || path.startsWith("admin/")) continue;
      if (Object.hasOwn(value.pages, path)) continue;
      const bytes = await staticRead(env, `/${path}`);
      if (bytes) files[path] = bytes;
    }
    const uploads = await dbFor(env).prepare("SELECT id, mime FROM uploads").all();
    for (const item of uploads.results || []) {
      const ext = MIME_EXTS[item.mime] || "bin";
      const path = `media/${item.id}.${ext}`;
      const result = await dbFor(env).prepare("SELECT data FROM upload_chunks WHERE upload_id = ? ORDER BY part").bind(item.id).all();
      const chunks = result.results || [];
      const normalized = chunks.map((chunk) => asBytes(chunk.data));
      const bytes = new Uint8Array(normalized.reduce((n, chunk) => n + chunk.byteLength, 0));
      let offset = 0;
      for (const data of normalized) {
        bytes.set(data, offset);
        offset += data.byteLength;
      }
      files[path] = bytes;
    }
    const archive = zipSync(files, { level: 0 });
    return response(archive, 200, {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="portfolio-site.zip"',
      "content-length": String(archive.byteLength),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
  } catch (err2) {
    return fail(err2);
  }
}
__name(exportZip, "exportZip");

// worker.mjs
var publicAdmin = /* @__PURE__ */ new Set(["/admin/login", "/admin/login.html", "/admin/login.js", "/admin/admin.css"]);
var privateAdmin = /* @__PURE__ */ new Set(["/admin/", "/admin/index.html", "/admin/admin.js", "/admin/project-tools.js", "/admin/session.js"]);
var sitePages = /* @__PURE__ */ new Set(["/", "/index.html", "/hakkimda.html", "/projeler.html", "/galeri.html", "/blog.html", "/iletisim.html", "/en/", "/en/index.html", "/en/about.html", "/en/projects.html", "/en/gallery.html", "/en/blog.html", "/en/contact.html", "/oyun/index.html", "/komur.html", "/en/komur.html", "/komur", "/en/komur"]);
var publicFiles = /* @__PURE__ */ new Set(["/kaynak.txt", "/LICENSE-NOTE.txt", "/LICENSE-Phantom.txt"]);
var json3 = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }), "json");
var redirectLogin = /* @__PURE__ */ __name(() => new Response(null, { status: 303, headers: { Location: "/admin/login.html", "Cache-Control": "no-store" } }), "redirectLogin");
function safePath(url) {
  let path;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (path.includes("\\") || path.includes("\0") || path.split("/").some((p) => p === "." || p === ".." || p.startsWith("."))) return null;
  return path;
}
__name(safePath, "safePath");
function publicAsset(path) {
  return publicFiles.has(path) || /^\/(assets|images|oyun)\//.test(path) && /\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|mp3|mp4|webm|pdf)$/i.test(path);
}
__name(publicAsset, "publicAsset");
async function bounded(request, limit2) {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > limit2) throw Object.assign(new Error("\u0130stek \xE7ok b\xFCy\xFCk"), { status: 413 });
  if (!request.body) return request;
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit2) {
      await reader.cancel();
      throw Object.assign(new Error("\u0130stek \xE7ok b\xFCy\xFCk"), { status: 413 });
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    body.set(chunk, pos);
    pos += chunk.length;
  }
  return new Request(request, { body });
}
__name(bounded, "bounded");
async function dispatch(request, env) {
  const url = new URL(request.url);
  const path = safePath(url);
  if (url.protocol !== "https:") return new Response("HTTPS required", { status: 400 });
  if (!path) return new Response("Not found", { status: 404 });
  const method = request.method.toUpperCase();
  if (method === "POST") {
    if (request.headers.get("Origin") !== url.origin) return json3({ error: "Ge\xE7ersiz istek kayna\u011F\u0131" }, 403);
    const limits = { "/api/login": 4096, "/api/logout": 4096, "/api/password": 4096, "/api/save": 2e6, "/api/projects": 2e4, "/api/image": 6 * 1024 * 1024 };
    if (!(path in limits)) return json3({ error: "Not found" }, 404);
    request = await bounded(request, limits[path]);
    if (path === "/api/login") return login(request, env);
    if (!await isAuthenticated(request, env)) return json3({ error: "Oturum a\xE7\u0131n" }, 401);
    if (path === "/api/logout") return logout(request, env);
    if (path === "/api/password") return changePassword(request, env);
    if (path === "/api/save") return saveFields(request, env);
    if (path === "/api/projects") return changeProject(request, env);
    if (path === "/api/image") return uploadImage(request, env);
  }
  if (method !== "GET" && method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD, POST" } });
  if (path.startsWith("/api/")) {
    if (!await isAuthenticated(request, env)) return json3({ error: "Oturum a\xE7\u0131n" }, 401);
    if (method === "HEAD") return new Response(null, { status: 405 });
    if (path === "/api/data") return getModel(request, env);
    if (path === "/api/export") return exportZip(request, env);
    return json3({ error: "Not found" }, 404);
  }
  if (path === "/admin") return new Response(null, { status: 303, headers: { Location: "/admin/" } });
  if (privateAdmin.has(path) && !await isAuthenticated(request, env)) return path === "/admin/" || path === "/admin/index.html" ? redirectLogin() : new Response("Not found", { status: 404 });
  if (path.startsWith("/admin/") && !publicAdmin.has(path) && !privateAdmin.has(path)) return new Response("Not found", { status: 404 });
  let response2;
  if (publicAdmin.has(path) || privateAdmin.has(path)) {
    const target = new URL(request.url);
    if (path === "/admin/index.html") target.pathname = "/admin/";
    response2 = await env.ASSETS.fetch(new Request(target, request));
  } else if (path.startsWith("/media/")) response2 = await serveMedia(request, env);
  else if (sitePages.has(path)) response2 = await servePage(request, env);
  else if (publicAsset(path)) response2 = await env.ASSETS.fetch(request);
  else return new Response("Not found", { status: 404 });
  if (method === "HEAD") return new Response(null, { status: response2.status, statusText: response2.statusText, headers: response2.headers });
  return response2;
}
__name(dispatch, "dispatch");
var worker_default = {
  async fetch(request, env) {
    try {
      return await dispatch(request, env);
    } catch (error) {
      const status = Number(error?.status);
      if (status >= 400 && status < 500) return json3({ error: error.message }, status);
      console.error("Worker request failed");
      return json3({ error: "Sunucu hatas\u0131" }, 500);
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
