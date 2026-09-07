#!/usr/bin/env python3
"""pass-72 harness (Tier 1): video engagement suite, courses progression,
donation history, qur'an extras (streak + reciter unlock)."""
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
    assert st in (200, 201) and j.get("status") == "success", f"register {tag}: {st} {str(j)[:120]}"
    return uname, sql(f"SELECT id FROM users WHERE username='{uname}';")

A = Sess(); B = Sess()
uA, aid = register(A, "al72", "Alice Tester")
uB, bid = register(B, "bo72", "Bobby Tester")
sql(f"UPDATE users SET deenpoints_balance=100 WHERE id={aid};")

# ════════ 1. VIDEO ENGAGEMENT SUITE ════════
sql(f"INSERT INTO video_accounts (user_id, name, username, is_active) VALUES ({aid}, 'Al72 Tester', '{uA}', 1);")
acc = sql(f"SELECT id FROM video_accounts WHERE user_id={aid};")
TITLE = f"Harness72 reel {RUN}"
sql(f"INSERT INTO videos (video_type, source_type, source_url, title, account_id, likes_count, reposts_count, status) VALUES ('reel', 'local', '/assets/videos/sample72.mp4', '{TITLE}', {acc}, 0, 0, 'active');")
vid = int(sql(f"SELECT id FROM videos WHERE title='{TITLE}';"))

st, j = A.req("/api/videos/toggle_like.php", raw_body=json.dumps({"video_id": vid, "desired_liked": True}))
check("A likes reel", st == 200 and j.get("liked") is True and int(j.get("like_count", -1)) == 1, f"{st} {j}")

st, j = A.req("/api/videos/add_comment.php", raw_body=json.dumps({"video_id": vid, "text": f"MashaAllah {RUN}"}))
cid = int(j.get("comment_id") or 0)
check("A comments", st in (200, 201) and cid > 0 and int(j.get("comment_count", -1)) == 1, f"{st} {j}")

st, j = A.req("/api/videos/add_comment.php", raw_body=json.dumps({"video_id": vid, "text": f"reply {RUN}", "parent_id": cid}))
check("A replies to comment", st in (200, 201) and int(j.get("comment_id") or 0) > 0 and int(j.get("comment_count", -1)) == 2, f"{st} {j}")

st, j = B.req(f"/api/videos/list_comments.php?video_id={vid}")
coms = j.get("comments") or []
check("B lists comments (2 + thread)", st == 200 and len(coms) >= 1 and int(j.get("comment_count", -1)) == 2, f"{st} {str(j)[:160]}")

st, j = B.req("/api/videos/toggle_comment_like.php", raw_body=json.dumps({"comment_id": cid, "desired_liked": True}))
check("B likes comment", st == 200 and j.get("liked") is True and int(j.get("like_count", -1)) == 1, f"{st} {j}")

st, j = A.req("/api/videos/bookmark.php", raw_body=json.dumps({"video_id": vid, "desired_saved": True}))
check("A saves reel", st == 200 and j.get("saved") is True, f"{st} {j}")

st, j = A.req(f"/api/videos/list.php?type=reel&limit=50")
item = next((v for v in (j.get("items") or []) if int(v.get("id") or 0) == vid), None)
check("viewer flags ride the list (likedByMe+savedByMe)", item is not None and item.get("likedByMe") is True and item.get("savedByMe") is True, f"{st} {str(item)[:200]}")

st, j = A.req("/api/videos/add_view.php", raw_body=json.dumps({"video_id": vid}))
check("first view counts", st == 200 and j.get("counted") is True, f"{st} {j}")
st, j = A.req("/api/videos/add_view.php", raw_body=json.dumps({"video_id": vid}))
check("repeat view dedupes", st == 200 and j.get("counted") is False, f"{st} {j}")

st, j = B.req("/api/videos/report.php", raw_body=json.dumps({"video_id": vid, "reason": "harness test"}))
check("B reports reel", st in (200, 201) and j.get("status") == "success", f"{st} {str(j)[:120]}")

st, j = B.req("/api/videos/not_interested.php", raw_body=json.dumps({"video_id": vid}))
check("B marks not interested", st == 200 and (j.get("hidden") is True or j.get("status") == "success"), f"{st} {j}")

st, j = A.req(f"/api/videos/search.php?q=Harness72%20reel%20{RUN}")
hits = [v for v in (j.get("videos") or []) if int(v.get("id") or 0) == vid]
check("video search finds the reel", st == 200 and len(hits) == 1, f"{st} {str(j)[:160]}")

st, j = A.req("/api/videos/toggle_like.php", raw_body=json.dumps({"video_id": vid, "desired_liked": False}))
check("A unlikes reel", st == 200 and j.get("liked") is False and int(j.get("like_count", -1)) == 0, f"{st} {j}")

