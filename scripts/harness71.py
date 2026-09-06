#!/usr/bin/env python3
"""pass-71 harness: check-in awards + balance + notifications; award notif; profile counts."""
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
uname, email = f"carol71{RUN}", f"carol71{RUN}@t.co"
A.csrf_get()
st, j = A.req("/api/auth/register.php", raw_body=json.dumps({
    "full_name": "Carol Tester", "username": uname, "email": email,
    "password": "Str0ngPass!23", "confirm_password": "Str0ngPass!23", "agree_terms": True, "aqeedah": "Sunni"}))
check("register", st in (200, 201) and j.get("status") == "success", f"{st} {str(j)[:100]}")
uid = sql(f"SELECT id FROM users WHERE username='{uname}';")
bal0 = int(sql(f"SELECT deenpoints_balance FROM users WHERE id={uid};") or 0)

# ---- daily check-in
st, j = A.req("/api/users/daily_checkin.php", raw_body="{}")
check("check-in awards 5", st == 200 and int(j.get("points_awarded", -1)) == 5, f"{st} {j}")
bal1 = int(sql(f"SELECT deenpoints_balance FROM users WHERE id={uid};") or 0)
check("balance +5", bal1 == bal0 + 5 and int(j.get("new_balance", -1)) == bal1, f"bal0={bal0} bal1={bal1} j={j}")
led = sql(f"SELECT COUNT(*) FROM deenpoints_ledger WHERE user_id={uid} AND event_type='checkin';")
check("ledger row written", led == "1", f"rows={led}")

# ---- duplicate check-in
st, j = A.req("/api/users/daily_checkin.php", raw_body="{}")
check("duplicate check-in → 0 pts", st == 200 and int(j.get("points_awarded", -1)) == 0, f"{st} {j}")

# ---- award (surah activity)
st, j = A.req("/api/deenpoints/award.php", raw_body=json.dumps({"activity": "surah"}))
check("award surah +3", st == 200 and int(j.get("awarded", -1)) == 3, f"{st} {j}")

# ---- notifications list shows BOTH earns
st, j = A.req("/api/notifications/list.php?limit=20")
notes = j.get("notifications") or []
dp_notes = [n for n in notes if n.get("type") == "deenpoints"]
titles = [n.get("title") for n in dp_notes]
check("check-in notification present", st == 200 and any("+5 DeenPoints" == t for t in titles), f"{st} {titles}")
check("award notification present", any("+3 DeenPoints" == t for t in titles), f"{titles}")
bodies = [n.get("body") for n in dp_notes]
check("notif explains source", any("check-in" in (b or "") for b in bodies) and any("surah" in (b or "").lower() for b in bodies), f"{bodies}")

# ---- profile counts are real
st, j = A.req(f"/api/users/get_profile_counts.php?user_id={uid}")
check("profile counts flat+real", st == 200 and j.get("status") == "success" and int(j.get("followers", -1)) == 0 and int(j.get("following", -1)) == 0 and int(j.get("posts", -1)) == 0, f"{st} {j}")

print(f"\n{sum(results)}/{len(results)} PASS")
sys.exit(0 if all(results) else 1)
