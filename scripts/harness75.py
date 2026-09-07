#!/usr/bin/env python3
"""pass 75 (Tier 2) harness: Ask Scholars both sides (submit → queue → message →
answer → asker reads), wallpapers (list → free/paid unlock), account report."""
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

Sess.csrf_get = lambda self: setattr(self, "csrf", (lambda j: j.get("csrf_token") or j.get("token"))(self.req("/api/auth/csrf.php")[1]))

A = Sess(); S = Sess(); N = Sess()
uA, aid = register(A, "t2a", "Asker Tester")
uS, sid = register(S, "t2s", "Scholar Tester")
uN, nid = register(N, "t2n", "Nosy Tester")

# make S an approved scholar (what the admin dashboard does)
sql(f"UPDATE users SET user_type='scholar' WHERE id={sid};")
sql(f"INSERT INTO scholars (user_id, display_name, aqeedah, institute, years_of_study, approval_status) VALUES ({sid}, 'Scholar Tester', 'Sunni', 'Harness Institute', 5, 'approved') ON DUPLICATE KEY UPDATE approval_status='approved';")

# ── scholar queue is protected ──
st, j = N.req("/api/questions/scholar_list.php")
check("non-scholar blocked from queue", st == 403, f"{st} {str(j)[:80]}")

# ── asker submits ──
st, j = A.req("/api/questions/submit.php", raw_body=json.dumps({
    "scholar_id": sid, "title": f"Ruling on tests {RUN}", "details": "Is this harness question acceptable for testing purposes?", "privacy": "public", "category": "fiqh"}))
check("asker submits question", st == 200 and j.get("status") == "success", f"{st} {str(j)[:120]}")
qid = int(sql(f"SELECT id FROM scholar_questions WHERE asker_user_id={aid} ORDER BY id DESC LIMIT 1;") or 0)
check("question row created", qid > 0)

# ── scholar sees it in the queue ──
st, j = S.req("/api/questions/scholar_list.php?tab=to_answer")
rows = j.get("questions") or []
check("scholar queue lists the question", st == 200 and any(int(r.get("id")) == qid for r in rows), f"{st} {str(j)[:120]}")

# ── scholar messages the asker, asker sees the thread ──
st, j = S.req("/api/questions/respond.php", raw_body=json.dumps({"question_id": qid, "action": "message", "message_text": "Could you clarify the madhhab context?"}))
check("scholar sends message", st == 200 and j.get("status") == "success", f"{st} {str(j)[:100]}")
st, j = A.req(f"/api/questions/thread.php?question_id={qid}")
msgs = j.get("messages") or []
check("asker sees thread message", st == 200 and any("madhhab" in str(m.get("message_text", "")) for m in msgs), f"{st} {str(j)[:120]}")

# ── scholar answers ──
st, j = S.req("/api/questions/respond.php", raw_body=json.dumps({"question_id": qid, "action": "answer", "answer_text": "Yes — this is a valid test answer with enough length."}))
check("scholar answers", st == 200 and j.get("status") == "success", f"{st} {str(j)[:100]}")
stt = sql(f"SELECT status FROM scholar_questions WHERE id={qid};")
check("question now answered", stt == "answered", stt)

# ── asker side: my list + unread badge + mark read ──
st, j = A.req("/api/questions/my_list.php")
mq = j.get("questions") or []
mine = next((q for q in mq if int(q.get("id")) == qid), None)
check("asker my_list shows answered", st == 200 and mine and mine.get("status") == "answered", f"{st} {str(mine)[:100]}")
st, j = A.req("/api/questions/unread_answered_count.php")
check("unread answered count >= 1", st == 200 and int(j.get("unread_answered_count") or 0) >= 1, f"{st} {str(j)[:80]}")
st, j = A.req("/api/questions/mark_answered_read.php", raw_body=json.dumps({"question_id": qid}))
check("mark answered read", st == 200 and j.get("status") == "success", f"{st} {str(j)[:80]}")
st, j = A.req("/api/questions/unread_answered_count.php")
check("unread count cleared", int(j.get("unread_answered_count") or 0) == 0, str(j)[:80])

# ── public list (fatwas) filterable by scholar ──
st, j = N.req(f"/api/questions/public_list.php?limit=50&sort=newest&scholar_user_id={sid}")
qs = j.get("questions") or []
check("public list has the answered question", st == 200 and any(int(q.get("id")) == qid for q in qs), f"{st} n={len(qs)}")

# ── wallpapers: free + paid unlock ──
sql(f"INSERT INTO wallpapers (category_id, name, image_path, price_points, is_active, downloads_count, created_at, updated_at) VALUES (NULL, 'T2 Free {RUN}', 'wallpapers/t2free.jpg', 0, 1, 0, NOW(), NOW()), (NULL, 'T2 Paid {RUN}', 'wallpapers/t2paid.jpg', 25, 1, 0, NOW(), NOW());")
free_id = int(sql(f"SELECT id FROM wallpapers WHERE name='T2 Free {RUN}';"))
paid_id = int(sql(f"SELECT id FROM wallpapers WHERE name='T2 Paid {RUN}';"))
st, j = A.req("/api/wallpapers/list.php")
walls = j.get("wallpapers") or []
check("wallpaper list returns catalog", st == 200 and any(int(w.get("id")) == free_id for w in walls), f"{st} n={len(walls)}")
st, j = A.req("/api/wallpapers/unlock.php", raw_body=json.dumps({"wallpaper_id": free_id}))
check("free wallpaper unlocks", st == 200 and j.get("status") == "success", f"{st} {str(j)[:100]}")
sql(f"UPDATE users SET deenpoints_balance = deenpoints_balance + 100 WHERE id={aid};")
bal0 = int(sql(f"SELECT deenpoints_balance FROM users WHERE id={aid};"))
st, j = A.req("/api/wallpapers/unlock.php", raw_body=json.dumps({"wallpaper_id": paid_id}))
bal1 = int(sql(f"SELECT deenpoints_balance FROM users WHERE id={aid};"))
check("paid unlock spends points", st == 200 and j.get("status") == "success" and bal1 == bal0 - 25, f"{st} {bal0}->{bal1} {str(j)[:80]}")
st, j = A.req("/api/wallpapers/unlock.php", raw_body=json.dumps({"wallpaper_id": paid_id}))
check("re-unlock does not double-charge", st == 200 and int(sql(f"SELECT deenpoints_balance FROM users WHERE id={aid};")) == bal1, f"{st}")

# ── account report ──
st, j = A.req("/api/users/report_account.php", raw_body=json.dumps({"user_id": sid, "reason": "harness test report"}))
row = sql(f"SELECT COUNT(*) FROM account_reports WHERE reported_user_id={sid} AND reporter_user_id={aid};")
check("report_account files a row", st == 200 and j.get("status") == "success" and int(row or 0) >= 1, f"{st} rows={row} {str(j)[:80]}")

passed = sum(results)
print(f"\n{passed}/{len(results)} passed")
sys.exit(0 if passed == len(results) else 1)
