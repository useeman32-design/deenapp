#!/usr/bin/env python3
"""pass-68 harness: realtime chat (typing + notifications + since-polling) + post search."""
import json, re, subprocess, sys, time, urllib.request, urllib.parse, http.cookiejar

BASE = "http://127.0.0.1:8201"
RUN = str(int(time.time()))
results = []

class Sess:
    def __init__(self, name):
        self.name = name
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.csrf = None
        self.user_id = None
        self.username = None

    def req(self, path, data=None, method=None, raw_body=None):
        url = BASE + path
        headers = {}
        if self.csrf:
            headers["X-CSRF-Token"] = self.csrf
        body = None
        if raw_body is not None:
            body = raw_body.encode()
            headers["Content-Type"] = "application/json"
        elif data is not None:
            body = urllib.parse.urlencode(data).encode()
        r = urllib.request.Request(url, data=body, headers=headers, method=method or ("POST" if body else "GET"))
        try:
            with self.op.open(r, timeout=20) as resp:
                return resp.status, json.loads(resp.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read().decode() or "{}")
            except Exception:
                return e.code, {}

    def csrf_get(self):
        st, j = self.req("/api/auth/csrf.php")
        self.csrf = j.get("csrf_token") or j.get("token")
        return self.csrf

def check(label, cond, extra=""):
    results.append((label, bool(cond)))
    print(("PASS " if cond else "FAIL ") + label + ("" if cond else f"  << {extra}"))

def register(s, uname, email):
    s.csrf_get()
    st, j = s.req("/api/auth/register.php", raw_body=json.dumps({
        "full_name": "Probe Tester", "username": uname, "email": email, "aqeedah": "Sunni",
        "password": "Str0ngPass!23", "confirm_password": "Str0ngPass!23",
        "agree_terms": True}))
    return st, j

def login(s, email):
    s.csrf_get()
    st, j = s.req("/api/auth/login.php", raw_body=json.dumps({
        "identifier": email, "password": "Str0ngPass!23", "remember_me": True}))
    return st, j

A, B = Sess("A"), Sess("B")
ua, ub = f"probe68a{RUN}", f"probe68b{RUN}"
ea, eb = f"probe68a{RUN}@t.co", f"probe68b{RUN}@t.co"

st, j = register(A, ua, ea); check("register A", st in (200, 201) and j.get("status") == "success", f"{st} {j}")
st, j = register(B, ub, eb); check("register B", st in (200, 201) and j.get("status") == "success", f"{st} {j}")
if j.get("needs_verification"):
    for s, e in ((A, ea), (B, eb)):
        html = open("/tmp/otp_last.html").read()
        m = re.findall(r"code=(\d{6})", html) or re.findall(r"(\d{6})", html)
        st, j2 = s.req("/api/auth/verify_otp.php", raw_body=json.dumps({"email": e, "code": m[-1]}))
        check(f"otp {s.name}", st == 200, f"{st} {j2}")
st, j = login(A, ea); check("login A", st == 200, f"{st} {j}")
st, j = login(B, eb); check("login B", st == 200, f"{st} {j}")

# --- open DM A→B by username
A.csrf_get(); B.csrf_get()
st, j = A.req("/api/chat/start_username.php", raw_body=json.dumps({"username": ub}))
cid = int(j.get("conversation_id") or 0)
check("start_username → cid", st == 200 and cid > 0, f"{st} {j}")

# --- typing indicator
st, j = A.req("/api/chat/typing.php", raw_body=json.dumps({"conversation_id": cid, "typing": 1}))
check("A typing ping", st == 200, f"{st} {j}")
st, j = B.req(f"/api/chat/messages.php?conversation_id={cid}")
check("B sees peer_typing=true", st == 200 and j.get("peer_typing") is True, f"{st} peer_typing={j.get('peer_typing')}")

