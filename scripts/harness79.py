#!/usr/bin/env python3
"""pass 79 harness: shop order payment (Flutterwave) — purpose enum carries
'shop', pay_tx_ref column exists, init_shop validates ownership/status and
fails gracefully when Flutterwave keys are absent (sandbox has none)."""
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
    return uname

A = Sess(); B = Sess()
register(A, "payA", "Pay Alpha")
register(B, "payB", "Pay Bravo")

# place an order as A
st, prods = A.req("/api/shop/products.php")
mat = next(p for p in prods["products"] if p["slug"] == "prayer-mat")
st, j = A.req("/api/shop/cart.php", raw_body=json.dumps({"action": "add", "product_id": mat["id"], "qty": 1}))
st, j = A.req("/api/shop/checkout.php", raw_body=json.dumps({"name": "Pay Alpha", "email": f"payA{RUN}@t.co", "phone": "+2348", "country": "Nigeria", "city": "Abuja", "address": "1 Test Way", "note": ""}))
oid = int(j.get("order_id") or 0)
check("order placed for pay test", st == 200 and oid > 0, f"{st} {str(j)[:100]}")

# init_shop guards
st, j = A.req("/api/payments/flutterwave/init_shop.php", raw_body=json.dumps({"order_id": 0}))
check("missing order_id → 400", st == 400, f"{st} {str(j)[:80]}")
st, j = B.req("/api/payments/flutterwave/init_shop.php", raw_body=json.dumps({"order_id": oid}))
check("other user's order → 404", st == 404, f"{st} {str(j)[:80]}")
st, j = A.req("/api/payments/flutterwave/init_shop.php", raw_body=json.dumps({"order_id": oid}))
# sandbox has FLW keys configured → expect a real inline checkout payload;
# on a server without keys it must fail gracefully with 400 (never 500).
if st == 200:
    co = j.get("checkout") or {}
    check("init_shop returns inline checkout (keys configured)", bool(co.get("tx_ref")) and str(co.get("tx_ref", "")).startswith("dl_shop_") and float(co.get("amount") or 0) > 0, str(co)[:140])
    # country unset at register → USD is correct; set Nigeria and re-init to prove the NGN path
    sql(f"UPDATE users SET country='Nigeria' WHERE username='payA{RUN}';")
    st2, j2 = A.req("/api/payments/flutterwave/init_shop.php", raw_body=json.dumps({"order_id": oid}))
    co2 = (j2.get("checkout") or {}) if st2 == 200 else {}
    check("Nigerian shopper is charged in NGN", co2.get("currency") == "NGN" and float(co2.get("amount") or 0) > float(co.get("amount") or 0), f"{st2} {str(co2)[:100]}")
    latest_tx = str(co2.get("tx_ref") or co.get("tx_ref"))
    check("pay_tx_ref tracks the latest init", sql(f"SELECT pay_tx_ref FROM shop_orders WHERE id={oid};") == latest_tx, sql(f"SELECT pay_tx_ref FROM shop_orders WHERE id={oid};"))
else:
    check("init_shop fails gracefully without FLW keys", st == 400 and "onfigured" in str(j.get("message")), f"{st} {str(j)[:120]}")

# schema migrations ran (endpoints above triggered pay_ensure_tables/shop_ensure)
check("purpose enum includes 'shop'", "'shop'" in sql("SHOW COLUMNS FROM payment_transactions LIKE 'purpose';"), sql("SHOW COLUMNS FROM payment_transactions LIKE 'purpose';")[:120])
check("shop_orders has pay_tx_ref", "pay_tx_ref" in sql("SHOW COLUMNS FROM shop_orders LIKE 'pay_tx_ref';"))

# anon rejected before csrf noise
anon = Sess()
st, j = anon.req("/api/payments/flutterwave/init_shop.php", raw_body=json.dumps({"order_id": oid}))
check("anon init_shop → 401", st == 401, f"{st}")

# simulate a verified payment directly (verify.php needs real FLW API, so
# assert the branch contract via DB: order still pending, tx row absent)
status = sql(f"SELECT status FROM shop_orders WHERE id={oid};")
check("order remains pending until payment verifies", status == "pending", status)

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
