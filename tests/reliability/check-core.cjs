// Local, mocked regression checks for DeenLink's startup/asset paths.
// Run from the app directory: node ../checks/check-core.cjs
// These do not substitute for an Android release-device test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.resolve(process.env.DEENLINK_APP_ROOT || process.cwd()) + path.sep;
const ts = require(path.join(ROOT, 'node_modules/typescript'));
function load(relative, dependencies, globals = {}) {
  const src = fs.readFileSync(ROOT + relative, 'utf8');
  const js = ts.transpileModule(src, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const mod = {exports:{}};
  let assetId = 0;
  const requireMock = (name) => {
    if (Object.prototype.hasOwnProperty.call(dependencies,name)) return dependencies[name];
    if (/\.(?:txt|gz)$/.test(name)) return ++assetId;
    throw new Error('Unexpected dependency: ' + name);
  };
  const scope = {module:mod,exports:mod.exports,require:requireMock,console,Buffer,TextEncoder,TextDecoder,Uint8Array,AbortController,setTimeout,clearTimeout,process:{env:{}},__DEV__:false,...globals};
  vm.runInNewContext(js, scope, {filename:relative});
  return mod.exports;
}
function store(initial={}) {
  const data = new Map(Object.entries(initial));
  return {data,getItem:async k=>data.has(k)?data.get(k):null,setItem:async(k,v)=>{data.set(k,v)},removeItem:async k=>{data.delete(k)}};
}
async function main() {
  let checks = 0;
  const pass = (s) => {checks++;console.log('PASS',s)};
  {
    const native = load('src/lib/nativePack.ts', {
      'react-native':{Platform:{OS:'android'},PixelRatio:{get:()=>2}},
      'expo-file-system':{Directory:class{},File:class{},Paths:{}},
      fflate:{}, './packMeta':{PACK_URL:'https://invalid.test/pack.zip',PACK_VERSION:'test',PACK_BYTES:1},
    });
    assert.equal(native.imgSource(123),123);
    const remote={uri:'https://example.invalid/user-upload.jpg'};
    assert.strictEqual(native.imgSource(remote),remote);
    pass('Static image module remains a bundled numeric resource; uploaded URLs remain unchanged');
  }
  {
    const avatars=load('src/lib/avatarSource.ts',{
      '@/data/avatars':{
        MALE_AVATARS_ITEMS:[{name:'same.jpg',src:11},{name:'name (1).jpg',src:33}],
        FEMALE_AVATARS_ITEMS:[{name:'same.jpg',src:22}],
      },
    });
    assert.equal(avatars.bundledAvatarFor('https://app.deenlink.org/img/profile/male/same.jpg'),11);
    assert.equal(avatars.bundledAvatarFor('img/profile/female/same.jpg'),22);
    assert.equal(avatars.bundledAvatarFor('https://deenlink.org/img/profile/male/name%20(1).jpg'),33);
    assert.equal(avatars.bundledAvatarFor('https://app.deenlink.org/uploads/profile/same.jpg'),undefined);
    assert.equal(avatars.bundledAvatarFor('https://other.test/img/profile/male/same.jpg'),undefined);
    assert.equal(avatars.bundledAvatarFor('//other.test/img/profile/male/same.jpg'),undefined);
    pass('Known built-in avatars use gender-specific local resources; uploads/external media do not');
  }
  {
    const states=[],opened=[];
    const hook=load('src/lib/useGoogleAuth.ts',{
      react:{useState:()=>[false,(v)=>states.push(v)],useCallback:fn=>fn},
      'react-native':{Platform:{OS:'android'},Linking:{openURL:async(url)=>opened.push(url)}},
      '@/api/client':{api:{googleStart:async()=>({ok:true,url:'https://example.invalid/oauth'})}},
      '@/lib/alert':{Alert:{alert:()=>{}}},'@/lib/haptics':{haptic:{medium:()=>{}}},
    });
    await hook.useGoogleAuth().start('signin');
    assert.equal(opened.length,1);assert.equal(states[0],true);assert.equal(states.at(-1),false);
    pass('Native Google button leaves busy state after opening the browser (no native session handoff implied)');
  }
  {
    let calls=0,shouldFail=false,remoteCalls=0;
    const bytes=Buffer.from('{"surah":1,"verses":[]}');
    const content=load('src/lib/content.ts',{
      'expo-asset':{Asset:{fromModule:()=>({localUri:'file:///bundle-cache/test',downloadAsync:async()=>{calls++;if(shouldFail)throw Error('asset unavailable')}})}},
      'react-native':{Platform:{OS:'android'}},
      'expo-file-system':{File:class {async bytes(){return new Uint8Array(bytes)}}},
      '@/lib/gzio':{utf8Decode:b=>Buffer.from(b).toString(),gunzipBytes:b=>b},
      '@/lib/nativePack':{resolvePackModule:()=>null,resolvePackRemote:()=> 'https://invalid.test/content'},
    },{fetch:async()=>{remoteCalls++;return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}}});
    await content.loadSurah(1);assert.equal(remoteCalls,0);assert.equal(calls,1);
    shouldFail=true;await content.loadSurah(2);assert.equal(remoteCalls,1);
    pass('Native content reads bundled asset first, with legacy HTTP fallback on failure');
    shouldFail=false; const before=calls;
    await content.loadBook('buhari');await content.loadBook('muslim');await content.loadBook('buhari');
    assert.equal(calls-before,3);
    pass('Large Hadith cache retains only one full book at a time');
  }
  {
    const data=store();let fetches=0;
    const api=load('src/api/client.ts',{
      '@/lib/blockNotice':{reportBlockedAction:()=>{}},'react-native':{Platform:{OS:'android'}},
      '@/lib/storage':{storage:data},'@/api/mocks':{MOCK_USER:{},MOCK_WALLPAPERS:[]},
    },{fetch:async()=>{fetches++;throw Error('unexpected')}});
    assert.equal(api.BASE,'https://app.deenlink.org');
    const result=await api.restoreSession();assert.equal(result.user,null);assert.equal(fetches,0);
    pass('Fresh native install uses the correct default API origin and skips session network probe');
    await data.setItem('dl.user','{"id":1,"username":"local"}');await data.setItem('dl.session','s');
    await api.clearSession();assert.equal(await data.getItem('dl.user'),null);assert.equal(await data.getItem('dl.session'),null);
    pass('Explicit sign-out removes the offline profile cache');
  }
  for(const [status,expectedUser] of [[500,true],[401,false]]) {
    const data=store({'dl.session':'s','dl.user':'{"id":1,"username":"local"}'});
    const api=load('src/api/client.ts',{
      '@/lib/blockNotice':{reportBlockedAction:()=>{}},'react-native':{Platform:{OS:'android'}},
      '@/lib/storage':{storage:data},'@/api/mocks':{MOCK_USER:{},MOCK_WALLPAPERS:[]},
    },{fetch:async()=>({status,ok:false,headers:{get:()=>null},text:async()=>'{"status":"error"}'})});
    const result=await api.restoreSession();assert.equal(Boolean(result.user),expectedUser);
    pass(`Session restore ${status===500?'keeps cached profile on server error':'rejects a 401 session'}`);
  }
  {
    const data=store({'dl.session':'s','dl.user':'{"id":1,"username":"local"}'});
    const api=load('src/api/client.ts',{
      '@/lib/blockNotice':{reportBlockedAction:()=>{}},'react-native':{Platform:{OS:'android'}},
      '@/lib/storage':{storage:data},'@/api/mocks':{MOCK_USER:{},MOCK_WALLPAPERS:[]},
    },{
      setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,25)),
      fetch:async(_url,opt)=>({status:200,ok:true,headers:{get:()=>null},text:()=>new Promise((_,reject)=>opt.signal.addEventListener('abort',()=>reject(Error('aborted'))))}),
    });
    const result=await api.restoreSession();assert.equal(Boolean(result.user),true);
    pass('Session restore times out even if headers arrive but the body stalls');
  }
  {
    let requests=0,watchCalls=0;
    let finishPermission;
    const permission=new Promise(resolve=>{finishPermission=resolve});
    const data=store();
    const Location={Accuracy:{Balanced:3,High:5},
      requestForegroundPermissionsAsync:()=>{requests++;return permission},
      getForegroundPermissionsAsync:async()=>({granted:false}),
      getCurrentPositionAsync:async()=>({coords:{latitude:6.5,longitude:3.4}}),
      watchPositionAsync:async()=>{watchCalls++;return {remove(){}}},
    };
    const loc=load('src/lib/location.ts',{
      'react-native':{Platform:{OS:'android'}},'expo-location':Location,
      './storage':{storage:data},'./prayer':{FALLBACK_LOCATION:{latitude:1,longitude:1,name:'default'}},
    },{fetch:async()=>({ok:true,json:async()=>({city:'Lagos',countryName:'Nigeria'})})});
    const a=loc.resolveLocation(), b=loc.useCurrentGpsLocation();
    await new Promise(r=>setTimeout(r,0)); assert.equal(requests,1);finishPermission({granted:true});await Promise.all([a,b]);
    pass('Concurrent startup/manual location consumers share one permission prompt');
    const before=requests;await loc.detectLocationChange();const stop=loc.watchLocation(()=>{});await new Promise(r=>setTimeout(r,0));stop?.();
    assert.equal(requests,before);assert.equal(watchCalls,0);
    pass('Passive location checks never request permission or start a denied watcher');
  }
  {
    const data=store({'dl.location':'{"latitude":0,"longitude":0,"name":"Valid zero coordinates"}'});let requests=0;
    const loc=load('src/lib/location.ts',{
      'react-native':{Platform:{OS:'android'}},'expo-location':{requestForegroundPermissionsAsync:async()=>{requests++;return {granted:false}}},
      './storage':{storage:data},'./prayer':{FALLBACK_LOCATION:{latitude:1,longitude:1,name:'default'}},
    });
    const saved=await loc.resolveLocation();assert.equal(saved.latitude,0);assert.equal(saved.longitude,0);assert.equal(requests,0);
    pass('Saved coordinates on the equator or prime meridian remain valid');
  }
  console.log(`\n${checks} mocked regression checks passed. No device behavior is implied.`);
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