# --- send: A → B, notification + since-poll
st, j = A.req("/api/chat/send.php", raw_body=json.dumps({"conversation_id": cid, "body": "Assalamu alaikum — realtime probe"}))
mid = int(j.get("id") or 0)
check("A sends message", st == 200 and mid > 0, f"{st} {j}")
st, j = B.req(f"/api/chat/messages.php?conversation_id={cid}&since_id=0&since_share_id=0")
msgs = j.get("messages") or []
check("B light-poll gets the message", any(m["id"] == mid for m in msgs), f"n={len(msgs)}")
check("typing cleared after send", j.get("peer_typing") is False, f"peer_typing={j.get('peer_typing')}")

st, j = B.req("/api/notifications/list.php?limit=10")
rows = j.get("notifications") or j.get("items") or []
chat_n = [n for n in rows if str(n.get("type")) == "chat_message"]
check("B has chat_message notification", len(chat_n) >= 1, f"types={[n.get('type') for n in rows][:5]}")
if chat_n:
    check("notification names sender", ua in str(chat_n[0].get("title", "")) + str(chat_n[0].get("actor_username", "")), str(chat_n[0])[:160])
    check("notification entity = conversation", str(chat_n[0].get("entity_id")) == str(cid), str(chat_n[0].get("entity_id")))

st, j = B.req("/api/notifications/unread_count.php")
check("B unread_count ≥ 1", st == 200 and int(j.get("unread_count") or 0) >= 1, f"{st} {j}")

# dedupe: second message refreshes the same row
st, j = A.req("/api/chat/send.php", raw_body=json.dumps({"conversation_id": cid, "body": "second message"}))
st, j = B.req("/api/notifications/list.php?limit=10")
rows = j.get("notifications") or j.get("items") or []
chat_n = [n for n in rows if str(n.get("type")) == "chat_message"]
check("notification deduped (still 1 row)", len(chat_n) == 1, f"n={len(chat_n)}")
if chat_n:
    check("deduped row shows newest body", "second message" in str(chat_n[0].get("body", "")), str(chat_n[0].get("body"))[:60])

# --- since_id excludes old rows
st, j = A.req(f"/api/chat/messages.php?conversation_id={cid}&since_id={mid}")
new_ids = [m["id"] for m in (j.get("messages") or [])]
check("since_id excludes old message", mid not in new_ids and len(new_ids) >= 1, f"ids={new_ids}")

# --- read watermark
B.req("/api/chat/read.php", raw_body=json.dumps({"conversation_id": cid}))
st, j = A.req(f"/api/chat/messages.php?conversation_id={cid}")
check("A sees peer_read_at after B reads", bool(j.get("peer_read_at")), f"peer_read_at={j.get('peer_read_at')}")

# --- typing expiry (6s server-side)
A.req("/api/chat/typing.php", raw_body=json.dumps({"conversation_id": cid, "typing": 1}))
time.sleep(7)
st, j = B.req(f"/api/chat/messages.php?conversation_id={cid}")
check("typing expires after 6s", j.get("peer_typing") is False, f"peer_typing={j.get('peer_typing')}")

# --- public post search
marker = f"DeenLinkProbe{RUN}"
st, j = A.req("/api/feed/create_post.php", data={"content_text": f"Assalamu alaikum {marker} searchable post"})
check("A creates post", st == 200, f"{st} {str(j)[:120]}")
time.sleep(1)
st, j = B.req("/api/feed/search_posts.php?q=" + urllib.parse.quote(marker))
posts = j.get("posts") or []
check("search_posts finds it (as other user)", st == 200 and any(marker in p.get("content_text", "") for p in posts), f"{st} n={len(posts)}")
if posts:
    p0 = posts[0]
    check("search row has user+counts", "user" in p0 and "like_count" in p0 and p0["user"].get("username") == ua, str(p0.get("user"))[:120])

# --- search_accounts still works
st, j = B.req("/api/users/search_accounts.php?q=" + ua[:12])
res = j.get("results") or []
check("search_accounts finds A", st == 200 and any(r.get("username") == ua for r in res), f"{st} n={len(res)}")

# --- anonymous search_posts allowed (public)
anon = Sess("anon")
st, j = anon.req("/api/feed/search_posts.php?q=" + urllib.parse.quote(marker))
check("search_posts works logged-out", st == 200 and len(j.get("posts") or []) >= 1, f"{st}")

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} PASS")
sys.exit(1 if fails else 0)
