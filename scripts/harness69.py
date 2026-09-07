#!/usr/bin/env python3
"""pass-69 harness: unified bookmarks + deenpoints history + FLW init paths + ask-scholar."""
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

A = Sess()
uname, email = f"probe69{RUN}", f"probe69{RUN}@t.co"
A.csrf_get()
st, j = A.req("/api/auth/register.php", raw_body=json.dumps({
    "full_name": "Probe Tester", "username": uname, "email": email,
    "password": "Str0ngPass!23", "confirm_password": "Str0ngPass!23", "agree_terms": True, "aqeedah": "Sunni"}))
check("register", st in (200, 201) and j.get("status") == "success", f"{st} {str(j)[:100]}")

# ---- bookmarks
st, j = A.req("/api/bookmarks/toggle.php", raw_body=json.dumps({"kind": "hadith", "item_id": "bukhari:1", "payload": {"text": "Actions are by intentions"}}))
check("bookmark hadith ON", st == 200 and j.get("bookmarked") is True, f"{st} {j}")
st, j = A.req("/api/bookmarks/toggle.php", raw_body=json.dumps({"kind": "hadith", "item_id": "bukhari:1"}))
check("bookmark hadith OFF", st == 200 and j.get("bookmarked") is False, f"{st} {j}")
A.req("/api/bookmarks/toggle.php", raw_body=json.dumps({"kind": "hadith", "item_id": "bukhari:1", "payload": {"text": "Actions are by intentions"}}))
A.req("/api/bookmarks/toggle.php", raw_body=json.dumps({"kind": "ayah", "item_id": "2:255", "payload": {"surah": 2, "ayah": 255}}))
st, j = A.req("/api/bookmarks/list.php?kind=hadith")
items = j.get("items") or []
check("list kind=hadith → 1 w/ payload", st == 200 and len(items) == 1 and items[0]["payload"].get("text") == "Actions are by intentions", f"{st} {items}")
st, j = A.req("/api/bookmarks/list.php")
check("list all → 2 kinds", st == 200 and len(j.get("items") or []) == 2, f"{st} {j}")
st, j = A.req("/api/bookmarks/toggle.php", raw_body=json.dumps({"kind": "bad kind!", "item_id": "x"}))
check("invalid kind rejected", st == 400, f"{st} {j}")
st, j = A.req("/api/bookmarks/list.php")
check("bookmarks require auth", Sess().req("/api/bookmarks/list.php")[0] == 401, "anon got in")

# ---- deenpoints: award then history
A.csrf_get()
st, j = A.req("/api/deenpoints/award.php", raw_body=json.dumps({"activity": "checkin"}))
check("award checkin", st == 200, f"{st} {str(j)[:100]}")
st, j = A.req("/api/deenpoints/history.php")
evs = j.get("events") or []
check("history: balance + ledger row", st == 200 and j.get("balance", 0) >= 100 and any(e["event_type"] for e in evs), f"{st} bal={j.get('balance')} n={len(evs)}")

# ---- flutterwave init: unconfigured → clean 400
# dump ships with the REAL configured FLW keys; inline init must produce a payload
st, j = A.req("/api/payments/flutterwave/init_deenpoints.php", raw_body=json.dumps({"points": 500}))
tx = str((j.get("checkout") or {}).get("tx_ref") or "")
co = j.get("checkout") or {}
check("init inline → checkout payload", st == 200 and tx.startswith("dl_dp_") and float(co.get("amount") or 0) > 0 and co.get("public_key", "").startswith("FLWPUBK"), f"{st} {str(j)[:160]}")
st, j = A.req("/api/payments/flutterwave/init_deenpoints.php", raw_body=json.dumps({"points": 50}))
check("init below minimum rejected", st == 400, f"{st} {j}")
pend = sql(f"SELECT status FROM payment_transactions WHERE tx_ref='{tx}';")
check("pending tx row written", pend == "pending", pend)
st, j = A.req("/api/payments/flutterwave/init_deenpoints.php", raw_body=json.dumps({"points": 500, "redirect": True, "redirect_url": "javascript:alert(1)"}))
check("redirect_url scheme validated", st == 400, f"{st} {j}")
st, j = A.req("/api/payments/flutterwave/init_deenpoints.php", raw_body=json.dumps({"points": 500, "redirect": True, "redirect_url": "deenlink://pay-done"}))
check("redirect w/ fake secret → clean 502", st == 502, f"{st} {str(j)[:120]}")
st, j = A.req("/api/payments/flutterwave/quote_deenpoints.php?points=1000")
check("quote returns pricing", st == 200 and ("amount" in json.dumps(j) or "price" in json.dumps(j)), f"{st} {str(j)[:140]}")

