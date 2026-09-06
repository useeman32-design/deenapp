#!/usr/bin/env python3
"""pass-70 harness: account discovery chain (search → profile → follow → suggestions →
comment author → DM) + live video reposts + viewer flags."""
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

def register(sess, tag):
    uname, email = f"{tag}{RUN}", f"{tag}{RUN}@t.co"
    sess.csrf_get()
    st, j = sess.req("/api/auth/register.php", raw_body=json.dumps({
        "full_name": ("Alice Tester" if tag.startswith("alice") else "Bobby Tester"), "username": uname, "email": email,
        "password": "Str0ngPass!23", "confirm_password": "Str0ngPass!23", "agree_terms": True, "aqeedah": "Sunni"}))
    return st, j, uname

# ── two fresh accounts (exactly like the user's test)
A = Sess(); B = Sess()
stA, jA, uA = register(A, "alice70")
stB, jB, uB = register(B, "bobby70")
check("register A + B", stA in (200, 201) and stB in (200, 201) and jA.get("status") == "success" and jB.get("status") == "success", f"{stA} {stB}")

# ── 1. B searches for A by username and by name
st, j = B.req(f"/api/users/search_accounts.php?q={uA}")
rows = j.get("results") or []
check("search finds A by username", st == 200 and any(r.get("username") == uA for r in rows), f"{st} {str(rows)[:140]}")
st, j = B.req("/api/users/search_accounts.php?q=Alice70")
check("search finds A by full name", st == 200 and any(r.get("username") == uA for r in (j.get("results") or [])), f"{st} {j}")

# ── 2. B opens A's public profile
st, j = B.req(f"/api/users/get_user_profile.php?u={uA}")
u = j.get("user") or {}
check("profile by username", st == 200 and u.get("username") == uA, f"{st} {str(j)[:140]}")

# ── 3. B follows A
aid = sql(f"SELECT id FROM users WHERE username='{uA}';")
bid = sql(f"SELECT id FROM users WHERE username='{uB}';")
st, j = B.req("/api/users/toggle_follow.php", raw_body=json.dumps({"user_id": int(aid), "desired_following": True}))
check("B follows A", st == 200 and j.get("status") == "success", f"{st} {j}")

# ── 4. suggestions for B include A (someone to follow back / discover)
st, j = A.req("/api/users/get_connections.php?tab=suggestions")
sugg = [str(x.get("username")) for x in (j.get("items") or [])]
check("suggestions list returns", st == 200 and j.get("status") == "success", f"{st} {str(j)[:140]}")
check("suggestions include B (for A)", uB in sugg, f"got {sugg[:8]}")

# ── 5. A posts, B comments, comment carries B's username (profile link source)
st, j = A.req("/api/feed/create_post.php", data={"content_text": f"Assalamu alaikum from harness70 {RUN}"})
pid = j.get("post_id") or j.get("id") or ((j.get("post") or {}).get("id"))
check("A creates post", st in (200, 201) and pid, f"{st} {str(j)[:140]}")
st, j = B.req("/api/feed/add_comment.php", raw_body=json.dumps({"post_id": int(pid), "text": "Wa alaikum salam! Found you via search."}))
check("B comments on A's post", st in (200, 201) and j.get("status") == "success", f"{st} {str(j)[:140]}")
st, j = A.req(f"/api/feed/get_comments.php?post_id={pid}")
coms = j.get("comments") or []
author = next((c for c in coms if "Found you via search" in (c.get("text") or "")), None)
check("comment exposes author username", author is not None and (author.get("user") or {}).get("username") == uB, f"{st} {str(coms)[:200]}")

# ── 6. B DMs A (start by username → send → A sees conversation)
st, j = B.req("/api/chat/start_username.php", raw_body=json.dumps({"username": uA}))
conv = j.get("conversation_id")
check("B starts chat with A by username", st in (200, 201) and conv, f"{st} {j}")
st, j = B.req("/api/chat/send.php", raw_body=json.dumps({"conversation_id": int(conv), "body": f"Salaam A, this is B ({RUN})"}))
check("B sends message", st in (200, 201) and (j.get("id") or j.get("status") == "success"), f"{st} {str(j)[:140]}")
st, j = A.req("/api/chat/conversations.php")
convs = j.get("conversations") or []
hit = next((c for c in convs if str(c.get("id")) == str(conv)), None)
check("A sees the conversation", st == 200 and hit is not None, f"{st} {str(convs)[:160]}")

# ── 7. video reposts (A owns a reel; B reposts / undoes; flag rides the list)
sql(f"INSERT INTO video_accounts (user_id, name, username, is_active) VALUES ({aid}, 'Alice70 Tester', '{uA}', 1);")
acc = sql(f"SELECT id FROM video_accounts WHERE user_id={aid};")
sql(f"INSERT INTO videos (video_type, source_type, source_url, title, account_id, reposts_count, status) VALUES ('reel', 'local', '/assets/videos/sample70.mp4', 'Harness70 reel {RUN}', {acc}, 0, 'active');")
vid = sql(f"SELECT id FROM videos WHERE title='Harness70 reel {RUN}';")
st, j = B.req("/api/videos/repost.php", raw_body=json.dumps({"video_id": int(vid), "action": "toggle"}))
dbc = sql(f"SELECT reposts_count FROM videos WHERE id={vid};")
check("B reposts A's reel", st == 200 and j.get("reposted") is True and int(j.get("repost_count", -1)) == 1, f"{st} {j} db_count={dbc}")
st, j = B.req("/api/videos/list.php?type=reel&limit=20&source=homepage")
items = j.get("items") or j.get("videos") or []
mine = next((it for it in items if str(it.get("id")) == str(vid)), None)
check("list returns items[] w/ repostedByMe=1", mine is not None and mine.get("repostedByMe") is True and int(mine.get("reposts") or 0) == 1, f"{st} {str(mine)[:200] if mine else 'reel missing: ' + str(items)[:120]}")
st, j = B.req("/api/videos/repost.php", raw_body=json.dumps({"video_id": int(vid), "action": "toggle"}))
check("B undo repost", st == 200 and j.get("reposted") is False and int(j.get("repost_count", 0)) == 0, f"{st} {j}")
st, j = B.req("/api/videos/repost.php", raw_body=json.dumps({"video_id": int(vid), "action": "repost"}))
check("explicit repost action", st == 200 and j.get("reposted") is True, f"{st} {j}")

# ── 8. A cannot repost own reel (server rule)
st, j = A.req("/api/videos/repost.php", raw_body=json.dumps({"video_id": int(vid), "action": "toggle"}))
check("own-reel repost rejected", st == 400, f"{st} {j}")

print(f"\n{sum(results)}/{len(results)} PASS")
sys.exit(0 if all(results) else 1)
