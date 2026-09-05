<?php
// api/chat/start.php — start DM with user_id
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD']==='OPTIONS'){http_response_code(200);exit;}
$root=__DIR__.'/../..'; $lib=$root.'/api/lib';
function json_out($c,$p){http_response_code($c);echo json_encode($p);exit;}
if(file_exists($lib.'/db.php'))require_once $lib.'/db.php';
if(file_exists($lib.'/auth.php'))require_once $lib.'/auth.php';
if(file_exists($lib.'/response.php'))require_once $lib.'/response.php';
if(!isset($pdo)){
  $cfg=$root.'/config/db.php';
  if(file_exists($cfg)){$cc=require $cfg;$pdo=new PDO("mysql:host={$cc['host']};dbname={$cc['dbname']};charset=utf8mb4",$cc['user'],$cc['pass'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);}
  else{$pdo=new PDO("mysql:host=localhost;dbname=deenlink_db;charset=utf8mb4",getenv('DB_USER')?:'root',getenv('DB_PASS')?:'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);}
}
$user=null;
if(function_exists('requireAuth'))$user=requireAuth();
else{session_start();if(!empty($_SESSION['user_id'])){$s=$pdo->prepare("SELECT id FROM users WHERE id=?");$s->execute([$_SESSION['user_id']]);$user=$s->fetch(PDO::FETCH_ASSOC);}elseif(!empty($_COOKIE['deenlink_session'])){$tok=$_COOKIE['deenlink_session'];$s=$pdo->prepare("SELECT u.id FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.session_token_hash=SHA2(?,256) AND s.is_active=1 LIMIT 1");$s->execute([$tok]);$user=$s->fetch(PDO::FETCH_ASSOC);}}
if(!$user)json_out(401,['status'=>'error','message'=>'Unauthorized']);
$uid=(int)($user['id']??0);
$input=json_decode(file_get_contents('php://input'), true) ?? $_POST;
$peerId=(int)($input['user_id']??0);
if(!$peerId)json_out(400,['status'=>'error','message'=>'user_id required']);
if($peerId===$uid)json_out(400,['status'=>'error','message'=>'Cannot DM yourself']);
try{
  $pdo->exec("CREATE TABLE IF NOT EXISTS chat_conversations (id INT(11) NOT NULL AUTO_INCREMENT, type ENUM('dm','group') NOT NULL DEFAULT 'dm', title VARCHAR(191) DEFAULT NULL, created_by INT(11) DEFAULT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS chat_participants (id INT(11) NOT NULL AUTO_INCREMENT, conversation_id INT(11) NOT NULL, user_id INT(11) NOT NULL, is_admin TINYINT(1) NOT NULL DEFAULT 0, joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, last_read_at DATETIME DEFAULT NULL, PRIMARY KEY (id), UNIQUE KEY uniq_conv_user (conversation_id,user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  // Check existing DM
  $stmt=$pdo->prepare("
    SELECT c.id FROM chat_conversations c
    JOIN chat_participants p1 ON p1.conversation_id=c.id AND p1.user_id=?
    JOIN chat_participants p2 ON p2.conversation_id=c.id AND p2.user_id=?
    WHERE c.type='dm'
    LIMIT 1
  ");
  $stmt->execute([$uid,$peerId]);
  $ex=$stmt->fetch(PDO::FETCH_ASSOC);
  if($ex){json_out(200,['status'=>'success','conversation_id'=>(int)$ex['id']]);}
  // Create new
  $pdo->prepare("INSERT INTO chat_conversations (type, created_by, created_at, updated_at) VALUES ('dm',?,NOW(),NOW())")->execute([$uid]);
  $cid=(int)$pdo->lastInsertId();
  $pdo->prepare("INSERT INTO chat_participants (conversation_id, user_id, is_admin) VALUES (?,?,0)")->execute([$cid,$uid]);
  $pdo->prepare("INSERT INTO chat_participants (conversation_id, user_id, is_admin) VALUES (?,?,0)")->execute([$cid,$peerId]);
  json_out(200,['status'=>'success','conversation_id'=>$cid]);
}catch(Exception $e){json_out(500,['status'=>'error','message'=>'Failed','detail'=>$e->getMessage()]);}
