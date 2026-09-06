#!/usr/bin/env python3
"""pass 76 (Tier 3) harness: server-enforced blocking — DMs, starts, follows,
search visibility, blocks list, unblock reopen."""
import json, sys, time, urllib.request, urllib.parse, urllib.error, http.cookiejar, subprocess

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8201"
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
    return uname, int(sql(f"SELECT id FROM users WHERE username='{uname}';"))

A = Sess(); B = Sess()
uA, aid = register(A, "b76a", "Blocker Tester")
uB, bid = register(B, "b76b", "Blocked Tester")

# ── conversation exists before the block ──
st, j = A.req("/api/chat/start_username.php", raw_body=json.dumps({"username": uB}))
conv = int(j.get("conversation_id") or 0)
check("DM opens before block", st == 200 and conv > 0, f"{st} {str(j)[:80]}")
st, j = A.req("/api/chat/send.php", raw_body=json.dumps({"conversation_id": conv, "body": f"hello before block {RUN}"}))
check("send works before block", st == 200, f"{st} {str(j)[:80]}")

# ── self-block rejected ──
st, j = A.req("/api/users/block_action.php", raw_body=json.dumps({"username": uA, "action": "block"}))
check("cannot block yourself", st == 400, f"{st} {str(j)[:80]}")

# ── A blocks B ──
st, j = A.req("/api/users/block_action.php", raw_body=json.dumps({"username": uB, "action": "block"}))
check("A blocks B", st == 200 and j.get("blocked") is True, f"{st} {str(j)[:100]}")
row = sql(f"SELECT COUNT(*) FROM user_blocks WHERE blocker_id={aid} AND blocked_id={bid};")
check("user_blocks row exists", int(row or 0) == 1, f"rows={row}")

# ── blocks list ──
st, j = A.req("/api/users/blocks_list.php")
blocks = j.get("blocks") or []
check("blocks_list shows B", st == 200 and any(int(b.get("user_id")) == bid for b in blocks), f"{st} {str(j)[:120]}")

# ── DM sealed in both directions ──
st, j = A.req("/api/chat/send.php", raw_body=json.dumps({"conversation_id": conv, "body": f"after block from A {RUN}"}))
check("blocker cannot send", st == 403 and j.get("code") == "blocked", f"{st} {str(j)[:80]}")
st, j = B.req("/api/chat/start_username.php", raw_body=json.dumps({"username": uA}))
check("blocked cannot open DM", st == 403 and j.get("code") == "blocked", f"{st} {str(j)[:80]}")
# B is a member of the conv; its sends must also be refused
st, j = B.req("/api/chat/send.php", raw_body=json.dumps({"conversation_id": conv, "body": f"after block from B {RUN}"}))
check("blocked cannot send", st == 403 and j.get("code") == "blocked", f"{st} {str(j)[:80]}")
st, j = B.req("/api/chat/send_share.php", raw_body=json.dumps({"conversation_id": conv, "kind": "post", "title": "share while blocked", "ref_id": 1}))
check("blocked cannot share", st == 403 and j.get("code") == "blocked", f"{st} {str(j)[:80]}")

# ── follow sealed ──
st, j = B.req("/api/users/toggle_follow.php", raw_body=json.dumps({"user_id": aid, "desired_following": True}))
check("blocked cannot follow", st == 403 and j.get("code") == "blocked", f"{st} {str(j)[:80]}")

# ── search hides in both directions ──
st, j = A.req(f"/api/users/search_accounts.php?q={uB}")
names = [r.get("username") for r in (j.get("results") or [])]
check("A's search hides B", uB not in names, str(names)[:120])
st, j = B.req(f"/api/users/search_accounts.php?q={uA}")
names = [r.get("username") for r in (j.get("results") or [])]
check("B's search hides A", uA not in names, str(names)[:120])

# ── unblock reopens ──
st, j = A.req("/api/users/block_action.php", raw_body=json.dumps({"username": uB, "action": "unblock"}))
check("A unblocks B", st == 200 and j.get("blocked") is False, f"{st} {str(j)[:100]}")
st, j = A.req("/api/users/blocks_list.php")
check("blocks_list empty after unblock", len(j.get("blocks") or []) == 0, str(j)[:100])
stt = sql(f"SELECT status FROM chat_conversations WHERE id={conv};")
check("DM reopened as request", stt == "request", stt)
# B answers → auto-accept (B is not the requester)
st, j = B.req("/api/chat/send.php", raw_body=json.dumps({"conversation_id": conv, "body": f"after unblock from B {RUN}"}))
check("send works after unblock", st == 200, f"{st} {str(j)[:80]}")
st, j = B.req("/api/users/toggle_follow.php", raw_body=json.dumps({"user_id": aid, "desired_following": True}))
check("follow works after unblock", st == 200, f"{st} {str(j)[:80]}")

passed = sum(results)
print(f"\n{passed}/{len(results)} passed")
sys.exit(0 if passed == len(results) else 1)
