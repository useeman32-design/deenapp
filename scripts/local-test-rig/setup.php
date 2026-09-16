<?php
declare(strict_types=1);
/* LOCAL TEST RIG — NEVER DEPLOYED (see README.md in this folder) — builds a realistic catalogue in the test DB so
 * seed_pass88.php can be executed end to end: 47 published courses, the seven
 * thin ones at 3 lessons, the rest at 7, and pass-87-style banks (every third
 * question with an EMPTY explanation) for twenty of them. */
/* Paths come from the environment so the rig works wherever the API repo lives:
 *   DEEN_API=/home/user/deenlink-api  (defaults to ../.. relative to this file) */
$API = getenv('DEEN_API') ?: realpath(__DIR__ . '/../../../deenlink-api');
require_once $API . '/api/config/db.php';
require_once $API . '/api/courses/common.php';

$pdo = DB::conn();
ini_set('display_errors', '1');
courses_ensure_tables($pdo);
courses_quiz_ensure($pdo);
$pdo->exec('SET FOREIGN_KEY_CHECKS=0');
foreach (['admin_sessions','admin_users'] as $t) { try { $pdo->exec("TRUNCATE TABLE $t"); } catch (Throwable $e) {} }
foreach (['course_quizzes','course_lessons','course_modules','courses'] as $t) { $pdo->exec("TRUNCATE TABLE $t"); }
$pdo->exec('SET FOREIGN_KEY_CHECKS=1');

$admin = $pdo->query("SELECT id FROM users WHERE user_type = 'admin' LIMIT 1")->fetchColumn();
if (!$admin) {
    $pdo->prepare("INSERT INTO users (username, email, password_hash, full_name, user_type, is_active, is_email_verified, created_at)
                   VALUES ('seedtestadmin','seed@test.local','x','Seed Test Admin','admin',1,1,NOW())")->execute();
    $admin = (int)$pdo->lastInsertId();
}
$admin = (int)$admin;

$slugs = json_decode((string)file_get_contents('/home/user/tools/seedtest/live_slugs.json'), true);
$thin = ['arabic-reading-writing','tauhid-knowing-allah','aqeedah-foundations','tafsir-juz-amma','seerah','fiqh-worship','tajwid-essentials'];
$ins = $pdo->prepare("INSERT INTO courses (title, slug, content_type, access_type, category, level, summary, estimated_duration, total_lessons, status, visibility, created_by, updated_by)
                      VALUES (?, ?, 'course', 'free', 'General', 'Beginner', 'Test fixture course.', 'x', ?, 'published', 'public', ?, ?)");
$insMod = $pdo->prepare("INSERT INTO course_modules (course_id, title, slug, description, sort_order) VALUES (?, 'Core Lessons', ?, '', 1)");
$insLsn = $pdo->prepare("INSERT INTO course_lessons (course_id, module_id, title, slug, lesson_type, duration_label, content_html, sort_order, is_preview) VALUES (?, ?, ?, ?, 'article', '7 min', ?, ?, 0)");
$insQuiz = $pdo->prepare('INSERT INTO course_quizzes (course_id, questions_json) VALUES (?, ?)');

$bankOwners = 0; $i = 0;
foreach ($slugs as $slug => $title) {
    $i++;
    $n = in_array($slug, $thin, true) ? 3 : 7;
    $ins->execute([$title, $slug, $n, $admin, $admin]);
    $cid = (int)$pdo->lastInsertId();
    $insMod->execute([$cid, $slug . '-core']);
    $mid = (int)$pdo->lastInsertId();
    for ($k = 1; $k <= $n; $k++) {
        $t = $slug . ' lesson ' . $k;
        $insLsn->execute([$cid, $mid, 'Lesson ' . $k . ' of ' . $title, $slug . '-l' . $k, '<p>Original fixture paragraph for lesson ' . $k . '.</p>', $k]);
    }
    /* twenty of the courses already carry a pass-87 style bank with terse and
     * sometimes EMPTY explanations — the exact state the owner complained about */
    if ($i % 2 === 0 && $bankOwners < 20) {
        $bankOwners++;
        $rows = [];
        for ($q = 1; $q <= 20; $q++) {
            $rows[] = [
                'q' => ucfirst($slug) . ' check question ' . $q . '?',
                'a' => ['option one for ' . $q, 'option two for ' . $q, 'option three for ' . $q, 'option four for ' . $q],
                'correct' => $q % 4,
                'why' => $q % 3 === 0 ? '' : ($q % 3 === 1 ? 'Short.' : 'This one already has a proper two-sentence explanation written by the owner, mentioning the ruling and the evidence behind it.'),
            ];
        }
        $insQuiz->execute([$cid, json_encode($rows, JSON_UNESCAPED_UNICODE)]);
    }
}
$h = password_hash('TestPass123!', PASSWORD_DEFAULT);
$pdo->prepare("UPDATE users SET password_hash = ?, is_active = 1, user_type = 'admin', is_email_verified = 1 WHERE id = ?")->execute([$h, $admin]);
echo json_encode(['courses' => $i, 'banks' => $bankOwners, 'admin' => $admin]), PHP_EOL;
