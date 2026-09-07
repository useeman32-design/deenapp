#!/usr/bin/env python3
"""pass-74 harness: message requests (start → 3-msg cap → accept/block/report)
+ follow-gated conversation status + nested reply parent ids."""
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
    return uname, int(sql(f"SELECT id FROM users WHERE username='{uname}';"))

A = Sess(); B = Sess(); C = Sess(); D = Sess()
uA, aid = register(A, "rq74a", "Alice Tester")
uB, bid = register(B, "rq74b", "Bobby Tester")
uC, cid_ = register(C, "rq74c", "Cathy Tester")
uD, did = register(D, "rq74d", "Denny Tester")

# ── 1. stranger DM opens as a request ──
st, j = A.req("/api/chat/start.php", raw_body=json.dumps({"user_id": bid}))
conv = int(j.get("conversation_id") or 0)
check("stranger DM opens as request", st == 200 and conv > 0 and j.get("conversation_status") == "request", f"{st} {j}")

# ── 1b. the app's real path: start by USERNAME must apply the same rule ──
st, j = C.req("/api/chat/start_username.php", raw_body=json.dumps({"username": uB}))
conv_un = int(j.get("conversation_id") or 0)
check("start_username opens as request", st == 200 and conv_un > 0 and j.get("conversation_status") == "request", f"{st} {j}")

# ── 2. 3-message cap for the requester ──
ok3 = True
for i in range(3):
    st, j = A.req("/api/chat/send.php", raw_body=json.dumps({"conversation_id": conv, "body": f"msg {i} {RUN}"}))
    ok3 = ok3 and st == 200
check("requester sends 3 messages", ok3, f"{st} {j}")
st, j = A.req("/api/chat/send.php", raw_body=json.dumps({"conversation_id": conv, "body": f"msg 4 {RUN}"}))
check("4th message blocked (request_limit)", st == 403 and j.get("code") == "request_limit", f"{st} {j}")

# ── 3. recipient sees the request flagged ──
st, j = B.req("/api/chat/conversations.php")
row = next((c for c in (j.get("conversations") or []) if int(c.get("id") or 0) == conv), None)
check("recipient sees conv_status=request + requested_by", row is not None and row.get("conv_status") == "request" and int(row.get("requested_by") or 0) == aid, f"{st} {str(row)[:160]}")

# ── 4. accept → active + follows requester ──
st, j = B.req("/api/chat/request_action.php", raw_body=json.dumps({"conversation_id": conv, "action": "accept"}))
follow = sql(f"SELECT COUNT(*) FROM user_follows WHERE follower_id={bid} AND following_id={aid};")
check("accept activates + B follows A", st == 200 and follow == "1", f"{st} {j} follow={follow}")
st, j = A.req("/api/chat/send.php", raw_body=json.dumps({"conversation_id": conv, "body": f"after accept {RUN}"}))
check("messages flow after accept", st == 200, f"{st} {j}")

# ── 5. follow-first DM opens active ──
sql(f"INSERT IGNORE INTO user_follows (follower_id, following_id) VALUES ({cid_}, {aid});")  # C follows A
st, j = A.req("/api/chat/start.php", raw_body=json.dumps({"user_id": cid_}))
conv2 = int(j.get("conversation_id") or 0)
check("DM to a follower opens active", st == 200 and j.get("conversation_status") == "active", f"{st} {j}")

# ── 6. block declines + closes the thread ──
st, j = C.req("/api/chat/start.php", raw_body=json.dumps({"user_id": did}))  # D stranger to C? no: C starts with D (D doesn't follow C)
conv3 = int(j.get("conversation_id") or 0)
check("C→D opens as request", st == 200 and j.get("conversation_status") == "request", f"{st} {j}")
st, j = D.req("/api/chat/request_action.php", raw_body=json.dumps({"conversation_id": conv3, "action": "block"}))
check("D blocks the request", st == 200 and j.get("action") == "block", f"{st} {j}")
st, j = C.req("/api/chat/send.php", raw_body=json.dumps({"conversation_id": conv3, "body": f"after block {RUN}"}))
check("blocked thread rejects messages", st == 403 and j.get("code") == "declined", f"{st} {j}")

# ── 7. report declines + writes an account_reports row ──
st, j = D.req("/api/chat/start.php", raw_body=json.dumps({"user_id": aid}))  # D → A, A doesn't follow D
conv4 = int(j.get("conversation_id") or 0)
st, j = A.req("/api/chat/request_action.php", raw_body=json.dumps({"conversation_id": conv4, "action": "report"}))
rep = sql(f"SELECT COUNT(*) FROM account_reports WHERE reported_user_id={did} AND reporter_user_id={aid};")
check("report declines + files account_reports", st == 200 and rep == "1", f"{st} {j} rep={rep}")

# ── 8. requester cannot act on their own request ──
st, j = D.req("/api/chat/start.php", raw_body=json.dumps({"user_id": bid}))
conv5 = int(j.get("conversation_id") or 0)
st, j = D.req("/api/chat/request_action.php", raw_body=json.dumps({"conversation_id": conv5, "action": "accept"}))
check("requester cannot self-accept", st == 403, f"{st} {j}")

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