# ════════ 2. COURSES PROGRESSION ════════
CSLUG = f"h72-course-{RUN}"
sql(f"INSERT INTO courses (title, slug, access_type, deen_points_cost, has_certificate, total_lessons, status, category, level) VALUES ('Harness72 Course {RUN}', '{CSLUG}', 'deenpoints', 5, 1, 2, 'published', 'Fiqh', 'Beginner');")
crs = int(sql(f"SELECT id FROM courses WHERE slug='{CSLUG}';"))
sql(f"INSERT INTO course_modules (course_id, title, slug, sort_order) VALUES ({crs}, 'Module One {RUN}', 'h72-m1-{RUN}', 1);")
mod = int(sql(f"SELECT id FROM course_modules WHERE slug='h72-m1-{RUN}';"))
sql(f"INSERT INTO course_lessons (course_id, module_id, title, slug, lesson_type, duration_label, content_html, sort_order) VALUES ({crs}, {mod}, 'Lesson One {RUN}', 'h72-l1-{RUN}', 'article', '5 min', '<p>One</p>', 1), ({crs}, {mod}, 'Lesson Two {RUN}', 'h72-l2-{RUN}', 'article', '5 min', '<p>Two</p>', 2);")
l1, l2 = sql(f"SELECT id FROM course_lessons WHERE course_id={crs} ORDER BY sort_order;").split("\n")

st, j = A.req(f"/api/courses/get.php?course_id={crs}")
us = (j.get("course") or {}).get("user_state") or {}
check("locked course reports has_access=false", st == 200 and us.get("has_access") is False and us.get("is_enrolled") is False, f"{st} {str(us)[:160]}")

st, j = A.req("/api/courses/unlock_points.php", raw_body=json.dumps({"course_id": crs}))
bal_db = int(sql(f"SELECT deenpoints_balance FROM users WHERE id={aid};") or -1)
check("unlock spends 5 pts", st == 200 and int(j.get("deenpoints_balance") or j.get("new_balance") or -1) == 95 and bal_db == 95, f"{st} {str(j)[:120]} db={bal_db}")

st, j = A.req("/api/courses/enroll.php", raw_body=json.dumps({"course_id": crs}))
check("enroll returns course", st == 200 and int((j.get("course") or {}).get("id") or 0) == crs, f"{st} {str(j)[:120]}")

st, j = A.req("/api/courses/complete_lesson.php", raw_body=json.dumps({"course_id": crs, "lesson_id": int(l1)}))
check("complete lesson 1", st == 200 and j.get("status") == "success", f"{st} {str(j)[:120]}")
st, j = A.req("/api/courses/complete_lesson.php", raw_body=json.dumps({"course_id": crs, "lesson_id": int(l2)}))
cert2 = j.get("certificate") or {}
check("complete lesson 2 issues certificate", st == 200 and bool(cert2.get("verification_code") or cert2.get("certificate_no")), f"{st} {str(j)[:160]}")

st, j = A.req(f"/api/courses/certificate.php?course_id={crs}")
certf = j.get("certificate") or {}
check("certificate fetchable", st == 200 and bool(certf.get("verification_code") or certf.get("certificate_no")), f"{st} {str(j)[:140]}")

# ════════ 3. DONATION HISTORY ════════
TX = f"H72-TX-{RUN}"
sql(f"INSERT INTO donations (user_id, donation_type, amount, currency, provider, tx_ref, provider_transaction_id, note, status) VALUES ({aid}, 'zakat', 500.00, 'NGN', 'flutterwave', '{TX}', 'flw_h72_{RUN}', 'harness', 'successful');")
st, j = A.req("/api/donations/my_history.php?page=1&per_page=20")
items = j.get("items") or []
hit = next((i for i in items if i.get("tx_ref") == TX), None)
check("history lists the donation", st == 200 and hit is not None and float(hit.get("amount") or 0) == 500.0 and hit.get("status") == "successful", f"{st} {str(hit)[:160]}")

st, j = A.req("/api/donations/my_summary.php")
check("summary totals it", st == 200 and float(j.get("total") or 0) > 0 and int(j.get("count") or 0) >= 1, f"{st} {j}")

# ════════ 4. QUR'AN EXTRAS ════════
st, j = A.req("/api/quran/streak.php", raw_body="{}")
check("streak logs activity", st == 200 and int((j.get("streak") or {}).get("current", -1)) >= 1, f"{st} {j}")
st, j = A.req("/api/quran/streak.php")
check("streak reads back", st == 200 and int((j.get("streak") or {}).get("current", -1)) >= 1, f"{st} {j}")

st, j = A.req("/api/quran/reciters.php")
recs = j.get("reciters") or []
check("reciters list + balance", st == 200 and len(recs) >= 1 and int((j.get("user") or {}).get("deenpoints_balance", -1)) == 95, f"{st} {str(j)[:160]}")

RKEY = f"h72rec{RUN}"
sql(f"INSERT INTO quran_reciters (reciter_key, name, country, base_url, url_mode, is_free, deenpoints_price, is_active) VALUES ('{RKEY}', 'Harness Reciter {RUN}', 'Test', 'https://cdn.islamic.network/quran/audio/128/ar.alafasy', 'absolute_ayah', 0, 10, 1);")
st, j = A.req("/api/quran/unlock_reciter.php", raw_body=json.dumps({"reciter_key": RKEY}))
bal_db = int(sql(f"SELECT deenpoints_balance FROM users WHERE id={aid};") or -1)
check("unlock reciter spends 10 pts", st == 200 and int(j.get("new_balance", -1)) == 85 and bal_db == 85, f"{st} {j} db={bal_db}")

st, j = A.req("/api/quran/reciters.php")
prem = next((r for r in (j.get("reciters") or []) if r.get("key") == RKEY), None)
check("premium reciter now unlocked", prem is not None and prem.get("is_unlocked") is True, f"{st} {str(prem)[:140]}")

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
