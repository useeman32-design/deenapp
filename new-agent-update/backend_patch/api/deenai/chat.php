<?php
// api/deenai/chat.php — server-side Groq proxy using DB key
// So AI works with NO manual key entry (Groq key from ai_provider_keys)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD']==='OPTIONS'){http_response_code(200);exit;}

$root=__DIR__.'/../..'; $lib=$root.'/api/lib';
function json_out($c,$p){http_response_code($c);echo json_encode($p);exit;}
if(file_exists($lib.'/db.php'))require_once $lib.'/db.php';
if(file_exists($lib.'/response.php'))require_once $lib.'/response.php';

if(!isset($pdo)){
  $cfg=$root.'/config/db.php';
  if(file_exists($cfg)){$cc=require $cfg;$pdo=new PDO("mysql:host={$cc['host']};dbname={$cc['dbname']};charset=utf8mb4",$cc['user'],$cc['pass'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);}
  else{$pdo=new PDO("mysql:host=localhost;dbname=deenlink_db;charset=utf8mb4",getenv('DB_USER')?:'root',getenv('DB_PASS')?:'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);}
}

// Auth optional — allow both authed and guest (like ask.php)
$user=null;
if(function_exists('getCurrentUser')){try{$user=getCurrentUser();}catch(Exception $e){}}
else{session_start();if(!empty($_SESSION['user_id'])){$s=$pdo->prepare("SELECT id FROM users WHERE id=?");$s->execute([$_SESSION['user_id']]);$user=$s->fetch(PDO::FETCH_ASSOC);}}

$input=json_decode(file_get_contents('php://input'), true) ?? $_POST;
$question=trim($input['question']??$input['q']??'');
$messages=$input['messages']??null; // array of {role, content}
$model=$input['model']??'openai/gpt-oss-20b';
$web=$input['web']??false;

if(!$question && !$messages) json_out(400,['status'=>'error','message'=>'question or messages required']);

// Get Groq key from DB
try{
  $stmt=$pdo->prepare("SELECT api_key, model_name FROM ai_provider_keys WHERE provider_name='groq' AND active=1 ORDER BY updated_at DESC LIMIT 1");
  $stmt->execute();
  $row=$stmt->fetch(PDO::FETCH_ASSOC);
  $apiKey=$row['api_key']??null;
  if(!$apiKey){
    // Fallback to env
    $apiKey=getenv('GROQ_API_KEY')?:null;
  }
  if(!$apiKey) json_out(500,['status'=>'error','message'=>'No Groq key configured in DB (ai_provider_keys)']);
  if($row && !empty($row['model_name'])) $model=$row['model_name'];

  // Build messages
  if(!$messages){
    $messages=[['role'=>'user','content'=>$question]];
  }
  // Ensure system prompt if not present
  $hasSystem=false;
  foreach($messages as $m){if(($m['role']??'')==='system')$hasSystem=true;}
  if(!$hasSystem){
    $sys="You are DeenLink AI, warm, concise, helpful. Answer from general knowledge but cite Quran/Hadith when relevant. Keep under 250 words.";
    array_unshift($messages, ['role'=>'system','content'=>$sys]);
  }

  // Call Groq
  $payload=[
    'model'=>$model,
    'messages'=>$messages,
    'temperature'=>0.6,
    'stream'=>false,
  ];
  $ch=curl_init('https://api.groq.com/openai/v1/chat/completions');
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
  curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json','Authorization: Bearer '.$apiKey]);
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);
  $resp=curl_exec($ch);
  $http=curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err=curl_error($ch);
  curl_close($ch);

  if($err) json_out(500,['status'=>'error','message'=>'Groq network error','detail'=>$err]);
  $j=json_decode($resp, true);
  if($http>=400){
    $msg=$j['error']['message']??"Groq HTTP $http";
    json_out(500,['status'=>'error','message'=>$msg,'raw'=>$resp]);
  }
  $answer=$j['choices'][0]['message']['content']??'';
  if(!$answer) json_out(500,['status'=>'error','message'=>'Empty response from Groq','raw'=>$resp]);

  // Optional: save to ai_cache or logs
  try{
    $pdo->prepare("INSERT INTO ai_query_logs (user_id, question, answer, provider_used, provider_model, created_at) VALUES (?,?,?,?,?,NOW())")
        ->execute([$user['id']??null, $question ?: json_encode($messages), $answer, 'groq', $model]);
  }catch(Exception $e){}

  json_out(200,['status'=>'success','answer'=>$answer,'model'=>$model,'provider'=>'groq']);
}catch(Exception $e){
  json_out(500,['status'=>'error','message'=>'Server error','detail'=>$e->getMessage()]);
}
