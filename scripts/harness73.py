#!/usr/bin/env python3
"""pass-73 harness: me.php profile_image_url (avatar persistence across
refresh) + chat-share delivery (multi-send picker) + account search."""
import json, sys, time, urllib.request, urllib.parse, urllib.error, http.cookiejar, subprocess

BASE = "http://127.0.0.1:8201"
RUN = str(int(time.time()))
results = []

class Sess:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.csrf = None
    def req(self, path, data=None, raw_body=None):
        headers = {}
        if self.csrf: headers["X-CSRF-Token"] = self.csrf
        body = None
        if raw_body is not None:
            body = raw_body.encode(); headers["Content-Type"] = "application/json"
        elif data is not None:
            body = urllib.parse.urlencode(data).encode()
        r = urllib.request.Request(BASE + path, data=body, headers=headers, method="POST" if body else "GET")
        try:
            with self.op.open(r, timeout=20) as resp:
                return resp.status, json.loads(resp.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            try: return e.code, json.loads(e.read().decode() or "{}")
            except Exception: return e.code, {}
    def csrf_get(self):
        st, j = self.req("/api/auth/csrf.php")
        self.csrf = j.get("csrf_token") or j.get("token")

def sql(q):
    return subprocess.run(["mariadb", "-h", "127.0.0.1", "-P", "3311", "-u", "root", "-p..", "deenlink", "-N", "-e", q],
                          capture_output=True, text=True).stdout.strip()

def check(label, cond, extra=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + label + ("" if cond else f"  << {extra}"))

def register(sess, tag, disp):
    uname, email = f"{tag}{RUN}", f"{tag}{RUN}@t.co"
    sess.csrf_get()
    st, j = sess.req("/api/auth/register.php", raw_body=json.dumps({
        "full_name": disp, "username": uname, "email": email,
        "password": "Str0ngPass!23", "confirm_password": "Str0ngPass!23", "agree_terms": True, "aqeedah": "Sunni"}))
    assert st in (200, 201) and j.get("status") == "success", f"register {tag}: {st} {str(j)[:140]}"
    return uname, sql(f"SELECT id FROM users WHERE username='{uname}';")

A = Sess(); B = Sess()
uA, aid = register(A, "av73a", "Alice Tester")
uB, bid = register(B, "av73b", "Bobby Tester")

# ── 1. me.php profile_image_url ──
st, j = A.req("/api/auth/me.php")
u = j.get("user") or {}
check("fresh account → empty profile_image_url", st == 200 and u.get("profile_image_url") == "", f"{st} {str(u)[:140]}")

sql(f"UPDATE users SET profile_image='av73pic.jpg' WHERE id={aid};")
st, j = A.req("/api/auth/me.php")
piu = (j.get("user") or {}).get("profile_image_url") or ""
check("uploaded filename → absolute uploads URL", piu == f"{BASE}/uploads/profile/av73pic.jpg", f"got {piu}")

sql(f"UPDATE users SET profile_image='default_profile.jpg' WHERE id={aid};")
st, j = A.req("/api/auth/me.php")
check("default_profile.jpg → empty URL (SVG default renders)", (j.get("user") or {}).get("profile_image_url") == "", f"{st} {str(j.get('user'))[:120]}")

# ── 2. account search (picker search field) ──
st, j = B.req(f"/api/users/search_accounts.php?q={uA}&limit=10")
hits = [r for r in (j.get("results") or []) if r.get("username") == uA]
check("search finds account by username", st == 200 and len(hits) == 1, f"{st} {str(j)[:160]}")

# ── 3. chat-share delivery (what the multi-send picker does) ──
st, j = A.req("/api/chat/start.php", raw_body=json.dumps({"user_id": int(bid)}))
conv = j.get("conversation_id") or j.get("id") or (j.get("conversation") or {}).get("id")
check("A opens DM with B", st in (200, 201) and conv, f"{st} {str(j)[:140]}")

st, j = A.req("/api/chat/send_share.php", raw_body=json.dumps({
    "conversation_id": int(conv), "kind": "post",
    "title": f"Shared post {RUN}", "payload": {"sub": f"@{uA} · DeenLink"}}))
sid = j.get("id") or (j.get("share") or {}).get("id")
check("A sends a post share", st in (200, 201) and sid, f"{st} {str(j)[:140]}")

st, j = B.req(f"/api/chat/messages.php?conversation_id={int(conv)}")
shares = j.get("shares") or []
hit = next((s for s in shares if str(s.get("id")) == str(sid)), None)
check("B receives the share in the thread", st == 200 and hit is not None and hit.get("title") == f"Shared post {RUN}", f"{st} {str(j)[:200]}")

st, j = A.req("/api/chat/send_share.php", raw_body=json.dumps({
    "conversation_id": int(conv), "kind": "reel",
    "title": f"Shared reel {RUN}", "payload": {"sub": "reel"}}))
check("reel share kind accepted", st in (200, 201) and (j.get("id") or (j.get("share") or {}).get("id")), f"{st} {str(j)[:120]}")

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