# ---- ask scholar: need an approved scholar
# create a real scholar: second user promoted via users + scholars tables
B = Sess(); B.csrf_get()
bname, bemail = f"scholar69{RUN}", f"scholar69{RUN}@t.co"
st, j = B.req("/api/auth/register.php", raw_body=json.dumps({
    "full_name": "Scholar Probe", "username": bname, "email": bemail,
    "password": "Str0ngPass!23", "confirm_password": "Str0ngPass!23", "agree_terms": True, "aqeedah": "Sunni"}))
buid = sql(f"SELECT id FROM users WHERE username='{bname}';")
sql(f"UPDATE users SET user_type='scholar', is_active=1 WHERE id={buid};")
sql(f"INSERT INTO scholars (user_id, display_name, approval_status, fields_of_knowledge, aqeedah, institute, years_of_study) VALUES ({buid}, 'Scholar Probe', 'approved', 'fiqh', 'Sunni', 'Harness Institute', 10);")
st, j = A.req("/api/questions/scholars.php")
scholars = j.get("scholars") or j.get("data") or []
sid_api = scholars[0]["id"] if scholars else 0
check("scholars list has one (users.id)", st == 200 and sid_api == int(buid), f"{st} n={len(scholars)} buid={buid} got={sid_api}")
st, j = A.req("/api/questions/submit.php", raw_body=json.dumps({
    "scholar_id": sid_api, "title": "Ruling on combining prayers while travelling?",
    "details": "Assalamu alaikum. I travel weekly between Abuja and Kadina for work. May I combine Dhuhr and Asr?",
    "privacy": "public", "priority": "normal", "category": "prayer"}))
qq = j.get("question") or {}
qid = qq.get("id") or j.get("id") or j.get("question_id") or 0
check("submit question", st == 200 and int(qid or 0) > 0, f"{st} {str(j)[:140]}")
st, j = A.req("/api/questions/my_list.php")
mine = j.get("questions") or []
check("my_list shows it pending", st == 200 and any(str(q.get("id")) == str(qid) and q.get("status") in ("pending", "open", "assigned") for q in mine), f"{st} {str(mine)[:160]}")
st, j = A.req("/api/questions/unread_answered_count.php")
check("unread answered count = 0", st == 200 and int(j.get("unread_answered_count", -1)) == 0, f"{st} {j}")

# ---- donations + premium (pass 69 sweep)
st, j = A.req("/api/payments/flutterwave/init_donation.php", raw_body=json.dumps({"donation_type": "Zakat", "amount": 500}))
ck = j.get("checkout") or {}
check("donation init inline", st == 200 and str(ck.get("tx_ref", "")).startswith("dl_dn_") and float(ck.get("amount") or 0) == 500 and str(ck.get("public_key", "")).startswith("FLWPUBK"), f"{st} {str(j)[:160]}")
st, j = A.req("/api/payments/flutterwave/init_donation.php", raw_body=json.dumps({"donation_type": "Sadaqah", "amount": 100, "redirect": True, "redirect_url": "javascript:alert(1)"}))
check("donation redirect bad url 400", st == 400, f"{st} {j}")
sql("INSERT INTO system_settings (setting_key, setting_value) VALUES ('premium.enabled','1') ON DUPLICATE KEY UPDATE setting_value='1';")
st, j = A.req("/api/payments/flutterwave/quote_premium.php")
check("quote premium", st == 200 and isinstance(j.get("premium_enabled"), bool) and str(j.get("currency", "")) != "", f"{st} {str(j)[:140]}")
st, j = A.req("/api/payments/flutterwave/init_premium.php", raw_body=json.dumps({"plan": "monthly"}))
ck = j.get("checkout") or {}
check("premium init inline", st == 200 and str(ck.get("tx_ref", "")).startswith("dl_pm_") and float(ck.get("amount") or 0) > 0, f"{st} {str(j)[:160]}")

print(f"\n{sum(results)}/{len(results)} PASS")
sys.exit(0 if all(results) else 1)
