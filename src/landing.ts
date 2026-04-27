import { AVAILABLE_LANGUAGES, DEFAULT_CONFIG } from './config';

export function generateLandingPage(userConfig: any, manifest: any, configToken: string): string {
    const langOptions = AVAILABLE_LANGUAGES.map(l =>
        '<option value="' + l.code + '"' + (l.code === DEFAULT_CONFIG.vixLang ? ' selected' : '') + '>' + l.flag + ' ' + l.label + '</option>'
    ).join('\n');

    const addonBase = ""; // سيتم تحديده تلقائياً من المسار
    const addonBaseJson = JSON.stringify(addonBase);

    return '<!DOCTYPE html>' +
'<html lang="ar" dir="rtl">' + // تحويل الاتجاه للعربية
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>' + manifest.name + ' - التثبيت</title>' +
'<link rel="icon" href="' + manifest.logo + '">' +
'<link href="https://googleapis.com" rel="stylesheet">' +
`<style>
:root{--primary:#8A5AAB;--primary-hover:#724191;--bg:#0f0f12;--glass:rgba(255,255,255,0.05);--glass-border:rgba(255,255,255,0.1);--text:#fff;--text-muted:rgba(255,255,255,0.7)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Cairo','Inter',sans-serif;background-color:var(--bg);background-image:linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,.8)),url('https://i.imgur.com/uasXEWM.jpeg');background-size:cover;background-position:center;background-attachment:fixed;color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;overflow-x:hidden}
.container{width:100%;max-width:520px;padding:40px 20px;animation:fadeIn .8s ease-out}
@keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.card{background:var(--glass);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--glass-border);border-radius:24px;padding:40px;text-align:center;box-shadow:0 8px 32px 0 rgba(0,0,0,.8)}
.logo{width:120px;height:120px;border-radius:20%;margin:0 auto 24px;display:block;box-shadow:0 4px 15px rgba(0,0,0,.3)}
h1{font-family:'Outfit',sans-serif;font-size:32px;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,#fff 0%,#aaa 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.version{font-size:14px;color:var(--text-muted);background:var(--glass-border);padding:2px 10px;border-radius:12px;display:inline-block;margin-bottom:20px}
p.description{font-size:16px;color:var(--text-muted);line-height:1.6;margin-bottom:32px}
.button-group{display:flex;flex-direction:column;gap:16px}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:14px 28px;border-radius:14px;font-size:16px;font-weight:600;text-decoration:none;transition:all .3s ease;cursor:pointer;border:none;width:100%}
.btn-primary{background-color:var(--primary);color:#fff}
.btn-primary:hover{background-color:var(--primary-hover);transform:translateY(-2px);box-shadow:0 5px 15px rgba(138,90,171,.4)}
.btn-secondary{background-color:var(--glass-border);color:#fff}
.toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(100px);background:rgba(138,90,171,.9);color:#fff;padding:10px 24px;border-radius:50px;font-weight:500;transition:transform .3s ease-out;z-index:1000}
.toast.show{transform:translateX(-50%) translateY(0)}
.config-section{margin-bottom:28px;text-align:right}
.config-section h2{font-size:18px;margin-bottom:16px;color:var(--text-muted);text-align:center}
.source-row{background:rgba(255,255,255,.04);border:1px solid var(--glass-border);border-radius:14px;padding:16px;margin-bottom:12px}
.source-header{display:flex;align-items:center;justify-content:space-between;flex-direction: row-reverse;}
.source-label{font-weight:600;font-size:15px;display:flex;align-items:center;gap:8px}
.lang-select{width:100%;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;margin-top:10px}
</style>
</head>
<body>
<div class="container">
<div class="card">
<img src="' + manifest.logo + '" alt="Logo" class="logo">
<h1>' + manifest.name + '</h1>
<span class="version">v' + manifest.version + '</span>
<p class="description">' + manifest.description + '</p>

<div class="config-section">
<h2>⚙️ إعدادات المصادر</h2>

<div class="source-row" id="vix-row">
    <div class="source-header">
        <span class="source-label">📺 ViX <span class="source-badge">متعدد اللغات</span></span>
        <label class="toggle"><input type="checkbox" id="vixEnabled" checked><span class="toggle-slider"></span></label>
    </div>
    <select id="vixLang" class="lang-select">` + langOptions + `</select>
</div>

<div class="source-row" id="cc-row">
    <div class="source-header">
        <span class="source-label">🎬 CinemaCity <span class="source-badge">دعم الترجمة</span></span>
        <label class="toggle"><input type="checkbox" id="cinemacityEnabled" checked><span class="toggle-slider"></span></label>
    </div>
    <select id="cinemacityLang" class="lang-select">` + langOptions + `</select>
</div>

</div>

<div class="button-group">
    <a href="#" class="btn btn-primary" id="install_button">تثبيت الإضافة</a>
    <button class="btn btn-secondary" onclick="copyManifest()">نسخ رابط المانيفست</button>
</div>
</div>
</div>

<div id="toast" class="toast">تم نسخ الرابط!</div>

<script>
function getConfig(){
    return {
        vixEnabled: document.getElementById('vixEnabled').checked,
        vixLang: document.getElementById('vixLang').value,
        cinemacityEnabled: document.getElementById('cinemacityEnabled').checked,
        cinemacityLang: document.getElementById('cinemacityLang').value,
        animeunityEnabled: false
    };
}

function encodeConfig(cfg){
    return btoa(JSON.stringify(cfg)).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/g,'');
}

function updateLinks(){
    var url = window.location.origin + '/' + encodeConfig(getConfig()) + '/manifest.json';
    document.getElementById('install_button').href = 'stremio://' + url.replace('https://','').replace('http://','');
}

document.querySelectorAll('input, select').forEach(el => el.onchange = updateLinks);
updateLinks();

function copyManifest(){
    var url = window.location.origin + '/' + encodeConfig(getConfig()) + '/manifest.json';
    navigator.clipboard.writeText(url);
    var t = document.getElementById('toast');
    t.className = 'toast show';
    setTimeout(()=>t.className='toast', 2000);
}
</script>
</body>
</html>`;
}
