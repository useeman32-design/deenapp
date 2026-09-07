#!/usr/bin/env python3
"""pass 77 harness: nested comment replies — "Replying to" must name the
DIRECT parent reply author, not the root comment author. Chain:
A comments on post → B replies to A → C replies to B → D replies to C."""
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

A = Sess(); B = Sess(); C = Sess(); D = Sess()
uA, _ = register(A, "n77a", "Alpha Tester")
uB, _ = register(B, "n77b", "Bravo Tester")
uC, _ = register(C, "n77c", "Charlie Tester")
uD, _ = register(D, "n77d", "Delta Tester")

st, j = A.req("/api/feed/create_post.php", data={"content_text": f"nested reply chain {RUN}", "visibility": "public"})
pid = int(j.get("post_id") or 0)
check("A creates the post", st == 200 and pid > 0, f"{st} {str(j)[:100]}")

st, j = A.req("/api/feed/add_comment.php", raw_body=json.dumps({"post_id": pid, "text": "root comment by A"}))
cA = int(j.get("comment_id") or 0)
check("A comments on the post", st == 200 and cA > 0, f"{st} {str(j)[:100]}")

st, j = B.req("/api/feed/add_reply.php", raw_body=json.dumps({"post_id": pid, "comment_id": cA, "parent_reply_id": 0, "text": "B replies to A"}))
rB = int(j.get("reply_id") or 0)
check("B replies to A's comment", st == 200 and rB > 0, f"{st} {str(j)[:100]}")

st, j = C.req("/api/feed/add_reply.php", raw_body=json.dumps({"post_id": pid, "comment_id": cA, "parent_reply_id": rB, "text": "C replies to B"}))
rC = int(j.get("reply_id") or 0)
check("C replies to B's reply", st == 200 and rC > 0, f"{st} {str(j)[:100]}")

st, j = D.req("/api/feed/add_reply.php", raw_body=json.dumps({"post_id": pid, "comment_id": cA, "parent_reply_id": rC, "text": "D replies to C"}))
rD = int(j.get("reply_id") or 0)
check("D replies to C's reply (4 deep)", st == 200 and rD > 0, f"{st} {str(j)[:100]}")

# ── what the client receives ──
st, gc = C.req(f"/api/feed/get_comments.php?post_id={pid}")
nodes = {}
def walk(rows):
    for n in rows:
        nodes[int(n["id"])] = n
        if n.get("replies"): walk(n["replies"])
for c in gc.get("comments", []):
    walk(c.get("replies") or [])
check("get_comments returns all 4 replies", all(x in nodes for x in (rB, rC, rD)), f"got {sorted(nodes)}")

if rB in nodes:
    check("B's reply → reply_to_username = A (root comment author)",
          nodes[rB].get("reply_to_username") == uA, str(nodes[rB].get("reply_to_username")))
if rC in nodes:
    check("C's reply → parent_reply_id = B's reply", nodes[rC].get("parent_reply_id") == rB, str(nodes[rC].get("parent_reply_id")))
    check("C's reply → reply_to_username = B (NOT A)",
          nodes[rC].get("reply_to_username") == uB, f"got {nodes[rC].get('reply_to_username')} want {uB}")
if rD in nodes:
    check("D's reply → parent_reply_id = C's reply", nodes[rD].get("parent_reply_id") == rC, str(nodes[rD].get("parent_reply_id")))
    check("D's reply → reply_to_username = C (NOT A)",
          nodes[rD].get("reply_to_username") == uC, f"got {nodes[rD].get('reply_to_username')} want {uC}")

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
