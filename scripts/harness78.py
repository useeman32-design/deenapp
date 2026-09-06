#!/usr/bin/env python3
"""pass 78 harness: DeenLink Shop — catalog seed, public browse/search,
server-backed cart (affiliate guard), checkout → order + stock decrement."""
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

# ── public catalog (no login) ──
anon = Sess()
st, j = anon.req("/api/shop/products.php")
prods = j.get("products") or []
check("catalog lists 13 seeded products", st == 200 and len(prods) == 13, f"{st} n={len(prods)}")
own = [p for p in prods if p.get("source") == "own"]
aff = [p for p in prods if p.get("source") == "affiliate"]
check("9 own + 4 affiliate", len(own) == 9 and len(aff) == 4, f"own={len(own)} aff={len(aff)}")
nets = sorted(p.get("network") for p in aff)
check("affiliate networks cover amazon/aliexpress/jumia/ebay", nets == ["aliexpress", "amazon", "ebay", "jumia"], str(nets))
check("affiliate rows carry deep links", all((p.get("affiliate_url") or "").startswith("http") for p in aff))
prayer = [p for p in prods if p.get("category") == "prayer"]
check("prayer category exists (2 products)", len(prayer) == 2, str(len(prayer)))

st, j = anon.req("/api/shop/products.php?category=dhikr")
check("category filter works", st == 200 and all(p["category"] == "dhikr" for p in j.get("products") or []) and len(j.get("products") or []) == 3, str(j.get("products") and len(j["products"])))

st, j = anon.req("/api/shop/search.php?q=misbaha")
found = j.get("products") or []
check("search finds misbaha products", st == 200 and len(found) >= 2, str(len(found)))
check("search result is the amber misbaha", any("Amber" in p["title"] for p in found), str([p["title"] for p in found]))
st, j = anon.req("/api/shop/search.php?q=zzzznope")
check("search with no hits returns empty list", st == 200 and (j.get("products") or []) == [], str(j)[:80])
st, j = anon.req("/api/shop/search.php?q=x")
check("search rejects q < 2 chars", st == 400, str(st))

# ── cart + checkout (logged in) ──
U = Sess(); U.csrf_get()
uname = f"shop{RUN}"
st, j = U.req("/api/auth/register.php", raw_body=json.dumps({"full_name": "Shopper Tester", "username": uname, "email": uname + "@t.co", "password": "Str0ngPass!23", "confirm_password": "Str0ngPass!23", "agree_terms": True, "aqeedah": "Sunni"}))
check("shopper registers", st in (200, 201), f"{st} {str(j)[:80]}")
uid = int(sql(f"SELECT id FROM users WHERE username='{uname}';"))

by_slug = {p["slug"]: p for p in prods}
mat, beads, amazon_pen = by_slug["prayer-mat"], by_slug["misbaha-99"], by_slug["aff-quran-pen"]

st, j = U.req("/api/shop/cart.php", raw_body=json.dumps({"action": "add", "product_id": amazon_pen["id"], "qty": 1}))
check("affiliate product cannot be added to cart", st == 400, f"{st} {str(j)[:80]}")

st, j = U.req("/api/shop/cart.php", raw_body=json.dumps({"action": "add", "product_id": mat["id"], "qty": 2}))
check("add prayer mat ×2", st == 200, f"{st} {str(j)[:80]}")
st, j = U.req("/api/shop/cart.php", raw_body=json.dumps({"action": "add", "product_id": beads["id"], "qty": 1}))
check("add misbaha ×1", st == 200, f"{st} {str(j)[:80]}")
st, j = U.req("/api/shop/cart.php")
items = j.get("items") or []
check("cart has 2 lines, count 3, total 64.97", j.get("count") == 3 and abs(float(j.get("total") or 0) - 64.97) < 0.001, f"{j.get('count')} {j.get('total')}")

st, j = U.req("/api/shop/cart.php", raw_body=json.dumps({"action": "qty", "product_id": mat["id"], "qty": 1}))
st, j2 = U.req("/api/shop/cart.php")
check("qty update recomputes total (39.98)", abs(float(j2.get("total") or 0) - 39.98) < 0.001, str(j2.get("total")))

stock_before = int(sql(f"SELECT stock FROM shop_products WHERE id={mat['id']};"))
st, j = U.req("/api/shop/checkout.php", raw_body=json.dumps({"name": "Shopper Tester", "email": uname + "@t.co", "phone": "+2348000000000", "country": "Nigeria", "city": "Abuja", "address": "12 Test Street", "note": "please gift-wrap"}))
oid = int(j.get("order_id") or 0)
check("checkout creates order", st == 200 and oid > 0, f"{st} {str(j)[:100]}")
stock_after = int(sql(f"SELECT stock FROM shop_products WHERE id={mat['id']};"))
check("stock decremented by qty", stock_after == stock_before - 1, f"{stock_before} -> {stock_after}")
st, j = U.req("/api/shop/cart.php")
check("cart emptied after checkout", (j.get("count") or 0) == 0, str(j.get("count")))

st, j = U.req("/api/shop/orders.php")
orders = j.get("orders") or []
check("orders list shows the new order", st == 200 and any(o["id"] == oid for o in orders), str(len(orders)))
if orders:
    o = next((x for x in orders if x["id"] == oid), orders[0])
    check("order carries items + ship_to + pending status", len(o.get("items") or []) == 2 and "Abuja" in (o.get("ship_to") or "") and o.get("status") == "pending", str(o)[:160])

st, j = anon.req("/api/shop/checkout.php", raw_body=json.dumps({"name": "x", "email": "x@x.co", "country": "y", "city": "z", "address": "a"}))
check("anon checkout rejected (401)", st == 401, str(st))

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
