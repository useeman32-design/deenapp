# Local test rig (DEVELOPER-ONLY — never deployed, never served)

This folder lets an agent **execute** the course seeder and the theme/OTP/campaign
endpoints against a real MySQL instead of reasoning about them. Pass 88 found three
production bugs that only appeared when the code was actually run (a reused PDO
placeholder, a NULL into a NOT NULL enum, an `UPDATE` where an upsert was needed),
so: run the rig before you ship anything that touches `courses*`.

## Bootstrap (Debian-ish sandbox, ~40 s)

    sudo apt-get install -y mariadb-server            # binaries are NOT persisted between sandboxes
    sudo service mariadb start
    sudo mariadb -e "CREATE DATABASE IF NOT EXISTS deenlink_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
                     CREATE USER IF NOT EXISTS 'dl'@'localhost' IDENTIFIED BY 'dlpass';
                     GRANT ALL ON deenlink_test.* TO 'dl'@'localhost'; FLUSH PRIVILEGES;"
    sudo mariadb deenlink_test < ../../../deenlink-api/deenlink_db\ (9).sql   # old dump; ensure-tables migrate it

Everything outside /home/user (including /var/lib/mysql and apt packages) is reset
between sessions, so re-run this block whenever the DB is gone — `php -S` will answer
`SQLSTATE[HY000] [2002] Connection refused` if you skip it.

## Build the fixture, then drive the endpoints over HTTP

    cd deenapp
    export DB_HOST=127.0.0.1 DB_NAME=deenlink_test DB_USER=dl DB_PASS=dlpass
    php scripts/local-test-rig/setup.php        # → {"courses":47,"banks":20,"admin":115}
    php -S 127.0.0.1:8099 -t ../deenlink-api &  # start it in the SAME shell call as the curls:
                                                # background jobs die between tool calls
    TOKEN=$(curl -s -c /tmp/cj http://127.0.0.1:8099/api/auth/csrf.php | python3 -c 'import sys,json;print(json.load(sys.stdin)["csrf_token"])')
    curl -s -b /tmp/cj -c /tmp/cj -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
         -H "Origin: http://127.0.0.1:8099" -d '{"identifier":"seed@test.local","password":"TestPass123!"}' \
         http://127.0.0.1:8099/api/auth/login.php       # note: the field is identifier, not email

Then, same jar + header (login.php mints the legacy admin session because
`admin_users` is empty — see `require_admin()` in api/admin/users/common.php):

    curl -s -b /tmp/cj -X POST -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
         -H "Origin: http://127.0.0.1:8099" -d '{"run":1}' \
         http://127.0.0.1:8099/api/admin/courses/seed_pass88.php
    # 1st run  → {"lessons_added":263,"questions_added":540,"why_filled":509,"still_short":[]}
    # 2nd run  → all zero  (idempotent — that IS the test)

`setup.php` deliberately reproduces the messy real world: 47 published courses,
seven of them at 3 lessons, 20 quiz banks where every third `why` is EMPTY and every
third+1 is a terse "Short." — that is how the explanation-quality fix got verified.
`live_slugs.json` holds the 47 slug→title pairs scraped from the live
`api/courses/list.php?limit=100`, so the fixture matches production naming.

Useful one-line assertions:

    sudo mariadb deenlink_test -e "SELECT SUM(n<10) under10 FROM (SELECT COUNT(*) n FROM course_lessons GROUP BY course_id) x;
        SELECT COUNT(*) banks FROM course_quizzes; SELECT COUNT(*) short FROM course_quizzes q, JSON_TABLE(q.questions_json,'$[*]' COLUMNS(why VARCHAR(900) PATH '$.why')) t WHERE CHAR_LENGTH(t.why)<40;"

Do not commit anything from this folder's DB work into the repos, and never copy
`setup.php` into the API docroot — it truncates course tables by design.
