<?php
// api/chat/conversations.php — list conversations for current user with presence
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$root = __DIR__ . '/../..';
$lib = $root . '/api/lib';
function json_out($code, $payload){ http_response_code($code); echo json_encode($payload); exit; }
if (file_exists($lib . '/db.php')) require_once $lib . '/db.php';
if (file_exists($lib . '/auth.php')) require_once $lib . '/auth.php';
if (file_exists($lib . '/response.php')) require_once $lib . '/response.php';

if (!isset($pdo)) {
  $cfg = $root . '/config/db.php';
  if (file_exists($cfg)) { $c=require $cfg; $pdo=new PDO("mysql:host={$c['host']};dbname={$c['dbname']};charset=utf8mb4",$c['user'],$c['pass'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]); }
  else { $pdo=new PDO("mysql:host=localhost;dbname=deenlink_db;charset=utf8mb4", getenv('DB_USER')?:'root', getenv('DB_PASS')?:'', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]); }
}

$user=null;
if (function_exists('requireAuth')) $user=requireAuth();
else {
  session_start();
  if (!empty($_SESSION['user_id'])) { $s=$pdo->prepare("SELECT id, username FROM users WHERE id=?"); $s->execute([$_SESSION['user_id']]); $user=$s->fetch(PDO::FETCH_ASSOC); }
  elseif (!empty($_COOKIE['deenlink_session'])) {
    $tok=$_COOKIE['deenlink_session'];
    $s=$pdo->prepare("SELECT u.id, u.username FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.session_token_hash=SHA2(?,256) AND s.is_active=1 LIMIT 1");
    $s->execute([$tok]); $user=$s->fetch(PDO::FETCH_ASSOC);
  }
}
if (!$user) json_out(401, ['status'=>'error','message'=>'Unauthorized']);
$uid=(int)($user['id']??0);
if (!$uid) json_out(401, ['status'=>'error','message'=>'Unauthorized']);

try {
  // Ensure tables exist
  $pdo->exec("CREATE TABLE IF NOT EXISTS user_presence (user_id INT(11) NOT NULL, last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS chat_conversations (id INT(11) NOT NULL AUTO_INCREMENT, type ENUM('dm','group') NOT NULL DEFAULT 'dm', title VARCHAR(191) DEFAULT NULL, created_by INT(11) DEFAULT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS chat_participants (id INT(11) NOT NULL AUTO_INCREMENT, conversation_id INT(11) NOT NULL, user_id INT(11) NOT NULL, is_admin TINYINT(1) NOT NULL DEFAULT 0, joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, last_read_at DATETIME DEFAULT NULL, PRIMARY KEY (id), UNIQUE KEY uniq_conv_user (conversation_id,user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS chat_messages (id INT(11) NOT NULL AUTO_INCREMENT, conversation_id INT(11) NOT NULL, sender_id INT(11) NOT NULL, body TEXT NOT NULL, media_url VARCHAR(500) DEFAULT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, read_at DATETIME DEFAULT NULL, PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

  // Get conversations where user is participant
  $stmt=$pdo->prepare("
    SELECT c.id, c.type, c.title, c.updated_at,
           (SELECT body FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) as last_body,
           (SELECT sender_id FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) as last_sender
    FROM chat_conversations c
    JOIN chat_participants p ON p.conversation_id=c.id AND p.user_id=?
    ORDER BY c.updated_at DESC
    LIMIT 50
  ");
  $stmt->execute([$uid]);
  $convs=$stmt->fetchAll(PDO::FETCH_ASSOC);

  $out=[];
  foreach($convs as $c){
    $cid=(int)$c['id'];
    // Get peer for DM
    $peer=null;
    $peer_seen=null;
    $with_username=null;
    $with_photo=null;
    if ($c['type']==='dm') {
      $ps=$pdo->prepare("SELECT p.user_id, u.username, u.profile_image FROM chat_participants p JOIN users u ON u.id=p.user_id WHERE p.conversation_id=? AND p.user_id!=? LIMIT 1");
      $ps->execute([$cid,$uid]);
      $pr=$ps->fetch(PDO::FETCH_ASSOC);
      if ($pr) {
        $peer=['id'=>(int)$pr['user_id'],'username'=>$pr['username']];
        $with_username=$pr['username'];
        $with_photo=$pr['profile_image']??null;
        // presence
        $prs=$pdo->prepare("SELECT last_seen_at FROM user_presence WHERE user_id=? LIMIT 1");
        $prs->execute([$pr['user_id']]);
        $pres=$prs->fetch(PDO::FETCH_ASSOC);
        $peer_seen=$pres['last_seen_at']??null;
        if (!$peer_seen) {
          $us=$pdo->prepare("SELECT last_login FROM users WHERE id=? LIMIT 1");
          $us->execute([$pr['user_id']]);
          $u=$us->fetch(PDO::FETCH_ASSOC);
          $peer_seen=$u['last_login']??null;
        }
      }
    }
    $out[]=[
      'id'=>$cid,
      'type'=>$c['type'],
      'kind'=>$c['type'],
      'title'=>$c['title']??($with_username??'Chat'),
      'last_body'=>$c['last_body']??null,
      'peer'=>$peer,
      'with_username'=>$with_username,
      'with_photo'=>$with_photo,
      'peer_seen'=>$peer_seen,
    ];
  }

  json_out(200, ['status'=>'success','conversations'=>$out]);
} catch (Exception $e) {
  json_out(500, ['status'=>'error','message'=>'Failed to load conversations','detail'=>$e->getMessage()]);
}
