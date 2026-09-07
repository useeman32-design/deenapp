<?php
// api/chat/read.php — mark conversation as read
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
$cid=(int)($input['conversation_id']??0);
if(!$cid)json_out(400,['status'=>'error','message'=>'conversation_id required']);
try{
  $chk=$pdo->prepare("SELECT id FROM chat_participants WHERE conversation_id=? AND user_id=? LIMIT 1");
  $chk->execute([$cid,$uid]);
  if(!$chk->fetch())json_out(403,['status'=>'error','message'=>'Not a participant']);
  $pdo->prepare("UPDATE chat_participants SET last_read_at=NOW() WHERE conversation_id=? AND user_id=?")->execute([$cid,$uid]);
  // Also mark messages from others as read if peer has read (for read receipts)
  // We set read_at on messages where sender != current user and conversation matches, if this user is the reader
  // Actually read_at should be set when recipient reads
  $pdo->prepare("UPDATE chat_messages SET read_at=NOW() WHERE conversation_id=? AND sender_id!=? AND read_at IS NULL")->execute([$cid,$uid]);
  json_out(200,['status'=>'success']);
}catch(Exception $e){json_out(500,['status'=>'error','message'=>'Failed','detail'=>$e->getMessage()]);}
