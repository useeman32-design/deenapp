<?php
// api/chat/messages.php?conversation_id=123
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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
else{session_start();if(!empty($_SESSION['user_id'])){$s=$pdo->prepare("SELECT id, username FROM users WHERE id=?");$s->execute([$_SESSION['user_id']]);$user=$s->fetch(PDO::FETCH_ASSOC);}elseif(!empty($_COOKIE['deenlink_session'])){$tok=$_COOKIE['deenlink_session'];$s=$pdo->prepare("SELECT u.id, u.username FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.session_token_hash=SHA2(?,256) AND s.is_active=1 LIMIT 1");$s->execute([$tok]);$user=$s->fetch(PDO::FETCH_ASSOC);}}
if(!$user)json_out(401,['status'=>'error','message'=>'Unauthorized']);
$uid=(int)($user['id']??0);
$cid=(int)($_GET['conversation_id']??0);
if(!$cid)json_out(400,['status'=>'error','message'=>'conversation_id required']);
try{
  // check participant
  $chk=$pdo->prepare("SELECT id FROM chat_participants WHERE conversation_id=? AND user_id=? LIMIT 1");
  $chk->execute([$cid,$uid]);
  if(!$chk->fetch())json_out(403,['status'=>'error','message'=>'Not a participant']);

  $stmt=$pdo->prepare("
    SELECT m.id, m.sender_id, m.body, m.media_url, m.created_at, m.read_at, u.username
    FROM chat_messages m
    LEFT JOIN users u ON u.id=m.sender_id
    WHERE m.conversation_id=?
    ORDER BY m.created_at ASC
    LIMIT 200
  ");
  $stmt->execute([$cid]);
  $msgs=$stmt->fetchAll(PDO::FETCH_ASSOC);
  // Mark read_at for messages where other participants have read
  // For simplicity, if peer last_read_at > message created_at, consider read
  $peerRead=$pdo->prepare("SELECT MAX(last_read_at) as lr FROM chat_participants WHERE conversation_id=? AND user_id!=?");
  $peerRead->execute([$cid,$uid]);
  $lr=$peerRead->fetch(PDO::FETCH_ASSOC);
  $lastRead=$lr['lr']??null;
  $out=[];
  foreach($msgs as $m){
    $readAt=$m['read_at'];
    if(!$readAt && $lastRead && $m['sender_id']==$uid){
      if(strtotime($lastRead) >= strtotime($m['created_at'])) $readAt=$lastRead;
    }
    $out[]=[
      'id'=>(int)$m['id'],
      'sender_id'=>(int)$m['sender_id'],
      'body'=>$m['body'],
      'media_url'=>$m['media_url'],
      'created_at'=>$m['created_at'],
      'read_at'=>$readAt,
      'username'=>$m['username']??null,
    ];
  }
  json_out(200,['status'=>'success','messages'=>$out]);
}catch(Exception $e){json_out(500,['status'=>'error','message'=>'Failed','detail'=>$e->getMessage()]);}
