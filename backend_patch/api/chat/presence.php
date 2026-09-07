<?php
// api/chat/presence.php — marks current user online, updates last_seen
// Client calls every 60s via chatPresence()

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$root = __DIR__ . '/../..';
$lib = $root . '/api/lib';

function json_out($code, $payload) {
  http_response_code($code);
  echo json_encode($payload);
  exit;
}

// Try to load existing helpers
if (file_exists($lib . '/db.php')) require_once $lib . '/db.php';
if (file_exists($lib . '/auth.php')) require_once $lib . '/auth.php';
if (file_exists($lib . '/response.php')) require_once $lib . '/response.php';

// Fallback DB if helper missing
if (!isset($pdo)) {
  $cfg = $root . '/config/db.php';
  if (file_exists($cfg)) {
    $c = require $cfg;
    try {
      $pdo = new PDO("mysql:host={$c['host']};dbname={$c['dbname']};charset=utf8mb4", $c['user'], $c['pass'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    } catch (Exception $e) {
      json_out(500, ['status'=>'error','message'=>'DB connection failed']);
    }
  } else {
    // Try env
    $host = getenv('DB_HOST') ?: 'localhost';
    $db   = getenv('DB_NAME') ?: 'deenlink_db';
    $user = getenv('DB_USER') ?: 'root';
    $pass = getenv('DB_PASS') ?: '';
    try {
      $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    } catch (Exception $e) {
      json_out(500, ['status'=>'error','message'=>'DB connection failed']);
    }
  }
}

// Auth — try existing function, else session cookie
$user = null;
if (function_exists('requireAuth')) {
  $user = requireAuth();
} elseif (function_exists('getCurrentUser')) {
  $user = getCurrentUser();
} else {
  // Fallback: check deenlink_session cookie
  session_start();
  if (!empty($_SESSION['user_id'])) {
    $stmt = $pdo->prepare("SELECT id, username FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
  } elseif (!empty($_COOKIE['deenlink_session'])) {
    $token = $_COOKIE['deenlink_session'];
    $stmt = $pdo->prepare("SELECT u.id, u.username FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.session_token_hash = SHA2(?,256) AND s.is_active = 1 LIMIT 1");
    // Try both hashed and plain
    $stmt->execute([$token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
      $stmt = $pdo->prepare("SELECT u.id, u.username FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.session_token = ? AND s.is_active = 1 LIMIT 1");
      try { $stmt->execute([$token]); $user = $stmt->fetch(PDO::FETCH_ASSOC); } catch (Exception $e) {}
    }
  }
  // Also try Authorization Bearer
  if (!$user) {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)/', $auth, $m)) {
      $bearer = trim($m[1]);
      $stmt = $pdo->prepare("SELECT id, username FROM users WHERE id = ? LIMIT 1");
      // Bearer might be user id in demo mode
      if (is_numeric($bearer)) {
        $stmt->execute([(int)$bearer]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
      }
    }
  }
}

if (!$user) {
  json_out(401, ['status'=>'error','message'=>'Unauthorized']);
}

$userId = (int)($user['id'] ?? $user['user_id'] ?? 0);
if (!$userId) json_out(401, ['status'=>'error','message'=>'Unauthorized']);

// Upsert presence
try {
  $pdo->prepare("INSERT INTO user_presence (user_id, last_seen_at, updated_at) VALUES (?, NOW(), NOW()) ON DUPLICATE KEY UPDATE last_seen_at = NOW(), updated_at = NOW()")->execute([$userId]);
  // Also update users.last_login for fallback
  try { $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?")->execute([$userId]); } catch (Exception $e) {}
  json_out(200, ['status'=>'success','last_seen_at'=>date('Y-m-d H:i:s')]);
} catch (Exception $e) {
  // If table missing, create it on the fly
  if (strpos($e->getMessage(), 'user_presence') !== false) {
    try {
      $pdo->exec("CREATE TABLE IF NOT EXISTS user_presence (user_id INT(11) NOT NULL, last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
      $pdo->prepare("INSERT INTO user_presence (user_id, last_seen_at) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE last_seen_at = NOW()")->execute([$userId]);
      json_out(200, ['status'=>'success','last_seen_at'=>date('Y-m-d H:i:s')]);
    } catch (Exception $e2) {}
  }
  json_out(500, ['status'=>'error','message'=>'Failed to update presence','detail'=>$e->getMessage()]);
}
