(() => {
const $=id=>document.getElementById(id),cfg=window.FIREBASE_CONFIG;
const ready=cfg&&cfg.apiKey!=="PASTE_API_KEY"&&cfg.storageBucket!=="PASTE_STORAGE_BUCKET"&&cfg.appId!=="PASTE_WEB_APP_ID";
let auth,storage,items=[],filter="all";
const modal=$("modal");
$("adminOpen").onclick=()=>modal.classList.add("open");$("close").onclick=()=>modal.classList.remove("open");
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));render()});
function render(){let grid=$("grid");grid.innerHTML="";let list=items.filter(x=>filter==="all"||x.kind===filter);if(!list.length){grid.textContent="هنوز محتوایی در این بخش ثبت نشده است.";return}list.forEach(x=>{let c=document.createElement("article");c.className="card";let t=document.createElement("div");t.className="thumb";if(x.poster){let im=document.createElement("img");im.src=x.poster;im.alt=x.title;t.append(im)}else t.textContent="✦";let d=document.createElement("div");d.className="info";let h=document.createElement("h3");h.textContent=x.title;let p=document.createElement("p");p.textContent=(x.kind==="series"?"سریال":"فیلم")+" • "+(x.year||"");let a=document.createElement("a");a.href=x.url;a.target="_blank";a.rel="noopener";a.textContent="پخش ویدیو";d.append(h,p,a);c.append(t,d);grid.append(c)})}
if(!ready){$("notice").textContent="برای فعال‌شدن سایت، تنظیمات Web app را در firebase-config.js وارد کنید.";return}
try{firebase.initializeApp(cfg);auth=firebase.auth();storage=firebase.storage()}catch(e){$("notice").textContent="تنظیمات Firebase معتبر نیست.";return}
async function load(){try{let r=await storage.ref("videos").listAll(),vids=r.items.filter(x=>!x.fullPath.includes("/posters/"));items=await Promise.all(vids.map(async ref=>{let [m,url]=await Promise.all([ref.getMetadata(),ref.getDownloadURL()]),c=m.customMetadata||{},poster="";if(c.posterPath){try{poster=await storage.ref(c.posterPath).getDownloadURL()}catch{}}return{title:c.title||ref.name,kind:c.kind||"movie",year:c.year,poster,url}}));$("notice").textContent=items.length+" مورد در آرشیو";render()}catch(e){$("notice").textContent="خطا در خواندن Storage؛ تنظیمات و قوانین را بررسی کنید."}}
load();
auth.onAuthStateChanged(u=>{$("login").hidden=!!u;$("uploadPanel").hidden=!u;if(u)$("who").textContent=u.email});
$("login").onsubmit=async e=>{e.preventDefault();try{await auth.signInWithEmailAndPassword($("email").value,$("password").value)}catch(err){alert("ورود ناموفق: "+err.message)}};
$("logout").onclick=()=>auth.signOut();
$("upload").onsubmit=e=>{e.preventDefault();let f=$("video").files[0],u=auth.currentUser;if(!u||!f)return;if(!f.type.startsWith("video/")){alert("فایل ویدیویی انتخاب کنید");return}
(async()=>{try{let id=Date.now()+"-"+Math.random().toString(36).slice(2,7),posterPath="",pf=$("poster").files[0];if(pf){let pr=storage.ref("videos/posters/"+id+"-"+pf.name.replace(/[^a-z0-9._-]/gi,"_"));await pr.put(pf);posterPath=pr.fullPath}
let ext=(f.name.split(".").pop()||"mp4").replace(/[^a-z0-9]/gi,""),ref=storage.ref("videos/"+id+"."+ext),task=ref.put(f,{contentType:f.type,customMetadata:{title:$("title").value.trim(),kind:$("kind").value,year:$("year").value,description:$("description").value,posterPath,uploadedBy:u.uid}});
task.on("state_changed",s=>{$("progress").style.width=Math.round(s.bytesTransferred/s.totalBytes*100)+"%";$("status").textContent="در حال آپلود..."},err=>$("status").textContent="خطا: "+err.message,async()=>{$("status").textContent="آپلود با موفقیت انجام شد";$("upload").reset();await load()})
}catch(err){$("status").textContent="خطا: "+err.message}})()};
})();