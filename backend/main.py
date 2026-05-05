"""
LeadForge v3 — Pure Python, zero pip deps, Python 3.15 safe.
All features: URL upload, 30-step sequences, Gmail inbox, PDF reports,
duplicate detection, personalised emails, background scheduler, analytics.
"""
import http.server, json, sqlite3, os, smtplib, imaplib, uuid, csv, io
import base64, re, threading, time, urllib.parse, urllib.request, urllib.error
import concurrent.futures, hashlib, socket
from http.server import HTTPServer, BaseHTTPRequestHandler
from email import message_from_bytes
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timedelta
from urllib.parse import urlparse, parse_qs

import ssl, random as _rand

_UA_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0",
]

def _make_ssl_ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

_ssl_ctx = _make_ssl_ctx()

try:
    import requests as _req
    _req_session = _req.Session()
    _req_session.verify = False
    # Suppress SSL warnings
    try:
        import urllib3; urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except: pass
    def http_get(url, timeout=20):
        for attempt in range(3):
            try:
                h = dict(HEADERS)
                h["User-Agent"] = _rand.choice(_UA_LIST)
                r = _req_session.get(url, headers=h, timeout=timeout, allow_redirects=True)
                if r.status_code == 200:
                    return r.text
                if r.status_code == 403 and attempt < 2:
                    time.sleep(1 + attempt)
                    continue
                return ""
            except Exception as e:
                if attempt < 2:
                    time.sleep(0.5 + attempt)
                    continue
                return ""
        return ""
    def http_post(url, data, hdrs=None, timeout=30):
        try:
            h = dict(HEADERS); h["Content-Type"]="application/json"
            h["User-Agent"] = _rand.choice(_UA_LIST)
            if hdrs: h.update(hdrs)
            r = _req_session.post(url, json=data, headers=h, timeout=timeout)
            return r.status_code, r.json() if r.content else {}
        except Exception as e: return 0, {"error": str(e)}
except ImportError:
    def http_get(url, timeout=20):
        for attempt in range(3):
            try:
                h = dict(HEADERS)
                h["User-Agent"] = _rand.choice(_UA_LIST)
                req = urllib.request.Request(url, headers=h)
                with urllib.request.urlopen(req, timeout=timeout, context=_ssl_ctx) as r:
                    charset = r.headers.get_content_charset() or "utf-8"
                    return r.read().decode(charset, errors="ignore")
            except urllib.error.HTTPError as e:
                if e.code == 403 and attempt < 2:
                    time.sleep(1 + attempt)
                    continue
                return ""
            except Exception as e:
                if attempt < 2:
                    time.sleep(0.5 + attempt)
                    continue
                return ""
        return ""
    def http_post(url, data, hdrs=None, timeout=30):
        try:
            h = {"Content-Type":"application/json"}
            if hdrs: h.update(hdrs)
            body = json.dumps(data).encode()
            req = urllib.request.Request(url, data=body, headers=h, method="POST")
            with urllib.request.urlopen(req, timeout=timeout, context=_ssl_ctx) as r:
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            try: return e.code, json.loads(e.read().decode())
            except: return e.code, {}
        except Exception as e: return 0, {"error": str(e)}

HEADERS = {"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36","Accept":"text/html,*/*","Accept-Language":"en-US,en;q=0.9"}

# ── Constants ─────────────────────────────────────────────────────────────────
DB     = os.path.join(os.path.dirname(__file__), "leads.db")
PORT   = int(os.environ.get("PORT", 8000))
DIST   = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
SENDER = "Ayomide Alonge"
TITLE  = "Ecommerce Growth Specialist"
UPWORK = "https://www.upwork.com/freelancers/shopifydropshippingpluswebsite"
CAL    = "https://calendly.com/alongeayomide2018/ayomide-alonge-"
AVATAR = UPWORK

GOOGLE_CLIENT_ID     = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")

# Every 4 days — 30 educational emails over 117 days
SEQ_DAYS = [1,5,9,13,17,21,25,29,33,37,41,45,49,53,57,61,65,69,73,77,
            81,85,89,93,97,101,105,109,113,117]

SEQ_THEMES = {
    1:"educational intro — teach their #1 missing revenue lever with compelling data, prove you studied their store",
    2:"industry benchmark insight — share a surprising stat specific to their niche they probably don't know",
    3:"customer psychology — explain exactly why their customers leave without buying, with data",
    4:"case study — a store in their exact niche that fixed one thing and saw measurable results",
    5:"email marketing fundamentals — the specific flows every store in their niche needs and why",
    6:"mobile commerce — most stores lose 60%+ of mobile visitors, teach them why and how to fix it",
    7:"seasonal opportunity — the revenue window their niche should be preparing for right now",
    8:"retention economics — teach them the real cost difference between acquiring vs retaining a customer",
    9:"trust hierarchy — how customers decide to buy online, what makes them trust a store",
    10:"conversion benchmarks — what the top 10% of stores in their niche actually convert at",
    11:"one underused growth lever — a specific tactic most stores in their niche overlook entirely",
    12:"AOV strategies — practical ways to increase average order value without more ad spend",
    13:"social proof science — types, placement, and the actual conversion impact of each",
    14:"SEO opportunity — the organic traffic gap most ecommerce stores in their niche are ignoring",
    15:"paid ads efficiency — how to cut spend while improving ROAS with smarter targeting",
    16:"customer lifetime value — how to calculate it and what levers move it most",
    17:"email sequences — the 5 automated flows that generate 30-40% of revenue for top stores",
    18:"product photography impact — how visual presentation directly affects conversion rates",
    19:"loyalty programme economics — when it makes sense and the ROI calculation",
    20:"shipping as a conversion lever — how to use shipping strategy to close more sales",
    21:"ideal customer profiling — how to identify and market to the highest-LTV customers",
    22:"content marketing for ecommerce — how stores in their niche drive organic traffic profitably",
    23:"referral programme mechanics — realistic ROI and how to structure one that actually works",
    24:"analytics that matter — the 7 metrics that actually predict store health vs vanity metrics",
    25:"Q4 preparation — what top stores in their niche do 90 days before peak season",
    26:"influencer marketing ROI — realistic numbers and how to structure profitable partnerships",
    27:"subscription model potential — whether it makes sense for their product type and how to launch",
    28:"international expansion signals — how to know when and where to expand globally",
    29:"year-round evergreen strategy — what separates stores that grow consistently vs seasonally",
    30:"top 5 educational resources — the best tools, courses, and communities for their type of store",
}

CHECKS = [
    (["review","testimonial","rating","trustpilot","yotpo","stamped","loox","okendo"],
     "Has customer reviews",
     "No customer reviews — 88% of consumers trust online reviews as much as personal recommendations. Without social proof, new visitors have no reason to trust you and will buy from competitors who have it."),
    (["verified buyer","verified purchase"],
     "Has verified reviews",
     "No verified reviews — unverified reviews convert 15% worse. Customers are increasingly sceptical and look for the 'Verified Buyer' badge before trusting feedback."),
    (["photo review","video review","ugc"],
     "Has photo/video reviews",
     "No photo or video UGC — stores with visual reviews see 29% higher conversion rates. Text alone no longer convinces modern shoppers."),
    (["live chat","tawk","intercom","zendesk","crisp","tidio","gorgias","freshchat"],
     "Has live chat",
     "No live chat — 73% of customers prefer live chat for pre-purchase questions. Every unanswered question is a lost sale."),
    (["faq","frequently asked","help center","knowledge base"],
     "Has FAQ or help centre",
     "No FAQ — customers abandon when they can't find answers instantly. FAQs also rank in Google and drive organic traffic."),
    (["newsletter","subscribe","get 10%","join our list","sign up","email list","popup"],
     "Has email capture",
     "No email capture — you're losing 97% of visitors who don't buy on first visit. Email list is your most valuable owned marketing asset."),
    (["countdown","timer","limited time","today only","flash sale","ends in","hours left"],
     "Uses urgency tactics",
     "No urgency — urgency and scarcity increase conversions by up to 332%. Without it, customers procrastinate and forget."),
    (["low stock","only 3 left","almost gone","selling fast","limited stock"],
     "Has scarcity messaging",
     "No scarcity messaging — products with low-stock indicators sell 20-30% faster. Fear of missing out is a powerful purchase trigger."),
    (["upsell","you may also like","customers also bought","bundle","frequently bought","complete the look"],
     "Has upsell / cross-sell",
     "No upsell strategy — stores using systematic upsells see 10-30% higher average order value with zero additional ad spend."),
    (["wishlist","save for later","save item","favourite","heart"],
     "Has wishlist feature",
     "No wishlist — wishlist users are 2x more likely to return and complete a purchase. Also enables powerful 'wishlist reminder' email flows."),
    (["free shipping","fast shipping","next day","express","tracked","2-3 day","same day"],
     "Clear shipping proposition",
     "No visible shipping info — unclear shipping is the #1 cause of cart abandonment. Displaying it prominently increases checkout completion by 23%."),
    (["free return","easy return","return policy","30 day","money back","refund","guarantee","exchange"],
     "Has clear return policy",
     "No return policy visible — 66% of shoppers check return policy before buying. Hidden or absent policies destroy purchase confidence."),
    (["track order","order tracking","where is my order"],
     "Has order tracking",
     "No order tracking — post-purchase anxiety causes chargebacks and bad reviews. A simple tracking link reduces support requests by 40%."),
    (["our story","about us","founded","mission","family","handmade","crafted","since"],
     "Has brand story",
     "No brand story — faceless stores have 40% lower repeat purchase rates. Customers buy from people they connect with, not anonymous shops."),
    (["blog","article","tips","guide","how to","journal","news","learn"],
     "Has content / blog",
     "No blog — content marketing generates 3x more leads at 62% lower cost than paid ads. It also drives organic Google traffic."),
    (["instagram","facebook","tiktok","pinterest","youtube","twitter","social"],
     "Active on social media",
     "No social media presence — social proof through follower counts and active profiles increases trust and drives top-of-funnel traffic."),
    (["visa","mastercard","paypal","secure","ssl","stripe","shop pay","apple pay","google pay"],
     "Shows payment trust badges",
     "No payment security signals — 17% of customers abandon checkout specifically due to security concerns. Trust badges directly increase conversion."),
    (["buy now pay later","afterpay","klarna","affirm","sezzle","zip pay"],
     "Has BNPL options",
     "No buy-now-pay-later — BNPL increases AOV by 30-50% and converts price-sensitive customers who would otherwise abandon."),
    (["loyalty","rewards","points","vip","earn","redeem","member","club"],
     "Has loyalty programme",
     "No loyalty programme — acquiring a new customer costs 5-25x more than retaining one. Loyalty programmes directly improve repeat purchase rate."),
    (["referral","refer a friend","invite","share and earn","give","get"],
     "Has referral programme",
     "No referral programme — referred customers have 37% higher retention and 16% higher LTV. Word-of-mouth is the highest-converting channel."),
    (["subscription","subscribe and save","auto-ship","recurring","replenishment"],
     "Has subscription option",
     "No subscription for consumables — subscriptions increase LTV by 200-300% and create predictable recurring revenue."),
    (["abandoned cart","cart reminder","save your cart"],
     "Has cart recovery",
     "No cart recovery flow — abandoned cart emails recover 5-15% of lost revenue. This is the single highest-ROI email automation available."),
    (["size guide","size chart","fit guide","measurement","how to measure"],
     "Has sizing guidance",
     "No size guide — incorrect sizing is the #1 reason for returns. A clear size guide reduces returns by up to 40%."),
    (["compare","comparison","vs","versus","which is right for me","quiz","find your"],
     "Has product comparison/quiz",
     "No product recommendation tool — personalisation increases revenue by 10-15% and reduces decision fatigue for new visitors."),
    (["gift card","gift voucher","e-gift"],
     "Has gift cards",
     "No gift cards — gift cards have the highest margin of any 'product' and drive new customer acquisition at zero ad cost."),
    (["pre-order","coming soon","notify me","waitlist","launch"],
     "Has pre-order / waitlist",
     "No pre-order capability — this de-risks inventory decisions and generates cash flow before products exist."),
    (["currency","gbp","eur","usd","change currency","multi-currency"],
     "Has multi-currency",
     "No multi-currency — international customers abandon when they can't see prices in their local currency. Immediate conversion loss."),
    (["recently viewed","continue shopping"],
     "Has recently viewed products",
     "No recently viewed — customers using this feature convert at 4.5x the site average. It reduces friction for returning shoppers."),
    (["press","as seen in","featured in","media","forbes","vogue","cnn"],
     "Has press / media mentions",
     "No press mentions — displaying media logos increases conversion by up to 72% through instant authority transfer."),
    (["app","download app","play store","app store","mobile app"],
     "Has mobile app",
     "No mobile app — 70% of ecommerce traffic is now mobile. Apps convert 3x better than mobile web and enable push notifications."),
]

# ── Database ──────────────────────────────────────────────────────────────────
def init_db():
    con = sqlite3.connect(DB)
    con.executescript("""
    CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_id TEXT UNIQUE DEFAULT '',
        email TEXT UNIQUE DEFAULT '',
        name TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        created_at TEXT DEFAULT '',
        last_login TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS leads(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 0,
        store_url TEXT, store_name TEXT DEFAULT '',
        owner_email TEXT DEFAULT '', platform TEXT DEFAULT '',
        country TEXT DEFAULT '', niche TEXT DEFAULT '',
        analysis TEXT DEFAULT '{}', pitch TEXT DEFAULT '{}',
        report_html TEXT DEFAULT '', status TEXT DEFAULT 'new',
        created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '',
        error TEXT DEFAULT '', unsubscribe_token TEXT DEFAULT '',
        notes TEXT DEFAULT '', campaign TEXT DEFAULT '',
        email_confidence INTEGER DEFAULT 0, score INTEGER DEFAULT 0,
        social_links TEXT DEFAULT '{}', tags TEXT DEFAULT '[]',
        last_emailed TEXT DEFAULT '', reply_received INTEGER DEFAULT 0,
        reply_content TEXT DEFAULT '', source TEXT DEFAULT '',
        UNIQUE(user_id, store_url)
    );
    CREATE TABLE IF NOT EXISTS email_sequence(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER, step INTEGER, user_id INTEGER DEFAULT 0,
        subject TEXT DEFAULT '', body_html TEXT DEFAULT '',
        body_text TEXT DEFAULT '', scheduled_at TEXT DEFAULT '',
        sent_at TEXT DEFAULT '', opened_at TEXT DEFAULT '',
        status TEXT DEFAULT 'pending', open_count INTEGER DEFAULT 0,
        tracking_id TEXT UNIQUE DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS user_settings(
        user_id INTEGER, key TEXT, value TEXT DEFAULT '',
        PRIMARY KEY(user_id, key)
    );
    CREATE TABLE IF NOT EXISTS email_log(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER DEFAULT 0, sequence_id INTEGER DEFAULT 0,
        user_id INTEGER DEFAULT 0,
        event TEXT DEFAULT '', detail TEXT DEFAULT '',
        created_at TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS scraped_domains(
        domain TEXT PRIMARY KEY, scraped_at TEXT DEFAULT '',
        had_email INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS inbox_replies(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER DEFAULT 0, gmail_msg_id TEXT UNIQUE DEFAULT '',
        from_email TEXT DEFAULT '', subject TEXT DEFAULT '',
        body TEXT DEFAULT '', received_at TEXT DEFAULT '',
        is_read INTEGER DEFAULT 0
    );
    """)
    # Migrations for existing installations
    migrations = [
        "ALTER TABLE leads ADD COLUMN user_id INTEGER DEFAULT 0",
        "ALTER TABLE email_sequence ADD COLUMN user_id INTEGER DEFAULT 0",
        "ALTER TABLE email_log ADD COLUMN user_id INTEGER DEFAULT 0",
    ]
    for m in migrations:
        try: con.execute(m)
        except: pass
    con.commit(); con.close()

init_db()

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c

def cfg(key, default=""):
    env = {"anthropic_key":"ANTHROPIC_KEY","gmail_address":"GMAIL_ADDRESS",
           "gmail_app_password":"GMAIL_APP_PASSWORD","sender_name":"SENDER_NAME","sender_title":"SENDER_TITLE"}
    if key in env and os.environ.get(env[key]): return os.environ[env[key]]
    c = db(); r = c.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone(); c.close()
    return r["value"] if r and r["value"] else default

def set_cfg(key, val):
    c = db(); c.execute("INSERT OR REPLACE INTO settings VALUES(?,?)", (key,val)); c.commit(); c.close()

def ucfg(user_id, key, default=""):
    """Get user-specific setting, fallback to global setting"""
    if user_id:
        c = db(); r = c.execute("SELECT value FROM user_settings WHERE user_id=? AND key=?", (user_id, key)).fetchone(); c.close()
        if r and r["value"]: return r["value"]
    return cfg(key, default)

def set_ucfg(user_id, key, val):
    c = db(); c.execute("INSERT OR REPLACE INTO user_settings(user_id,key,value) VALUES(?,?,?)", (user_id, key, val)); c.commit(); c.close()

# ── JWT ───────────────────────────────────────────────────────────────────────
def _b64url_enc(data):
    if isinstance(data, dict): data = json.dumps(data, separators=(',',':')).encode()
    elif isinstance(data, str): data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def _b64url_dec(s):
    pad = 4 - len(s) % 4
    if pad != 4: s += '=' * pad
    return base64.urlsafe_b64decode(s)

def _jwt_secret():
    c = db(); r = c.execute("SELECT value FROM settings WHERE key='jwt_secret'").fetchone(); c.close()
    if r and r["value"]: return r["value"].encode()
    s = str(uuid.uuid4()) + str(uuid.uuid4())
    set_cfg("jwt_secret", s); return s.encode()

import hmac as _hmac, hashlib as _hashlib
def generate_jwt(user_id, email, name):
    h = _b64url_enc({"alg":"HS256","typ":"JWT"})
    p = _b64url_enc({"sub":str(user_id),"email":email,"name":name,"iat":int(time.time()),"exp":int(time.time())+86400*30})
    sig = _b64url_enc(_hmac.new(_jwt_secret(), f"{h}.{p}".encode(), _hashlib.sha256).digest())
    return f"{h}.{p}.{sig}"

def verify_jwt(token):
    try:
        parts = token.split(".")
        if len(parts) != 3: return None
        h, p, sig = parts
        expected = _b64url_enc(_hmac.new(_jwt_secret(), f"{h}.{p}".encode(), _hashlib.sha256).digest())
        if not _hmac.compare_digest(sig, expected): return None
        data = json.loads(_b64url_dec(p))
        if data.get("exp", 0) < time.time(): return None
        return data
    except: return None

def get_or_create_user(google_id, email, name, avatar_url=""):
    now = datetime.now().isoformat()
    c = db()
    row = c.execute("SELECT id FROM users WHERE google_id=? OR email=?", (google_id, email)).fetchone()
    if row:
        c.execute("UPDATE users SET last_login=?,name=?,avatar_url=? WHERE id=?", (now, name, avatar_url, row["id"]))
        uid = row["id"]
    else:
        c.execute("INSERT INTO users(google_id,email,name,avatar_url,created_at,last_login) VALUES(?,?,?,?,?,?)",
            (google_id, email, name, avatar_url, now, now))
        uid = c.lastrowid
    c.commit(); c.close()
    return uid

# ── Google OAuth ──────────────────────────────────────────────────────────────
def google_oauth_url(state=""):
    gid = cfg("google_client_id") or GOOGLE_CLIENT_ID
    base_url = cfg("base_url", "http://localhost:8000")
    redirect = f"{base_url}/api/auth/google/callback"
    params = urllib.parse.urlencode({
        "client_id": gid, "redirect_uri": redirect,
        "response_type": "code", "scope": "openid email profile",
        "access_type": "offline", "state": state or str(uuid.uuid4())
    })
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"

def google_exchange_code(code):
    gid = cfg("google_client_id") or GOOGLE_CLIENT_ID
    gsec = cfg("google_client_secret") or GOOGLE_CLIENT_SECRET
    base_url = cfg("base_url", "http://localhost:8000")
    redirect = f"{base_url}/api/auth/google/callback"
    data = urllib.parse.urlencode({
        "code": code, "client_id": gid, "client_secret": gsec,
        "redirect_uri": redirect, "grant_type": "authorization_code"
    }).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        print(f"[OAuth] Token exchange error: {e}"); return {}

def google_get_userinfo(access_token):
    req = urllib.request.Request("https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"})
    try:
        with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        print(f"[OAuth] Userinfo error: {e}"); return {}

# ── Email extraction ──────────────────────────────────────────────────────────
def search_company_email_online(store_name, domain):
    """Search online for company contact email — supplements page scraping"""
    found = []
    queries = [
        f'"{store_name}" contact email owner',
        f'"{domain}" owner founder email contact',
        f'site:linkedin.com/in {store_name} founder CEO',
    ]
    for q in queries[:2]:
        try:
            html = http_get(f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(q)}", timeout=8)
            if html:
                raw = re.findall(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', html)
                for e in raw:
                    e = e.lower()
                    sc = score_email(e, f"https://{domain}")
                    if sc >= 30:
                        found.append({"email": e, "confidence": min(sc, 70)})
            time.sleep(0.8)
        except: pass
    seen = set()
    return [x for x in found if x["email"] not in seen and not seen.add(x["email"])]

def research_company_online(store_name, domain, niche):
    """Research the company online to find context for personalized emails"""
    context = []
    try:
        q = urllib.parse.quote(f"{store_name} {niche} store about founder")
        html = http_get(f"https://html.duckduckgo.com/html/?q={q}", timeout=8)
        if html:
            snippets = re.findall(r'<a class="result__snippet"[^>]*>([^<]{30,300})</a>', html)
            if not snippets:
                snippets = re.findall(r'<div class="result__snippet">([^<]{30,300})</div>', html)
            context = [re.sub(r'<[^>]+>', '', s).strip() for s in snippets[:3]]
    except: pass
    return " | ".join(context) if context else ""

_skip_domains = {"sentry.io","shopify.com","wordpress.com","wixsite.com","squarespace.com",
    "bigcommerce.com","example.com","cloudflare.com","google.com","facebook.com","twitter.com",
    "instagram.com","amazon.com","sendgrid.com","mailchimp.com","klaviyo.com","hubspot.com",
    "zendesk.com","stripe.com","paypal.com","googletagmanager.com","doubleclick.net",
    "googleapis.com","w3.org","schema.org","jquery.com","gstatic.com","cdn.jsdelivr.net",
    "microsoft.com","apple.com",
    # Infrastructure / CDN / hosting — never a real store owner email
    "aws.com","support.aws.com","amazonaws.com","azure.com","heroku.com","netlify.com",
    "vercel.com","digitalocean.com","godaddy.com","bluehost.com","hostinger.com",
    "namecheap.com","siteground.com","wpengine.com","kinsta.com","pantheon.io",
    "fastly.com","akamai.com","maxcdn.com","cloudfront.net","rackspace.com",
    # Analytics / tracking — not contact emails
    "hotjar.com","crazyegg.com","optimizely.com","segment.com","mixpanel.com",
    "amplitude.com","fullstory.com","heap.io","mouseflow.com","luckyorange.com",
    # Marketing platforms — not the store owner
    "constantcontact.com","sendinblue.com","brevo.com","drip.com","convertkit.com",
    "activecampaign.com","omnisend.com","privy.com","justuno.com","optinmonster.com",
    # Ecommerce tools — not the store owner
    "yotpo.com","stamped.io","loox.io","okendo.io","judge.me","reviews.io",
    "recharge.com","bold.co","oberlo.com","printful.com","printify.com",
    "shipstation.com","shippo.com","aftership.com","returnly.com","narvar.com",
    # Social / messaging — too generic
    "tiktok.com","snapchat.com","pinterest.com","reddit.com","discord.com",
    "telegram.org","whatsapp.com","skype.com","zoom.us",
    # Developer / code — not store contacts
    "github.com","gitlab.com","stackoverflow.com","npmjs.com","unpkg.com",
    "cdnjs.com","bootstrapcdn.com","fontawesome.com","fonts.googleapis.com",
    # Placeholder / testing domains
    "test.com","localhost","mailinator.com","guerrillamail.com","tempmail.com",
    "yopmail.com","sharklasers.com","grr.la","guerrillamailblock.com",
    }

def score_email(email, store_url):
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email): return 0
    e = email.lower().strip()
    dom = e.split("@")[1]; local = e.split("@")[0]
    store_dom = re.sub(r'^https?://(www\.)?','',store_url).split("/")[0].lower()
    store_base = ".".join(store_dom.split(".")[-2:]) if "." in store_dom else ""

    # Check skip list including subdomains (e.g. support.aws.com matches aws.com)
    dom_parts = dom.split(".")
    for i in range(len(dom_parts) - 1):
        check_dom = ".".join(dom_parts[i:])
        if check_dom in _skip_domains: return 0

    # Block obvious junk
    if any(x in local for x in ["noreply","no-reply","donotreply","bounce","test","example","sample","mailer-daemon","postmaster"]): return 0
    if e.endswith((".png",".jpg",".gif",".svg",".webp",".css",".js")): return 0
    if len(local) > 35 or len(e) > 60: return 0

    sc = 30
    # Same domain = strong signal
    if dom == store_dom or dom == store_base: sc += 50
    # Role-based emails only get bonus if they're on the store's own domain
    elif any(x in local for x in ["contact","info","hello","support","sales","admin","shop","hi","enquiry","help","order","team"]):
        sc += 5  # small bonus for role-based, but on foreign domain it's probably not the owner
    # Personal name pattern on store domain
    if (dom == store_dom or dom == store_base) and re.match(r'^[a-z]{2,15}(\.[a-z]{2,15})?$', local): sc += 15
    # Generic free email = not a business
    if dom in ["gmail.com","yahoo.com","hotmail.com","outlook.com","aol.com","icloud.com","live.com","protonmail.com","zoho.com"]: sc -= 15
    # Domain completely unrelated to store = heavy penalty
    if dom != store_dom and dom != store_base and store_base and store_base.split(".")[0] not in dom:
        sc -= 25
    if len(local) > 28: sc -= 10
    return max(0, min(100, sc))

def extract_emails(html, url):
    raw = re.findall(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', html)
    seen = set(); out = []
    for e in raw:
        e = e.lower().strip()
        if e in seen: continue
        seen.add(e)
        dom = e.split("@")[1] if "@" in e else ""
        if dom in _skip_domains: continue
        sc = score_email(e, url)
        if sc >= 35: out.append({"email":e,"confidence":sc})
    out.sort(key=lambda x: x["confidence"], reverse=True)
    return out

def get_store_emails(url):
    """Fast parallel email extraction — prioritized pages, early exit on high-confidence email"""
    all_e = []; social = {}
    base = url.rstrip("/")

    # Prioritized paths — most likely to have email first
    priority_paths = ["/", "/contact", "/contact-us", "/pages/contact", "/about", "/pages/about-us"]
    extra_paths = ["/about-us", "/pages/contact-us", "/help", "/support", "/pages/help",
        "/pages/faq", "/faq", "/pages/reach-us", "/pages/get-in-touch",
        "/pages/store-information", "/pages/legal", "/info"]

    def fetch_path(path):
        try:
            html = http_get(base + path, timeout=8)
            if not html: return [], {}
            emails = extract_emails(html, url)
            for mailto in re.findall(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', html):
                sc = score_email(mailto, url)
                if sc > 0: emails.append({"email": mailto.lower(), "confidence": min(sc + 20, 100)})
            soc = {}
            if path == "/":
                for m in re.finditer(r'href="(https?://(?:www\.)?(instagram|facebook|twitter|x|linkedin|tiktok|youtube|pinterest)\.com/[^"\s]+)"', html):
                    link, plat = m.group(1), m.group(2)
                    if plat == "x": plat = "twitter"
                    soc[plat] = link
            return emails, soc
        except: return [], {}

    # Phase 1: Check priority pages in parallel (fast)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(fetch_path, p): p for p in priority_paths}
        for fut in concurrent.futures.as_completed(futures, timeout=20):
            try:
                emails, soc = fut.result()
                all_e += emails
                social.update(soc)
            except: pass

    # If we already have a high-confidence email, skip extra pages
    best_so_far = max((e["confidence"] for e in all_e), default=0)
    if best_so_far < 60:
        # Phase 2: Check extra pages only if no good email yet
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
            futures = {ex.submit(fetch_path, p): p for p in extra_paths}
            for fut in concurrent.futures.as_completed(futures, timeout=15):
                try:
                    emails, soc = fut.result()
                    all_e += emails
                except: pass

    # Phase 3: Social media bios only if still no email
    if best_so_far < 50:
        social_fetch = []
        if social.get("instagram"):
            un = social["instagram"].rstrip("/").split("/")[-1].lstrip("@").split("?")[0]
            if un and len(un) > 1: social_fetch.append(f"https://www.instagram.com/{un}/")
        if social.get("facebook"): social_fetch.append(social["facebook"])
        for soc_url in social_fetch[:2]:
            if [e for e in all_e if e["confidence"] >= 60]: break
            html = http_get(soc_url, timeout=6)
            if html: all_e += extract_emails(html, url)

    # Phase 4: Whois as last resort
    domain_name = re.sub(r'^https?://(www\.)?','',url).split('/')[0]
    if not [e for e in all_e if e["confidence"] >= 35]:
        try:
            whois_html = http_get(f"https://www.whois.com/whois/{domain_name}", timeout=6)
            if whois_html: all_e += extract_emails(whois_html, url)
        except: pass

    # Phase 5: Search online for company contact email
    if not [e for e in all_e if e["confidence"] >= 50]:
        store_name_guess = re.sub(r'\.(com|co\.uk|org|net|store|shop|io)$', '', domain_name).replace('-', ' ').replace('_', ' ').title()
        online = search_company_email_online(store_name_guess, domain_name)
        all_e += online

    # Deduplicate and rank
    seen = set(); unique = []
    for item in sorted(all_e, key=lambda x: x["confidence"], reverse=True):
        if item["email"] not in seen: seen.add(item["email"]); unique.append(item)
    best = unique[0] if unique else None
    return {
        "email": best["email"] if best else "",
        "confidence": best["confidence"] if best else 0,
        "all": unique[:8], "social": social
    }

# ── Platform & analysis ───────────────────────────────────────────────────────
def detect_platform(html):
    h = html.lower()
    if "cdn.shopify.com" in h or "shopify.com/s/files" in h: return "Shopify"
    if "woocommerce" in h or ("wp-content" in h and "cart" in h): return "WooCommerce"
    if "bigcommerce" in h: return "BigCommerce"
    if "wix.com" in h or "wixsite.com" in h or "_wix_" in h: return "Wix"
    if "squarespace.com" in h or "sqspcdn.com" in h: return "Squarespace"
    if "prestashop" in h: return "PrestaShop"
    if "magento" in h: return "Magento"
    if "opencart" in h: return "OpenCart"
    if "ecwid" in h: return "Ecwid"
    if "wp-content" in h: return "WordPress"
    return "Ecommerce"

def detect_niche(html):
    """Score-based niche detection — finds the DOMINANT niche, not first match"""
    h = html.lower()
    # Each entry: (keywords_list, niche_name, weight)
    niche_rules = [
        (["dress","blouse","skirt","trouser","shirt","jeans","hoodie","sneaker","streetwear","outfits","wardrobe","fashion week","style","outfit"], "Fashion & Apparel", 3),
        (["clothing","apparel","wear","garment","textile","fabric"], "Fashion & Apparel", 1),
        (["lipstick","mascara","foundation","blush","eyeshadow","makeup","cosmetic","beauty product","skincare","serum","moisturis","cleanser","toner","glow"], "Beauty & Cosmetics", 3),
        (["supplement","vitamin","protein powder","wellness","detox","weight loss","keto","probiotic","collagen","cbd","hemp"], "Health & Wellness", 3),
        (["gym","fitness","workout","yoga","pilates","training","athlet","sport bra","legging"], "Fitness & Sports", 2),
        (["coffee","tea","snack","food","meal","recipe","organic food","chocolate","wine","beer","spirit","sauce","spice"], "Food & Beverage", 2),
        (["laptop","phone","tablet","headphone","earphone","speaker","cable","charger","gadget","electronics","tech","computer"], "Electronics & Tech", 2),
        (["sofa","furniture","bed frame","mattress","lamp","cushion","curtain","wall art","decor","interior","home goods"], "Home & Garden", 2),
        (["plant","seed","pot","garden","outdoor furniture","patio"], "Home & Garden", 1),
        (["puppy","kitten","dog food","cat food","pet toy","pet supply","animal"], "Pet Products", 3),
        (["baby","infant","toddler","nappy","diaper","pram","stroller","toy","kids","children"], "Baby & Kids", 2),
        (["ring","necklace","bracelet","earring","pendant","gold","silver","gemstone","diamond","jewelry","jewellery"], "Jewelry & Accessories", 3),
        (["bag","handbag","wallet","purse","backpack","luggage","suitcase"], "Bags & Accessories", 2),
        (["car","vehicle","tyre","tire","motor","auto","motorcycle","bike part"], "Automotive", 3),
        (["book","ebook","course","learning","education","study","school","training program"], "Books & Education", 2),
        (["paint","canvas","craft","handmade","artisan","pottery","sculpture"], "Art & Crafts", 2),
        (["camping","hiking","climbing","fishing","hunting","survival","outdoor gear"], "Outdoor & Adventure", 2),
        (["sustainable","eco-friendly","organic","recycled","zero waste","green product","ethical"], "Sustainable/Eco", 2),
        (["luxury","premium","exclusive","high-end","designer","bespoke"], "Luxury", 1),
        (["ankara","dashiki","kente","agbada","aso-oke","african print","african fabric","afrocentric"], "African Fashion", 5),
    ]
    scores = {}
    for kws, name, weight in niche_rules:
        sc = sum(weight for kw in kws if kw in h)
        if sc > 0:
            scores[name] = scores.get(name, 0) + sc
    if scores:
        return max(scores, key=scores.get)
    return "Ecommerce"

def analyse_store(html, url):
    h = html.lower()
    issues, strengths = [], []
    for kws, strength, issue in CHECKS:
        if any(k in h for k in kws): strengths.append(strength)
        else: issues.append(issue)

    # Extra analysis: broken links, missing meta tags, image issues
    extra_issues = []

    # Check for missing meta description
    if '<meta name="description"' not in h and '<meta property="og:description"' not in h:
        extra_issues.append("Missing meta description — Google shows a random snippet instead of your carefully crafted message. This directly reduces click-through rates from search results by up to 30%.")

    # Check for missing viewport (mobile)
    if '<meta name="viewport"' not in h:
        extra_issues.append("No mobile viewport tag — your site renders at desktop width on phones, making it virtually unusable for the 70% of ecommerce traffic that comes from mobile devices.")

    # Check for images without alt text
    imgs = re.findall(r'<img[^>]+>', h)
    imgs_no_alt = [i for i in imgs if 'alt=' not in i or 'alt=""' in i or "alt=''" in i]
    if len(imgs_no_alt) > 3:
        extra_issues.append(f"Found {len(imgs_no_alt)} images without alt text — this hurts SEO rankings and makes your store inaccessible to visually impaired shoppers. Google penalises sites with poor accessibility.")

    # Check for missing canonical URL
    if '<link rel="canonical"' not in h:
        extra_issues.append("No canonical URL tag — search engines may index duplicate versions of your pages, splitting your ranking authority across multiple URLs and weakening your position for every keyword.")

    # Check for missing structured data / schema
    if '"@type"' not in h and 'application/ld+json' not in h:
        extra_issues.append("No structured data markup — your products won't show star ratings, prices, or availability in Google search results. Competitors with structured data get 30% higher click-through rates.")

    # Check for slow-loading signals
    large_scripts = re.findall(r'<script[^>]+src="[^"]+"', h)
    if len(large_scripts) > 15:
        extra_issues.append(f"Detected {len(large_scripts)} external scripts loading on your homepage — excessive JavaScript slows page load dramatically. Every additional second of load time reduces conversions by 7%.")

    # Check for missing favicon
    if '<link[^>]+rel="[^"]*icon' not in h and '<link rel="icon"' not in h and 'favicon' not in h:
        extra_issues.append("Missing favicon — your browser tab shows a generic icon instead of your brand. This small detail signals unprofessionalism to every single visitor.")

    # Check for HTTP mixed content
    if 'http://' in h and url.startswith('https'):
        http_refs = re.findall(r'(?:src|href)="http://', h)
        if len(http_refs) > 2:
            extra_issues.append(f"Mixed content warning — {len(http_refs)} resources loaded over insecure HTTP on an HTTPS page. Browsers flag this as 'Not Secure', destroying buyer trust at the most critical moment.")

    issues += extra_issues

    # Broken link quick-check (check first 8 internal links)
    broken_links = []
    internal_links = re.findall(r'href="(/[^"#]{3,60})"', html)
    base = url.rstrip("/")
    checked = 0
    for link_path in list(set(internal_links))[:8]:
        try:
            full_url = base + link_path
            test_html = http_get(full_url, timeout=5)
            if not test_html or len(test_html) < 100:
                broken_links.append(link_path)
        except: pass
        checked += 1
    if broken_links:
        issues.insert(0, f"Found {len(broken_links)} broken internal links ({', '.join(broken_links[:3])}) — broken links frustrate customers, kill trust, and waste the SEO authority you've built. Google actively demotes sites with broken navigation.")

    raw = round(len(strengths) / max(len(CHECKS) + len(extra_issues), 1) * 100)
    score = min(raw, 50)  # HARD CAP at 50
    return {"issues":issues,"strengths":strengths,"score":score,"raw_score":raw,
            "total":len(CHECKS)+len(extra_issues),"broken_links":broken_links}

def get_store_name(html, domain):
    m = re.search(r'<title[^>]*>([^<]{2,80})</title>', html, re.I)
    if m:
        n = re.sub(r'\s*[|\-–—:]\s*.+$','',m.group(1)).strip()
        if 2 < len(n) < 60: return n
    return domain

# ── Claude AI ─────────────────────────────────────────────────────────────────
def ai(prompt, max_tokens=600):
    key = cfg("anthropic_key")
    if not key:
        print("[AI] No API key found in settings")
        return ""
    if "***" in key or len(key) < 20:
        print(f"[AI] API key looks invalid (length={len(key)}, masked={('***' in key)})")
        return ""
    status, data = http_post("https://api.anthropic.com/v1/messages",
        {"model":"claude-haiku-4-5-20251001","max_tokens":max_tokens,
         "messages":[{"role":"user","content":prompt}]},
        hdrs={"x-api-key":key,"anthropic-version":"2023-06-01"})
    if status == 200 and data.get("content"):
        return data["content"][0]["text"].strip()
    # Log the error for debugging
    if status == 401:
        print(f"[AI] ERROR 401: Invalid API key. Key starts with: {key[:8]}...")
    elif status == 400:
        print(f"[AI] ERROR 400: Bad request — {data.get('error',{}).get('message','unknown')}")
    elif status == 429:
        print(f"[AI] ERROR 429: Rate limited — waiting 5s")
        time.sleep(5)
    elif status != 200:
        print(f"[AI] ERROR {status}: {json.dumps(data)[:200]}")
    else:
        print(f"[AI] Empty response from API (status={status})")
    return ""

def ai_json(prompt, max_tokens=600):
    text = ai(prompt, max_tokens)
    if not text: return {}
    try: return json.loads(re.sub(r'```json|```','',text).strip())
    except:
        print(f"[AI] Failed to parse JSON from: {text[:100]}...")
        return {}

# ── Report builder (removed — PDF feature deprecated) ─────────────────────────
def build_report(*args, **kwargs):
    return ""  # PDF generation removed


# ── Email builder ─────────────────────────────────────────────────────────────

def build_email(subject, body, sender_name, sender_title, unsub_url, pixel_url, step=1, store_name="", store_domain="", niche="", cal_link="", user_id=0):
    avatar = cfg("avatar_url", AVATAR)
    cal = cal_link or ucfg(user_id, "calendar_link", CAL) if user_id else cfg("calendar_link", CAL)
    paras = [p.strip() for p in body.split("\n\n") if p.strip()]
    body_html = "".join(
        "<p style='margin:0 0 16px 0;color:#1a1a1a;font-size:15px;line-height:1.9'>"
        + p.replace(chr(10), "<br/>") + "</p>"
        for p in paras
    )
    cta_block = (
        "<table cellpadding='0' cellspacing='0' style='margin:24px 0'>"
        "<tr><td style='background:#0f0f1a;border-radius:8px'>"
        "<a href='" + cal + "' style='display:inline-block;background:#0f0f1a;color:#c8f135;"
        "font-weight:700;font-size:14px;padding:14px 30px;border-radius:8px;text-decoration:none;letter-spacing:.02em'>"
        "📅 Book a Free 15-Min Discovery Call</a></td></tr></table>"
    )
    return (
        "<!DOCTYPE html><html lang='en'><head>"
        "<meta charset='UTF-8'/><meta name='viewport' content='width=device-width,initial-scale=1'/>"
        "<title>" + subject + "</title></head>"
        "<body style='margin:0;padding:0;background:#f4f5f7'>"
        "<div style='display:none;max-height:0;overflow:hidden'>"
        + (store_name or store_domain) + " — insight for you</div>"
        "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:#f4f5f7'>"
        "<tr><td align='center' style='padding:30px 16px'>"
        "<table role='presentation' width='600' cellpadding='0' cellspacing='0' style='max-width:600px;width:100%'>"

        # Header
        "<tr><td style='background:linear-gradient(135deg,#0f0f1a,#1e1b4b);border-radius:12px 12px 0 0;padding:22px 32px'>"
        "<table width='100%' cellpadding='0' cellspacing='0'><tr>"
        "<td><span style='color:#fff;font-size:15px;font-weight:700'>" + sender_name + "</span>"
        "<span style='color:#94a3b8;font-size:12px;margin-left:8px'>· " + sender_title + "</span></td>"
        "<td align='right'><span style='background:#c8f135;color:#0f0f1a;font-size:10px;font-weight:800;"
        "padding:4px 10px;border-radius:20px;letter-spacing:.06em'>ECOMMERCE INSIGHTS</span></td>"
        "</tr></table></td></tr>"

        # Body
        "<tr><td style='background:#fff;padding:32px 32px 20px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0'>"
        + body_html + cta_block +
        "</td></tr>"

        # Divider
        "<tr><td style='background:#fff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:0 32px'>"
        "<div style='border-top:1px solid #f1f5f9'></div></td></tr>"

        # Signature
        "<tr><td style='background:#fff;padding:22px 32px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0'>"
        "<table cellpadding='0' cellspacing='0'><tr>"
        "<td style='padding-right:14px;vertical-align:top'>"
        "<div style='width:52px;height:52px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#667eea,#764ba2)'>"
        "<img src='" + avatar + "' alt='" + sender_name + "' width='52' height='52' "
        "style='width:52px;height:52px;object-fit:cover;border-radius:50%;display:block'/></div></td>"
        "<td style='vertical-align:top'>"
        "<div style='font-size:15px;font-weight:700;color:#0f172a'>" + sender_name + "</div>"
        "<div style='font-size:12px;color:#667eea;margin:3px 0 8px'>" + sender_title + "</div>"
        "<table cellpadding='0' cellspacing='0'><tr>"
        "<td style='padding-right:14px'><a href='" + UPWORK + "' style='font-size:12px;color:#667eea;text-decoration:none'>🔗 Upwork Profile</a></td>"
        "<td><a href='" + CAL + "' style='font-size:12px;color:#667eea;text-decoration:none'>📅 Book a Call</a></td>"
        "</tr></table></td></tr></table></td></tr>"

        # Footer
        "<tr><td style='background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px'>"
        "<p style='margin:0;font-size:11px;color:#94a3b8;line-height:1.6'>"
        "You received this because " + (store_domain or "your store") + " matched our ecommerce growth criteria. "
        "<a href='" + unsub_url + "' style='color:#94a3b8'>Unsubscribe</a></p></td></tr>"

        "</table></td></tr></table>"
        "<img src='" + pixel_url + "' width='1' height='1' alt='' style='display:none'/>"
        "</body></html>"
    )


# ── SMTP ──────────────────────────────────────────────────────────────────────
def send_smtp(to, subject, html, text, token, store_name="", user_id=0):
    gmail = ucfg(user_id, "gmail_address") or cfg("gmail_address")
    pwd   = ucfg(user_id, "gmail_app_password") or cfg("gmail_app_password")
    sn    = ucfg(user_id, "sender_name") or cfg("sender_name", SENDER)
    if not gmail or not pwd:
        raise Exception("Gmail not configured — go to Settings and add Gmail address + App Password.")
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{sn} <{gmail}>"
    msg["To"] = to
    base = ucfg(user_id, "base_url") or cfg("base_url", "http://localhost:8000")
    msg["List-Unsubscribe"] = f"<{base}/unsubscribe/{token}>"
    msg.attach(MIMEText(text or "", "plain"))
    msg.attach(MIMEText(html or "", "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as s:
        s.login(gmail, pwd)
        s.send_message(msg)

# ── Store pipeline ────────────────────────────────────────────────────────────

def process(url, campaign):
    """Full pipeline: fetch → emails → analyse → report → pitch → 30 sequences"""
    url = url.strip().rstrip("/")
    if not url.startswith("http"): url = "https://" + url
    domain = re.sub(r'^https?://(www\.)?', '', url).split("/")[0]
    print(f"\n  ▶ Processing: {domain}")

    # ── Duplicate check ───────────────────────────────────────────────────────
    c = db()
    ex = c.execute("SELECT id,status FROM leads WHERE store_url LIKE ?", (f"%{domain}%",)).fetchone()
    sc = c.execute("SELECT domain FROM scraped_domains WHERE domain=?", (domain,)).fetchone()
    c.close()
    if ex: return {"skip": "exists", "id": ex["id"], "status": ex["status"]}
    if sc: return {"skip": "scraped"}

    # ── Insert placeholder ────────────────────────────────────────────────────
    token = str(uuid.uuid4()); now = datetime.now().isoformat()
    c = db()
    c.execute("INSERT OR IGNORE INTO leads(store_url,status,created_at,updated_at,unsubscribe_token,campaign) VALUES(?,?,?,?,?,?)",
        (url, "processing", now, now, token, campaign))
    c.commit()
    row = c.execute("SELECT id FROM leads WHERE store_url=?", (url,)).fetchone()
    c.close()
    if not row: return {"error": "db_insert_failed"}
    lid = row["id"]

    try:
        # ── 1. Fetch homepage (try multiple variants) ─────────────────────────
        html = ""
        # Build list of URL variants to try
        variants = [url]
        if "www." not in url:
            variants.append(url.replace("://", "://www."))
        if "www." in url:
            variants.append(url.replace("://www.", "://"))
        # Also try http if https fails
        for v in list(variants):
            if v.startswith("https://"):
                variants.append(v.replace("https://", "http://"))

        for try_url in variants:
            html = http_get(try_url, timeout=22)
            if html and len(html) >= 300:
                url = try_url  # use the one that worked
                break

        if not html or len(html) < 300:
            _upd(lid, {"status": "error", "error": f"Site unreachable after trying {len(variants)} URL variants"})
            c = db()
            c.execute("INSERT OR IGNORE INTO scraped_domains VALUES(?,?,0)", (domain, datetime.now().isoformat()))
            c.commit(); c.close()
            return {"error": "unreachable"}

        # ── 2. Basic store info ───────────────────────────────────────────────
        platform   = detect_platform(html)
        store_name = get_store_name(html, domain)
        niche      = detect_niche(html)
        print(f"  [{domain}] {platform} | {niche} | {store_name}")

        # ── 3. Email extraction (aggressive) ─────────────────────────────────
        email_data = get_store_emails(url)
        email      = email_data["email"]
        conf       = email_data["confidence"]
        social     = email_data["social"]
        print(f"  [{domain}] Email: {email or 'NONE'} ({conf}%) | Social: {','.join(social.keys()) if social else 'none'}")

        # Skip if no email found or confidence too low
        if not email or conf < 35:
            _upd(lid, {"status": "no_email", "error": f"No reliable email found (best: {email or 'none'} at {conf}%)"})
            c = db()
            c.execute("INSERT OR IGNORE INTO scraped_domains VALUES(?,?,0)", (domain, datetime.now().isoformat()))
            c.commit(); c.close()
            print(f"  [{domain}] Skipped — no email (best confidence: {conf}%)")
            return {"skip": "no_email"}

        # ── 4. Store analysis ─────────────────────────────────────────────────
        analysis = analyse_store(html, url)
        detected_niche = detect_niche(html)
        analysis["niche"] = detected_niche
        niche = detected_niche  # use detected niche, not search query niche

        # ── 5. Load settings ──────────────────────────────────────────────────
        user_id      = campaign_user_id if 'campaign_user_id' in dir() else 0
        api_key      = ucfg(user_id, "anthropic_key") or cfg("anthropic_key")
        sender_name  = ucfg(user_id, "sender_name") or cfg("sender_name",  SENDER)
        sender_title = ucfg(user_id, "sender_title") or cfg("sender_title", TITLE)
        base_url     = ucfg(user_id, "base_url") or cfg("base_url", "http://localhost:8000")
        cal_link     = ucfg(user_id, "calendar_link") or cfg("calendar_link", CAL)
        if api_key and len(api_key) > 20 and "***" not in api_key:
            print(f"  [{domain}] AI key loaded — generating educational sequence")
        else:
            print(f"  [{domain}] ⚠ NO VALID AI KEY — using fallback templates")

        # ── 6. Research company online ────────────────────────────────────────
        company_context = research_company_online(store_name, domain, niche)
        print(f"  [{domain}] Company context: {company_context[:80] if company_context else 'none'}")

        # ── 7. Generate educational first email ───────────────────────────────
        top_issue = analysis["issues"][0] if analysis["issues"] else ""
        top_issue_title = top_issue.split(" — ")[0] if " — " in top_issue else top_issue[:60]
        top_issue_detail = top_issue.split(" — ")[1] if " — " in top_issue else top_issue
        issues_text = "\n".join(f"- {i.split(' — ')[0]}" for i in analysis["issues"][:4])
        social_str  = ", ".join(social.keys()) if social else "none"

        if api_key:
            pitch = ai_json(
                f"You are {sender_name}, an ecommerce educator and growth advisor.\n"
                f"Store: {store_name} ({domain}) | Platform: {platform} | Niche: {niche}\n"
                f"Company context from web: {company_context or 'not available'}\n"
                f"What you observed on their site:\n{issues_text}\n"
                f"Social presence: {social_str}\n\n"
                f"Write a HIGHLY PERSONALIZED educational email that:\n"
                f"1. References something specific you noticed about {store_name} (their platform, niche, or a gap you saw)\n"
                f"2. Teaches them ONE critical insight about {top_issue_title} — use a real industry stat\n"
                f"3. Explains WHY this matters specifically for {niche} stores on {platform}\n"
                f"4. Gives one actionable tip they can think about\n"
                f"5. Ends with a soft CTA to book a discovery call\n\n"
                f"SUBJECT: Intriguing, educational, specific to {niche}. Max 8 words. No 'I found X on your store'.\n"
                f"Examples: 'The {niche} metric 73% of stores ignore', 'Why {platform} {niche} stores plateau at this stage'\n\n"
                f"BODY: 130-150 words. Peer-to-peer tone. Genuinely educational. NOT salesy.\n"
                f"NO 'I hope this email finds you well'. NO generic openers.\n"
                f"Mention {store_name} by name. Feel like a valuable insight from a knowledgeable peer.\n"
                f'Return ONLY valid JSON: {{"subject":"...","body":"..."}}',
                700
            )
            if not pitch:
                pitch = {
                    "subject": f"What top {niche} stores do differently on {platform}",
                    "body": (
                        f"Hi,\n\n"
                        f"I was researching {niche} stores on {platform} and came across {store_name}.\n\n"
                        f"One thing that consistently separates high-converting {niche} stores from the rest: {top_issue_title.lower()}.\n\n"
                        f"Industry data shows stores that address this see 15-25% higher conversion rates — it's one of the most impactful changes you can make.\n\n"
                        f"I'd love to share a few specific thoughts on {store_name} — would a 15-minute call this week work?\n\n"
                        f"{sender_name}"
                    )
                }
        else:
            pitch = {
                "subject": f"What top {niche} stores do differently on {platform}",
                "body": (
                    f"Hi,\n\n"
                    f"I was studying {niche} stores on {platform} and noticed {store_name} — impressive what you've built.\n\n"
                    f"One insight I keep seeing separate top-performing {niche} stores from the rest: {top_issue_title.lower()}. "
                    f"Stores that address this typically see 15-25% higher conversion rates.\n\n"
                    f"I'd love to share some specific thoughts for {store_name} — would a 15-minute call work?\n\n"
                    f"{sender_name}"
                )
            }

        # ── 8. Generate 30-email educational sequence (every 4 days) ──────────
        seq_rows   = []
        first_subj = pitch.get("subject", f"Insight for {store_name}")

        for seq_idx, day in enumerate(SEQ_DAYS):
            step_num = seq_idx + 1
            if step_num == 1:
                content = pitch
            elif api_key:
                theme = SEQ_THEMES.get(step_num, "educational ecommerce insight for their niche")
                fallback_subs = [
                    f"The {niche} conversion insight for {platform}",
                    f"What's working in {niche} right now",
                    f"One thing about {store_name}'s growth stage",
                    f"The data on {niche} stores this quarter",
                    f"A {platform} insight for {niche} owners",
                    f"What I've seen work for {niche} stores",
                ]
                fallback = {
                    "subject": fallback_subs[(step_num - 2) % len(fallback_subs)],
                    "body": f"Hi,\n\nQuick educational insight for {niche} store owners on {platform}...\n\n{first_subj}\n\nHappy to discuss — book a call whenever works.\n\n{sender_name}"
                }
                content = ai_json(
                    f"Educational email #{step_num} to {store_name} ({domain}), a {niche} store on {platform}.\n"
                    f"Theme: {theme}\n"
                    f"Previous subject: '{first_subj}'\n"
                    f"Key things about their store: {', '.join(i.split(' — ')[0] for i in analysis['issues'][:3])}\n"
                    f"Company context: {company_context[:200] if company_context else 'N/A'}\n"
                    f"From: {sender_name}, {sender_title}\n\n"
                    f"Write an EDUCATIONAL email on the theme: '{theme}'.\n"
                    f"Rules:\n"
                    f"- Subject: intriguing, educational, specific to {niche}. NOT 'following up'. Max 8 words.\n"
                    f"- Body: 80-100 words. Teach something genuinely valuable.\n"
                    f"- Include ONE specific industry stat or data point relevant to {niche}.\n"
                    f"- Reference {store_name} by name.\n"
                    f"- Soft CTA: book a discovery call.\n"
                    f"- Sound like a knowledgeable peer sharing insights, NOT a sales rep.\n"
                    f'Return ONLY JSON: {{"subject":"...","body":"..."}}',
                    300
                ) or fallback
                time.sleep(0.1)
            else:
                edu_subs = [
                    f"The {niche} stat you need to know",
                    f"Why {platform} {niche} stores plateau",
                    f"One thing top {niche} stores do differently",
                    f"The conversion lever {store_name} is missing",
                    f"What I've seen work for {niche} owners",
                    f"The {niche} benchmark worth knowing",
                    f"A {platform} insight for {niche} stores",
                    f"Your {niche} growth opportunity this quarter",
                ]
                content = {
                    "subject": edu_subs[(step_num - 2) % len(edu_subs)],
                    "body": (
                        f"Hi,\n\n"
                        f"Quick insight for {niche} store owners: stores on {platform} that focus on {top_issue_title.lower()} "
                        f"consistently outperform those that don't — often by 20-30% in conversion rate.\n\n"
                        f"Happy to share what this looks like specifically for {store_name}.\n\n"
                        f"Worth a 15-minute call?\n\n{sender_name}"
                    )
                }

            tid = str(uuid.uuid4())
            px  = f"{base_url}/track/open/{tid}"
            bh  = build_email(
                content.get("subject", ""), content.get("body", ""),
                sender_name, sender_title,
                f"{base_url}/unsubscribe/{token}", px, step_num,
                store_name=store_name, store_domain=domain, niche=niche,
                cal_link=cal_link, user_id=user_id
            )
            bt  = re.sub(r'<[^>]+>', ' ', bh).strip()
            sch = (datetime.now() + timedelta(days=day)).isoformat()
            seq_rows.append((lid, step_num, content.get("subject", ""), bh, bt, sch, tid))

        # ── 9. Save everything ────────────────────────────────────────────────
        c = db()
        c.execute("""UPDATE leads SET
            store_name=?, owner_email=?, email_confidence=?, platform=?,
            score=?, analysis=?, pitch=?, social_links=?,
            niche=?, status='ready', updated_at=?
            WHERE id=?""",
            (store_name, email, conf, platform, analysis["score"],
             json.dumps(analysis), json.dumps(pitch),
             json.dumps(social), niche, datetime.now().isoformat(), lid))
        if seq_rows:
            c.executemany(
                "INSERT OR IGNORE INTO email_sequence"
                "(lead_id,step,subject,body_html,body_text,scheduled_at,tracking_id,status)"
                " VALUES(?,?,?,?,?,?,?,'pending')",
                seq_rows
            )
        c.execute("INSERT OR IGNORE INTO scraped_domains VALUES(?,?,1)", (domain, now))
        c.commit(); c.close()
        return {"ok": True, "id": lid, "email": email, "score": analysis["score"]}

    except Exception as e:
        import traceback as _tb
        full_err = _tb.format_exc()
        short_err = str(e)[:500]
        _upd(lid, {"status": "error", "error": short_err + " | " + full_err[:300]})
        return {"error": short_err, "detail": full_err}


def _upd(lid, data):
    c = db()
    sets = ", ".join(f"{k}=?" for k in data)
    c.execute(f"UPDATE leads SET {sets}, updated_at=? WHERE id=?", list(data.values()) + [datetime.now().isoformat(), lid])
    c.commit(); c.close()


# ── Discovery (18+ sources) ───────────────────────────────────────────────────
def discover(query, limit, filters=None):
    """Multi-source store discovery with niche/platform/country filtering"""
    filters = filters or {}
    c = db()
    seen = {r[0] for r in c.execute("SELECT domain FROM scraped_domains").fetchall()}
    seen |= {re.sub(r'^https?://(www\.)?','',r[0]).split("/")[0]
             for r in c.execute("SELECT store_url FROM leads").fetchall()}
    c.close()

    q = query.lower()
    country_map = {
        "nigeria":"NG","ghana":"GH","kenya":"KE","south africa":"ZA","egypt":"EG",
        "ethiopia":"ET","uganda":"UG","tanzania":"TZ","senegal":"SN","cameroon":"CM",
        "ivory coast":"CI","zimbabwe":"ZW","zambia":"ZM","rwanda":"RW","mozambique":"MZ",
        "usa":"US","united states":"US","uk":"GB","britain":"GB","england":"GB",
        "canada":"CA","australia":"AU","india":"IN","germany":"DE","france":"FR",
        "netherlands":"NL","spain":"ES","italy":"IT","brazil":"BR","mexico":"MX",
        "uae":"AE","dubai":"AE","singapore":"SG","malaysia":"MY","philippines":"PH",
        "indonesia":"ID","thailand":"TH","pakistan":"PK","bangladesh":"BD",
        "saudi arabia":"SA","turkey":"TR","japan":"JP","china":"CN","south korea":"KR",
        "vietnam":"VN","poland":"PL","sweden":"SE","norway":"NO","denmark":"DK",
        "finland":"FI","belgium":"BE","austria":"AT","switzerland":"CH",
        "ireland":"IE","portugal":"PT","new zealand":"NZ","argentina":"AR",
        "colombia":"CO","chile":"CL","peru":"PE","czech republic":"CZ",
        "hungary":"HU","romania":"RO","greece":"GR","ukraine":"UA","russia":"RU",
    }
    plat_map = {
        "shopify":"Shopify","woocommerce":"WooCommerce","bigcommerce":"BigCommerce",
        "wix":"Wix","magento":"Magento","prestashop":"PrestaShop",
        "opencart":"OpenCart","ecwid":"Ecwid","squarespace":"Squarespace",
        "wordpress":"WordPress","shopware":"Shopware","weebly":"Weebly",
        "shift4shop":"Shift4Shop","volusion":"Volusion","bigcartel":"Big Cartel",
    }
    fp   = filters.get("platform","")
    plat = fp if (fp and fp not in ("","Any")) else \
           next((v for k,v in plat_map.items() if k in q), "Shopify")
    fc   = filters.get("country","")
    ctry = next((v for k,v in country_map.items() if k in fc.lower()),"") if fc else \
           next((v for k,v in country_map.items() if k in q),"")
    fn   = filters.get("niche","")
    skip = {"stores","store","shop","ecommerce","online","the","and","or","for","with","any"}
    niche_words = [w for w in q.split() if len(w)>2 and w not in skip]
    niche = fn or " ".join(niche_words[:3])
    city  = filters.get("city","")
    language = filters.get("language","")
    currency = filters.get("currency","")
    fetch_limit = limit * 6
    stores = []

    # Niche-specific keywords for search queries
    niche_kws = {
        "Fashion & Apparel":  ["dress","clothing","fashion","apparel","outfit","wear"],
        "Beauty & Cosmetics": ["makeup","skincare","cosmetics","beauty","serum","lipstick"],
        "Health & Wellness":  ["supplement","vitamin","wellness","health","detox","organic"],
        "Fitness":            ["gym","workout","fitness","training","yoga","sport"],
        "Food & Beverage":    ["food","snack","coffee","tea","organic","gourmet"],
        "Electronics & Tech": ["electronics","gadget","phone","laptop","tech","device"],
        "Home & Garden":      ["furniture","home","decor","garden","interior","bedding"],
        "Pet Products":       ["pet","dog","cat","puppy","kitten","animal"],
        "Baby & Kids":        ["baby","kids","child","toy","infant","nursery"],
        "Jewelry & Accessories": ["jewelry","necklace","ring","bracelet","watch","bag"],
        "Automotive":         ["car","vehicle","auto","motorcycle","tyre","parts"],
        "African Fashion":    ["ankara","dashiki","kente","african print","afrocentric"],
    }
    search_kws = niche_kws.get(niche, niche_words[:3]) if niche else niche_words[:3]
    kw = " ".join(search_kws[:2]) if search_kws else niche

    BAD_DOMAINS = {
        "linkedin.com","facebook.com","google.com","twitter.com","instagram.com",
        "amazon.com","ebay.com","youtube.com","wikipedia.org","cloudflare.com",
        "shopify.com","wordpress.com","wixsite.com","squarespace.com","bigcommerce.com",
        "myip.ms","builtwith.com","similarweb.com","duckduckgo.com","bing.com",
        "yahoo.com","pinterest.com","tiktok.com","reddit.com","github.com",
        "trustpilot.com","clutch.co","wappalyzer.com","w3.org","schema.org",
        "paypal.com","stripe.com","googletagmanager.com","aliexpress.com","etsy.com",
    }

    def add(domain, src_name):
        domain = domain.strip("/").lower().replace("www.","")
        if not domain or "." not in domain or len(domain)<4 or len(domain)>60: return
        if any(b in domain for b in BAD_DOMAINS): return
        if not re.match(r'^[a-zA-Z0-9.\-]+$', domain): return
        if domain in seen: return
        seen.add(domain)
        stores.append({"url":f"https://www.{domain}","platform":plat,"country":ctry or "Unknown","source":src_name})

    # Source 1: myip.ms — best source, randomize page ranges to avoid same results
    base = f"country/{ctry}/tech/{plat}" if ctry else f"tech/{plat}"
    sorts = ["","/sort/3/asc/0","/sort/3/asc/1","/sort/2/asc/0","/sort/2/asc/1","/sort/1/asc/0",
             "/sort/3/desc/0","/sort/2/desc/0","/sort/1/desc/0","/sort/1/asc/1","/sort/2/asc/2"]
    # Randomize starting page to get different results each time
    start_page = _rand.randint(1, 40)
    pages_to_check = list(range(start_page, start_page + 30))
    _rand.shuffle(sorts)
    for page in pages_to_check:
        if len(stores) >= fetch_limit: break
        for sort in sorts[:5]:
            if len(stores) >= fetch_limit: break
            myip_url = f"https://myip.ms/browse/sites/{page}/ipIDii/255255255255/{base}{sort}"
            html = http_get(myip_url, timeout=12)
            if html:
                # Multiple extraction patterns
                for d in re.findall(r'href="https://myip\.ms/info/whois/([^"/?#]+)"', html): add(d,"myip")
                for d in re.findall(r'"domain"\s*:\s*"([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})"', html): add(d,"myip")
                for d in re.findall(r'<td[^>]*>([a-zA-Z0-9][\w\-]+\.[a-zA-Z]{2,})</td>', html): add(d,"myip")
                for d in re.findall(r'>([a-zA-Z0-9][\w\-]+\.(?:com|co\.uk|org|net|store|shop|io))</', html): add(d,"myip")
            time.sleep(0.3)

    # Source 2-12: DuckDuckGo with diverse niche-specific queries
    loc = city or (ctry.lower() if ctry else "")
    ddg_qs = []
    if kw and loc:
        ddg_qs += [
            f"{kw} {plat.lower()} store {loc} email contact",
            f"site:myshopify.com {kw} {loc}",
            f"{plat.lower()} {kw} shop {loc} contact us email",
            f"buy {kw} online {loc} {plat.lower()} store",
        ]
    if kw:
        ddg_qs += [
            f"{kw} ecommerce store {plat.lower()} email contact",
            f"best {kw} stores {plat.lower()} contact email",
            f"{kw} online boutique {plat.lower()} buy now",
            f"top {kw} {plat.lower()} shops email",
            f"shop {kw} {plat.lower()} contact@",
        ]
    if loc:
        ddg_qs += [
            f"{plat.lower()} ecommerce {loc} contact email shop",
            f"online store {loc} {plat.lower()} buy contact",
            f"{plat.lower()} {loc} shop email contact us",
        ]
    if language:
        ddg_qs.append(f"{kw or plat.lower()} store {language.lower()} contact email")
    if currency:
        ddg_qs.append(f"{kw or plat.lower()} store prices {currency} contact")
    ddg_qs += [
        f"{plat.lower()} ecommerce store email contact us",
        f"site:myshopify.com {kw or 'fashion'} {city}",
        f"inurl:collections {kw} {ctry.lower() if ctry else ''}",
        f"online shop {kw} {plat.lower()} contact@",
        f"{plat.lower()} boutique {kw} email buy",
    ]
    for sq in ddg_qs[:14]:
        if len(stores) >= fetch_limit: break
        html = http_get(f"https://html.duckduckgo.com/html/?q={sq.replace(' ','+')}", timeout=10)
        if html:
            for d in re.findall(r'<a[^>]+href="https?://([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})[^"]*"', html): add(d,"ddg")
        time.sleep(1.0)

    # Source 13-15: Bing
    bing_qs = [
        f"{plat} {kw} ecommerce {ctry.lower() if ctry else ''} contact email",
        f"site:.myshopify.com {kw} {ctry.lower() if ctry else ''}",
        f"{plat} store {kw} {city} online buy contact",
        f"inurl:contact {kw} {plat.lower()} store email",
    ]
    for sq in bing_qs[:3]:
        if len(stores) >= fetch_limit: break
        html = http_get(f"https://www.bing.com/search?q={sq.replace(' ','+')}", timeout=10)
        if html:
            for d in re.findall(r'<cite[^>]*>(?:https?://)?([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', html): add(d,"bing")
        time.sleep(1.2)

    # Source 16: Trustpilot
    tp_cats = {
        "Fashion & Apparel":  ["fashion_clothing","clothes_fashion"],
        "Beauty & Cosmetics": ["beauty_wellbeing","health_beauty"],
        "Health & Wellness":  ["health_medical","vitamins_supplements"],
        "Food & Beverage":    ["food_beverage","online_grocery"],
        "Electronics & Tech": ["electronics_technology","computers_software"],
        "Home & Garden":      ["home_garden","furniture_decor"],
        "Pet Products":       ["pets_animals"],
        "Baby & Kids":        ["child_care","toys_games"],
        "Jewelry & Accessories": ["jewelry_accessories"],
        "Sports":             ["sports"],
    }.get(niche, ["online_shopping_money","fashion_clothing","beauty_wellbeing"])
    for cat in tp_cats[:3]:
        if len(stores) >= fetch_limit: break
        html = http_get(f"https://www.trustpilot.com/categories/{cat}", timeout=10)
        if html:
            for d in re.findall(r'href="/review/([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})"', html): add(d,"trustpilot")
        time.sleep(0.4)

    # Source 17: BuiltWith
    for bw_url in [f"https://trends.builtwith.com/shop/{plat}", f"https://trends.builtwith.com/shop/{plat.lower()}"]:
        if len(stores) >= fetch_limit: break
        html = http_get(bw_url, timeout=10)
        if html:
            for d in re.findall(r'href="https?://([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})[/"]', html): add(d,"builtwith")

    # Source 18: Yahoo
    if len(stores) < fetch_limit:
        html = http_get(f"https://search.yahoo.com/search?p={plat}+{kw}+{ctry.lower() if ctry else ''}+store+email", timeout=10)
        if html:
            for d in re.findall(r'<span class="url[^"]*">([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', html): add(d,"yahoo")

    # Fallback curated niche stores
    if len(stores) < 5:
        fallback_by_niche = {
            "Fashion & Apparel":  ["fashionnova.com","gymshark.com","rebdolls.com","fashionbunker.com","zarnesh.com"],
            "Beauty & Cosmetics": ["colourpop.com","bperfectcosmetics.com","absolutecosmetics.co.uk","adorebeauty.com.au"],
            "Health & Wellness":  ["bulkpowders.com","hollandandbarrett.com","myprotein.com","iherb.com"],
            "Food & Beverage":    ["deathwishcoffee.com","mountainroseherbs.com","goldenstatepickle.com"],
            "Pet Products":       ["chewy.com","petco.com","barkbox.com","petflow.com"],
            "Jewelry & Accessories": ["mejuri.com","missoma.com","catbirdnyc.com","aurate.com"],
            "Home & Garden":      ["brooklinen.com","parachutehome.com","urbanoutfitters.com"],
        }
        fb = fallback_by_niche.get(niche, ["fashionnova.com","gymshark.com","allbirds.com",
            "bombas.com","colourpop.com","mvmtwatches.com","tentree.com","beardbrand.com"])
        for d in fb:
            if d not in seen: seen.add(d); stores.append({"url":f"https://www.{d}","platform":plat,"country":"US","source":"fallback"})

    # Shuffle to get different results each run, then return up to limit
    _rand.shuffle(stores)
    return stores[:fetch_limit]


# ── Thread pool & job tracker ─────────────────────────────────────────────────
_pool = concurrent.futures.ThreadPoolExecutor(max_workers=16)
_jobs = {}  # job_id -> {status, found, total}


def _scrape_job(jid, query, limit, campaign, filters):
    _jobs[jid] = {"status": "running", "found": 0, "total": limit}
    try:
        stores = discover(query, limit, filters)
        ok = 0
        sem = threading.Semaphore(3)
        def one(store):
            nonlocal ok
            with sem:
                r = process(store["url"], campaign)
                if r.get("ok"): ok += 1
                _jobs[jid]["found"] = ok
        futs = [_pool.submit(one, s) for s in stores]
        concurrent.futures.wait(futs)
        _jobs[jid]["status"] = "done"
    except Exception as e:
        _jobs[jid] = {"status": "error", "error": str(e)}


def _scheduler():
    """Send pending sequence emails every 5 minutes — runs even when browser is closed"""
    time.sleep(60)
    while True:
        try:
            c = db(); now = datetime.now().isoformat()
            due = c.execute("""
                SELECT es.*, l.owner_email, l.unsubscribe_token,
                       l.store_name, l.status as ls, l.user_id as lead_user_id
                FROM email_sequence es
                JOIN leads l ON es.lead_id = l.id
                WHERE es.status='pending' AND es.scheduled_at <= ?
                  AND l.owner_email != ''
                  AND l.status NOT IN ('unsubscribed','replied','converted','skip')
                ORDER BY es.scheduled_at LIMIT 8
            """, (now,)).fetchall()
            c.close()
            for seq in due:
                try:
                    bt  = re.sub(r'<[^>]+>', ' ', seq["body_html"] or "").strip()
                    send_smtp(seq["owner_email"], seq["subject"],
                              seq["body_html"] or "", bt,
                              seq["unsubscribe_token"] or "", seq["store_name"] or "",
                              user_id=seq.get("lead_user_id", 0))
                    ts = datetime.now().isoformat()
                    c = db()
                    c.execute("UPDATE email_sequence SET status='sent',sent_at=? WHERE id=?", (ts, seq["id"]))
                    c.execute("INSERT INTO email_log(lead_id,sequence_id,event,detail,created_at) VALUES(?,?,?,?,?)",
                        (seq["lead_id"], seq["id"], "sent", f"Auto step {seq['step']} to {seq['owner_email']}", ts))
                    c.commit(); c.close()
                    time.sleep(3)
                except Exception as e:
                    c = db()
                    c.execute("UPDATE email_sequence SET status='error' WHERE id=?", (seq["id"],))
                    c.execute("INSERT INTO email_log(lead_id,event,detail,created_at) VALUES(?,?,?,?)",
                        (seq["lead_id"], "error", str(e), datetime.now().isoformat()))
                    c.commit(); c.close()
        except: pass
        time.sleep(300)


def _inbox():
    """Poll Gmail for replies every 15 minutes"""
    time.sleep(90)
    while True:
        try:
            gmail = cfg("gmail_address"); pwd = cfg("gmail_app_password")
            if gmail and pwd:
                m = imaplib.IMAP4_SSL("imap.gmail.com", 993)
                m.login(gmail, pwd)
                m.select("INBOX")
                since = (datetime.now() - timedelta(days=7)).strftime("%d-%b-%Y")
                _, ids = m.search(None, f'(SINCE "{since}")')
                if ids[0]:
                    c = db()
                    known = {r[0] for r in c.execute("SELECT gmail_msg_id FROM inbox_replies").fetchall()}
                    le    = {r[0].lower(): r[1] for r in c.execute("SELECT owner_email, id FROM leads WHERE owner_email != ''").fetchall()}
                    for mid in ids[0].split()[-60:]:
                        try:
                            uid = mid.decode()
                            if uid in known: continue
                            _, md = m.fetch(mid, "(RFC822)")
                            em  = message_from_bytes(md[0][1])
                            fh  = em.get("From", ""); sub = em.get("Subject", ""); dt = em.get("Date", "")
                            fm  = re.search(r'[\w.\-+]+@[\w.\-]+\.[a-zA-Z]{2,}', fh)
                            fe  = fm.group(0).lower() if fm else ""
                            if not fe or fe == gmail.lower(): continue
                            body = ""
                            if em.is_multipart():
                                for part in em.walk():
                                    if part.get_content_type() == "text/plain":
                                        try: body = part.get_payload(decode=True).decode("utf-8", "ignore")[:2000]; break
                                        except: pass
                            else:
                                try: body = em.get_payload(decode=True).decode("utf-8", "ignore")[:2000]
                                except: pass
                            lid = le.get(fe)
                            c.execute("INSERT OR IGNORE INTO inbox_replies(lead_id,gmail_msg_id,from_email,subject,body,received_at) VALUES(?,?,?,?,?,?)",
                                (lid, uid, fe, sub, body, dt))
                            if lid:
                                c.execute("UPDATE leads SET reply_received=1,reply_content=?,status='replied',updated_at=? WHERE id=?",
                                    (body[:500], datetime.now().isoformat(), lid))
                                c.execute("UPDATE email_sequence SET status='cancelled' WHERE lead_id=? AND status='pending'", (lid,))
                        except: continue
                    c.commit(); c.close()
                m.close(); m.logout()
        except: pass
        time.sleep(900)


threading.Thread(target=_scheduler, daemon=True).start()
threading.Thread(target=_inbox,     daemon=True).start()


# ── HTTP handler ──────────────────────────────────────────────────────────────
MIME = {
    ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
    ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
    ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
}
DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def get_user(self):
        """Extract verified user from JWT in Authorization header"""
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            data = verify_jwt(auth[7:])
            if data:
                return {"id": int(data["sub"]), "email": data["email"], "name": data["name"]}
        return None

    def require_user(self):
        """Return user or send 401"""
        u = self.get_user()
        if not u:
            self.j({"error": "Authentication required"}, 401)
        return u

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization")

    def j(self, data, code=200):
        b = json.dumps(data).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.cors(); self.end_headers(); self.wfile.write(b)

    def html(self, s, code=200):
        b = s.encode() if isinstance(s, str) else s
        self.send_response(code); self.send_header("Content-Type", "text/html;charset=utf-8")
        self.send_header("Content-Length", str(len(b))); self.cors(); self.end_headers(); self.wfile.write(b)

    def blob(self, data, ct, fname=None):
        self.send_response(200); self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(data)))
        if fname: self.send_header("Content-Disposition", f'attachment;filename="{fname}"')
        self.cors(); self.end_headers(); self.wfile.write(data)

    def static(self, fp):
        ext = os.path.splitext(fp)[1].lower()
        try:
            with open(fp, "rb") as f: d = f.read()
            self.send_response(200)
            self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
            self.send_header("Content-Length", str(len(d)))
            self.send_header("Cache-Control", "max-age=86400")
            self.end_headers(); self.wfile.write(d)
        except: self.html("Not found", 404)

    def body(self):
        n = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(n).decode() if n else ""

    def jbody(self):
        try: return json.loads(self.body())
        except: return {}

    def do_OPTIONS(self):
        self.send_response(200); self.cors(); self.end_headers()

    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        p = urlparse(self.path); path = p.path; qs = parse_qs(p.query)

        # Google OAuth — initiate
        if path == "/api/auth/google":
            gid = cfg("google_client_id") or GOOGLE_CLIENT_ID
            if not gid:
                self.html("<h2>Google OAuth not configured. Add GOOGLE_CLIENT_ID to Settings.</h2>", 400); return
            url = google_oauth_url()
            self.send_response(302); self.send_header("Location", url); self.cors(); self.end_headers(); return

        # Google OAuth — callback
        if path == "/api/auth/google/callback":
            code = qs.get("code", [""])[0]
            if not code:
                self.html("<h2>OAuth error: no code received</h2>", 400); return
            tokens = google_exchange_code(code)
            if not tokens.get("access_token"):
                self.html(f"<h2>OAuth error: {tokens.get('error_description','failed to get token')}</h2>", 400); return
            info = google_get_userinfo(tokens["access_token"])
            if not info.get("email"):
                self.html("<h2>OAuth error: could not get user email</h2>", 400); return
            uid = get_or_create_user(info.get("id",""), info["email"], info.get("name",""), info.get("picture",""))
            jwt = generate_jwt(uid, info["email"], info.get("name",""))
            base = cfg("base_url", "http://localhost:8000")
            # In dev, frontend runs on :5173; detect and redirect appropriately
            fe_url = base.replace(":8000", ":5173") if ":8000" in base else base
            redir = f"{fe_url}/?token={jwt}"
            self.send_response(302); self.send_header("Location", redir); self.cors(); self.end_headers(); return

        # Auth me — verify token and return user info
        if path == "/api/auth/me":
            u = self.get_user()
            if not u: self.j({"error": "Not authenticated"}, 401); return
            c = db()
            row = c.execute("SELECT * FROM users WHERE id=?", (u["id"],)).fetchone(); c.close()
            if not row: self.j({"error": "User not found"}, 404); return
            self.j({"id": u["id"], "email": row["email"], "name": row["name"], "avatar_url": row["avatar_url"]}); return

        # Tracking pixel
        m = re.match(r'^/track/open/([a-f0-9\-]+)$', path)
        if m:
            tid = m.group(1); c = db()
            seq = c.execute("SELECT * FROM email_sequence WHERE tracking_id=?", (tid,)).fetchone()
            if seq:
                now = datetime.now().isoformat()
                c.execute("UPDATE email_sequence SET open_count=open_count+1,opened_at=COALESCE(opened_at,?) WHERE tracking_id=?", (now, tid))
                c.execute("INSERT INTO email_log(lead_id,sequence_id,event,detail,created_at) VALUES(?,?,?,?,?)",
                    (seq["lead_id"], seq["id"], "opened", f"Step {seq['step']}", now))
                c.commit()
            c.close()
            gif = bytes.fromhex("47494638396101000100800000ffffff00000021f90400000000002c00000000010001000002024401003b")
            self.blob(gif, "image/gif"); return

        # Unsubscribe
        m = re.match(r'^/unsubscribe/([a-f0-9\-]+)$', path)
        if m:
            tok = m.group(1); c = db()
            lead = c.execute("SELECT id FROM leads WHERE unsubscribe_token=?", (tok,)).fetchone()
            if lead:
                now = datetime.now().isoformat()
                c.execute("UPDATE leads SET status='unsubscribed',updated_at=? WHERE unsubscribe_token=?", (now, tok))
                c.execute("UPDATE email_sequence SET status='cancelled' WHERE lead_id=? AND status='pending'", (lead["id"],))
                c.commit()
            c.close()
            self.html("<html><body style='font-family:sans-serif;padding:40px;max-width:500px;margin:auto'><h2>Unsubscribed ✓</h2><p style='color:#666'>You have been removed. No further emails will be sent.</p></body></html>"); return

        # Settings GET
        if path == "/api/settings":
            c = db(); rows = c.execute("SELECT key,value FROM settings").fetchall(); c.close()
            r = {x["key"]: x["value"] for x in rows}
            for k in ("anthropic_key", "gmail_app_password"):
                if r.get(k): v = r[k]; r[k] = v[:6] + "***" + v[-3:] if len(v) > 9 else "***"
            self.j(r); return

        # Leads list
        if path == "/api/leads":
            c = db()
            q = "SELECT id,store_url,store_name,owner_email,email_confidence,platform,country,niche,status,score,campaign,notes,created_at,updated_at,last_emailed,reply_received,tags,pitch FROM leads"
            params, conds = [], []
            sf   = qs.get("status",   [""])[0]
            srch = qs.get("search",   [""])[0]
            cf   = qs.get("campaign", [""])[0]
            if sf and sf != "all": conds.append("status=?"); params.append(sf)
            if srch:
                conds.append("(store_url LIKE ? OR store_name LIKE ? OR owner_email LIKE ? OR campaign LIKE ? OR niche LIKE ?)")
                params += [f"%{srch}%"] * 5
            if cf: conds.append("campaign=?"); params.append(cf)
            if conds: q += " WHERE " + " AND ".join(conds)
            q += " ORDER BY id DESC"
            rows = c.execute(q, params).fetchall(); c.close()
            out = []
            for row in rows:
                d = dict(row)
                for f in ("pitch", "tags"):
                    if d.get(f):
                        try: d[f] = json.loads(d[f])
                        except: pass
                out.append(d)
            self.j(out); return

        # Single lead
        m = re.match(r'^/api/leads/(\d+)$', path)
        if m:
            lid = int(m.group(1)); c = db()
            row = c.execute("SELECT * FROM leads WHERE id=?", (lid,)).fetchone(); c.close()
            if not row: self.j({"error": "not found"}, 404); return
            d = dict(row); d.pop("report_html", None)
            for f in ("analysis", "pitch", "social_links", "tags"):
                if d.get(f):
                    try: d[f] = json.loads(d[f])
                    except: pass
            self.j(d); return

        # Sequences
        m = re.match(r'^/api/sequences/(\d+)$', path)
        if m:
            lid = int(m.group(1)); c = db()
            rows = c.execute("SELECT id,step,subject,status,scheduled_at,sent_at,open_count,opened_at FROM email_sequence WHERE lead_id=? ORDER BY step", (lid,)).fetchall()
            c.close(); self.j([dict(r) for r in rows]); return

        # Sequence HTML preview
        m = re.match(r'^/api/sequence-html/(\d+)$', path)
        if m:
            sid = int(m.group(1)); c = db()
            row = c.execute("SELECT body_html FROM email_sequence WHERE id=?", (sid,)).fetchone(); c.close()
            self.html(row["body_html"] if row else "<p>Not found</p>"); return

        # Report HTML view
        m = re.match(r'^/api/report/html/(\d+)$', path)
        if m:
            lid = int(m.group(1)); c = db()
            row = c.execute("SELECT report_html, store_name FROM leads WHERE id=?", (lid,)).fetchone(); c.close()
            if not row or not row["report_html"]: self.html("<h2>Report not ready yet. Please wait a moment and refresh.</h2>"); return
            self.html(row["report_html"]); return

        # Stats

        if path == "/api/settings/check":
            user = self.get_user()
            uid  = user["id"] if user else 0
            status = {}
            # Check per-user settings first, then global
            for k in ("anthropic_key","gmail_address","gmail_app_password","sender_name","sender_title","base_url","avatar_url","calendar_link","google_client_id","google_client_secret"):
                v = ucfg(uid, k) if uid else cfg(k)
                if k == "anthropic_key":
                    status["anthropic_key"] = "ok" if v and v.startswith("sk-") and len(v) > 20 else "invalid"
                elif k == "gmail_app_password":
                    status["gmail_app_password"] = "saved" if v and len(v) >= 16 else "missing"
                elif k == "google_client_id":
                    status["google_client_id"] = "ok" if v and len(v) > 10 else "missing"
                else:
                    status[k] = v or ""
            status["google_oauth_enabled"] = bool(cfg("google_client_id") or GOOGLE_CLIENT_ID)
            self.j(status); return

        if path == "/api/test-ai":
            key = cfg("anthropic_key")
            if not key:
                self.j({"error": "No API key in database. Go to Settings and paste your key.", "key_found": False}); return
            if "***" in key:
                self.j({"error": "API key appears masked — re-enter the full key in Settings.", "key_found": True, "key_preview": key[:8]}); return
            # Actually test the API
            print(f"[TEST-AI] Testing key: {key[:12]}... (length={len(key)})")
            status, data = http_post("https://api.anthropic.com/v1/messages",
                {"model":"claude-haiku-4-5-20251001","max_tokens":50,
                 "messages":[{"role":"user","content":"Say 'API key works' in 3 words."}]},
                hdrs={"x-api-key":key,"anthropic-version":"2023-06-01"})
            if status == 200 and data.get("content"):
                reply = data["content"][0]["text"].strip()
                self.j({"ok": True, "message": f"API key works! Claude replied: {reply}", "key_preview": key[:12] + "...", "status": status}); return
            else:
                err_msg = data.get("error", {}).get("message", "") if isinstance(data.get("error"), dict) else str(data.get("error", "Unknown error"))
                self.j({"error": f"API returned status {status}: {err_msg}", "key_preview": key[:12] + "...", "status": status, "raw": str(data)[:300]}); return

        if path == "/api/stats":
            c = db()
            def cnt(q, p=()):
                r = c.execute(q, p).fetchone(); return r[0] if r else 0
            data = {
                "total":   cnt("SELECT COUNT(*) FROM leads"),
                "with_email": cnt("SELECT COUNT(*) FROM leads WHERE owner_email != ''"),
                "ready":   cnt("SELECT COUNT(*) FROM leads WHERE status='ready'"),
                "contacted": cnt("SELECT COUNT(*) FROM leads WHERE status='contacted'"),
                "replied": cnt("SELECT COUNT(*) FROM leads WHERE status='replied' OR reply_received=1"),
                "converted": cnt("SELECT COUNT(*) FROM leads WHERE status='converted'"),
                "emails_sent":   cnt("SELECT COUNT(*) FROM email_sequence WHERE status='sent'"),
                "emails_opened": cnt("SELECT COUNT(*) FROM email_sequence WHERE open_count > 0"),
                "emails_pending": cnt("SELECT COUNT(*) FROM email_sequence WHERE status='pending'"),
                "new_replies": cnt("SELECT COUNT(*) FROM inbox_replies WHERE is_read=0"),
                "reports_generated": cnt("SELECT COUNT(*) FROM leads WHERE report_html != ''"),
                "recent_activity": [dict(r) for r in c.execute("SELECT * FROM email_log ORDER BY id DESC LIMIT 20").fetchall()],
            }
            data["open_rate"] = round(data["emails_opened"] / data["emails_sent"] * 100, 1) if data["emails_sent"] > 0 else 0
            c.close(); self.j(data); return

        # Campaigns
        if path == "/api/campaigns":
            c = db()
            rows = c.execute("SELECT campaign, COUNT(*) as count, SUM(CASE WHEN owner_email!='' THEN 1 ELSE 0 END) as with_email FROM leads WHERE campaign != '' GROUP BY campaign ORDER BY count DESC").fetchall()
            c.close(); self.j([dict(r) for r in rows]); return

        # Inbox
        if path == "/api/inbox":
            unread = qs.get("unread_only", ["false"])[0] == "true"
            c = db()
            q = "SELECT ir.*, l.store_name, l.store_url FROM inbox_replies ir LEFT JOIN leads l ON ir.lead_id = l.id"
            if unread: q += " WHERE ir.is_read = 0"
            q += " ORDER BY ir.id DESC LIMIT 100"
            rows = c.execute(q).fetchall(); c.close()
            self.j([dict(r) for r in rows]); return

        # CSV export
        if path == "/api/export-csv":
            c = db()
            rows = c.execute("SELECT store_url,store_name,owner_email,email_confidence,platform,country,status,score,campaign,niche,notes,created_at,last_emailed,reply_received FROM leads WHERE owner_email != '' ORDER BY email_confidence DESC, id DESC").fetchall()
            c.close()
            out = io.StringIO(); w = csv.writer(out)
            w.writerow(["URL","Store Name","Email","Confidence%","Platform","Country","Status","Score","Campaign","Niche","Notes","Added","Last Emailed","Got Reply"])
            for row in rows: w.writerow(list(row))
            self.blob(out.getvalue().encode(), "text/csv", "leadforge-export.csv"); return

        # Analytics
        if path == "/api/analytics/overview":
            c = db()
            def cnt(q, p=()):
                r = c.execute(q, p).fetchone(); return r[0] if r else 0
            self.j({
                "leads":    {"total": cnt("SELECT COUNT(*) FROM leads"), "with_email": cnt("SELECT COUNT(*) FROM leads WHERE owner_email!=''"), "ready": cnt("SELECT COUNT(*) FROM leads WHERE status='ready'"), "avg_score": c.execute("SELECT ROUND(AVG(score),1) FROM leads WHERE score>0").fetchone()[0] or 0},
                "pipeline": {"new": max(0, cnt("SELECT COUNT(*) FROM leads") - cnt("SELECT COUNT(*) FROM leads WHERE status='contacted'") - cnt("SELECT COUNT(*) FROM leads WHERE status='replied' OR reply_received=1") - cnt("SELECT COUNT(*) FROM leads WHERE status='converted'")), "contacted": cnt("SELECT COUNT(*) FROM leads WHERE status='contacted'"), "replied": cnt("SELECT COUNT(*) FROM leads WHERE status='replied' OR reply_received=1"), "converted": cnt("SELECT COUNT(*) FROM leads WHERE status='converted'"), "unsubscribed": cnt("SELECT COUNT(*) FROM leads WHERE status='unsubscribed'")},
                "emails":   {"sent": cnt("SELECT COUNT(*) FROM email_sequence WHERE status='sent'"), "opened": cnt("SELECT COUNT(*) FROM email_sequence WHERE open_count>0"), "pending": cnt("SELECT COUNT(*) FROM email_sequence WHERE status='pending'")},
                "rates":    {"open_rate": round(cnt("SELECT COUNT(*) FROM email_sequence WHERE open_count>0") / cnt("SELECT COUNT(*) FROM email_sequence WHERE status='sent'") * 100, 1) if cnt("SELECT COUNT(*) FROM email_sequence WHERE status='sent'") > 0 else 0, "reply_rate": round(cnt("SELECT COUNT(*) FROM leads WHERE status='replied' OR reply_received=1") / cnt("SELECT COUNT(*) FROM leads WHERE status='contacted'") * 100, 1) if cnt("SELECT COUNT(*) FROM leads WHERE status='contacted'") > 0 else 0},
                "inbox":    {"new_replies": cnt("SELECT COUNT(*) FROM inbox_replies WHERE is_read=0")},
            })
            c.close(); return

        if path == "/api/analytics/campaigns":
            c = db()
            rows = c.execute("SELECT campaign, COUNT(*) as total, SUM(CASE WHEN owner_email!='' THEN 1 ELSE 0 END) as with_email, SUM(CASE WHEN status='replied' OR reply_received=1 THEN 1 ELSE 0 END) as replied, SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) as converted, ROUND(AVG(score),1) as avg_score FROM leads WHERE campaign!='' GROUP BY campaign ORDER BY total DESC").fetchall()
            c.close(); self.j([dict(r) for r in rows]); return

        if path == "/api/analytics/sequence-performance":
            c = db()
            rows = c.execute("SELECT step, COUNT(*) as total, SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent, SUM(CASE WHEN open_count>0 THEN 1 ELSE 0 END) as opened, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending FROM email_sequence GROUP BY step ORDER BY step").fetchall()
            c.close()
            result = [{**dict(r), "open_rate": round(dict(r)["opened"] / dict(r)["sent"] * 100, 1) if dict(r)["sent"] > 0 else 0} for r in rows]
            self.j(result); return

        if path == "/api/analytics/scheduled":
            c = db(); now = datetime.now().isoformat(); to = (datetime.now() + timedelta(days=30)).isoformat()
            rows = c.execute("SELECT es.step, es.subject, es.scheduled_at, l.store_name, l.owner_email, l.campaign FROM email_sequence es JOIN leads l ON es.lead_id=l.id WHERE es.status='pending' AND es.scheduled_at BETWEEN ? AND ? AND l.owner_email!='' ORDER BY es.scheduled_at LIMIT 100", (now, to)).fetchall()
            c.close(); self.j([dict(r) for r in rows]); return

        if path == "/api/analytics/top-leads":
            c = db()
            rows = c.execute("SELECT id,store_url,store_name,owner_email,platform,country,score,email_confidence,status,campaign,niche FROM leads WHERE owner_email!='' AND score>0 ORDER BY score DESC, email_confidence DESC LIMIT 20").fetchall()
            c.close(); self.j([dict(r) for r in rows]); return

        if path.startswith("/api/analytics/export/"):
            ds = path.split("/")[-1]; c = db(); out = io.StringIO(); w = csv.writer(out)
            if ds == "all-leads":
                w.writerow(["ID","URL","Store","Email","Conf","Platform","Country","Status","Score","Campaign","Niche"])
                for r in c.execute("SELECT id,store_url,store_name,owner_email,email_confidence,platform,country,status,score,campaign,niche FROM leads ORDER BY id DESC").fetchall(): w.writerow(list(r))
            elif ds == "email-stats":
                w.writerow(["Store","Email","Step","Subject","Status","Sent","Opens"])
                for r in c.execute("SELECT l.store_name,l.owner_email,es.step,es.subject,es.status,es.sent_at,es.open_count FROM email_sequence es JOIN leads l ON es.lead_id=l.id ORDER BY es.id DESC").fetchall(): w.writerow(list(r))
            elif ds == "replies":
                w.writerow(["From","Subject","Store","Received","Body"])
                for r in c.execute("SELECT ir.from_email,ir.subject,l.store_name,ir.received_at,ir.body FROM inbox_replies ir LEFT JOIN leads l ON ir.lead_id=l.id ORDER BY ir.id DESC").fetchall(): w.writerow(list(r))
            c.close(); self.blob(out.getvalue().encode(), "text/csv", f"leadforge-{ds}.csv"); return

        # Static files
        if path.startswith("/assets/"):
            fp = os.path.join(DIST, path.lstrip("/").replace("/", os.sep))
            if os.path.isfile(fp): self.static(fp)
            else: self.html("Not found", 404)
            return

        # SPA fallback
        idx = os.path.join(DIST, "index.html")
        if os.path.isfile(idx):
            self.static(idx)
        else:
            self.html("""<!DOCTYPE html><html><head><title>LeadForge v3</title>
<style>body{font-family:sans-serif;background:#09090b;color:#e4e4e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.b{background:#111;border:1px solid #333;border-radius:12px;padding:40px;max-width:480px;text-align:center}
h1{color:#c8f135;font-size:22px;margin:0 0 10px}p{color:#71717a;line-height:1.7}
code{background:#1c1c1f;color:#c8f135;padding:8px 14px;border-radius:6px;display:block;margin:12px 0;font-size:13px;text-align:left}
</style></head><body><div class="b"><h1>⚡ LeadForge v3</h1>
<p>Server running! Build the frontend:</p>
<code>cd frontend\nnpm install\nnpm run build</code>
<p>Or double-click <strong>fix.bat</strong></p></div></body></html>""")

    def do_POST(self):
        from urllib.parse import urlparse
        path = urlparse(self.path).path

        if path == "/api/settings":
            d = self.jbody()
            user = self.get_user()
            mapping = {
                "anthropic_api_key": "anthropic_key",
                "gmail_address": "gmail_address",
                "gmail_app_password": "gmail_app_password",
                "sender_name": "sender_name",
                "sender_title": "sender_title",
                "base_url": "base_url",
                "avatar_url": "avatar_url",
                "calendar_link": "calendar_link",
                "google_client_id": "google_client_id",
                "google_client_secret": "google_client_secret",
            }
            saved_keys = []
            for k, dk in mapping.items():
                val = d.get(k, "")
                if isinstance(val, str): val = val.strip()
                else: val = str(val).strip() if val else ""
                # Hard guards: never save empty, never save masked, never save one field into another
                if not val: continue
                if "***" in val: continue          # NEVER save masked values
                if val == "●●●●●●●●": continue    # skip dots placeholder
                # Extra guard: API key must start with sk- or be a real key format
                if dk == "anthropic_key" and not (val.startswith("sk-") or len(val) > 20):
                    continue
                # Extra guard: gmail password should not look like an API key
                if dk == "gmail_app_password" and val.startswith("sk-"):
                    continue
                # Extra guard: API key should not be an email address
                if dk == "anthropic_key" and "@" in val:
                    continue
                # Per-user settings when logged in, global otherwise
                if user and user["id"] and dk not in ("google_client_id", "google_client_secret"):
                    set_ucfg(user["id"], dk, val)
                else:
                    set_cfg(dk, val)
                saved_keys.append(dk)
            self.j({"ok": True, "saved": saved_keys}); return

        if path == "/api/test-gmail":
            g = cfg("gmail_address"); pw = cfg("gmail_app_password")
            if not g:  self.j({"error": "No Gmail address in Settings"}, 400); return
            if not pw: self.j({"error": "No App Password in Settings"}, 400); return
            try:
                with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as s: s.login(g, pw)
                self.j({"ok": True, "message": f"✓ Connected as {g}"}); return
            except smtplib.SMTPAuthenticationError:
                self.j({"error": "Wrong App Password. Go to Google Account → Security → 2-Step Verification → App Passwords → create new → copy all 16 characters"}, 400); return
            except Exception as e:
                self.j({"error": str(e)}, 400); return

        if path == "/api/claude-proxy":
            d = self.jbody(); key = cfg("anthropic_key")
            if not key: self.j({"error": "No API key in Settings"}, 400); return
            t = ai(d.get("prompt", ""), d.get("max_tokens", 500))
            self.j({"text": t}); return

        if path == "/api/scrape":
            d = self.jbody(); q = d.get("query", "").strip()
            if not q: self.j({"error": "Query required"}, 400); return
            limit  = min(int(d.get("limit", 20)), 500)
            camp   = (d.get("campaign", "") or q[:30]).strip()
            filters = d.get("filters") or {}
            jid = str(uuid.uuid4())
            _pool.submit(_scrape_job, jid, q, limit, camp, filters)
            self.j({"ok": True, "job_id": jid, "message": f"Searching for up to {limit} stores..."}); return

        if path == "/api/manual-url":
            d = self.jbody(); url = d.get("url", "").strip()
            if not url: self.j({"error": "URL required"}, 400); return
            if not url.startswith("http"): url = "https://" + url
            domain = re.sub(r'^https?://(www\.)?', '', url).split("/")[0]
            c = db()
            ex = c.execute("SELECT id, status FROM leads WHERE store_url LIKE ?", (f"%{domain}%",)).fetchone()
            c.close()
            if ex:
                self.j({"ok": False, "duplicate": True, "lead_id": ex["id"],
                        "message": f"This store is already in your database (ID:{ex['id']}, Status:{ex['status']}). Click the lead to view it."}); return
            camp = (d.get("campaign", "") or domain).strip()
            _pool.submit(process, url, camp)
            self.j({"ok": True, "message": f"Processing {url} — finding email, analysing store, generating report and 30-email sequence. This takes 30-90 seconds. Refresh the Leads tab in a moment."}); return

        if path == "/api/manual-urls-batch":
            d = self.jbody(); urls = [u.strip() for u in d.get("urls", []) if u.strip()][:2000]
            camp = (d.get("campaign", "manual-batch")).strip()
            results = []
            queued = 0
            for url in urls:
                if not url.startswith("http"): url = "https://" + url
                domain = re.sub(r'^https?://(www\.)?', '', url).split("/")[0].lower()
                c = db()
                ex = c.execute("SELECT id FROM leads WHERE store_url LIKE ?", (f"%{domain}%",)).fetchone()
                sc = c.execute("SELECT domain FROM scraped_domains WHERE domain=?", (domain,)).fetchone()
                c.close()
                if ex:
                    results.append({"url": url, "status": "duplicate"})
                elif sc:
                    results.append({"url": url, "status": "already_scraped"})
                else:
                    _pool.submit(process, url, camp)
                    queued += 1
                    results.append({"url": url, "status": "queued"})
            skip_count = len(results) - queued
            self.j({"ok": True, "message": f"Queued {queued} URLs for processing. {skip_count} duplicates skipped. Results appear in the Leads tab as they complete (each takes 15-60 seconds).", "results": results, "queued": queued, "skipped": skip_count}); return

        if path == "/api/send-now":
            d = self.jbody(); lid = d.get("lead_id"); c = db()
            lead = c.execute("SELECT * FROM leads WHERE id=?", (lid,)).fetchone(); c.close()
            if not lead: self.j({"error": "Lead not found"}, 404); return
            if not lead["owner_email"]: self.j({"error": "No email address for this lead. Add one manually."}, 400); return
            pitch = json.loads(lead["pitch"] or "{}") if isinstance(lead["pitch"], str) else (lead["pitch"] or {})
            subj = d.get("subject") or pitch.get("subject", "")
            bh   = d.get("body_html") or ""
            bt   = re.sub(r'<[^>]+>', ' ', bh).strip()
            uid  = lead["user_id"] if "user_id" in lead.keys() else 0
            try:
                send_smtp(lead["owner_email"], subj, bh, bt, lead["unsubscribe_token"] or "", lead["store_name"] or "", uid)
                now = datetime.now().isoformat(); c = db()
                c.execute("UPDATE leads SET status='contacted',last_emailed=?,updated_at=? WHERE id=?", (now, now, lid))
                c.execute("INSERT INTO email_log(lead_id,event,detail,created_at) VALUES(?,?,?,?)",
                    (lid, "sent", f"Manual send to {lead['owner_email']}", now))
                c.commit(); c.close()
                self.j({"ok": True, "message": f"Email sent to {lead['owner_email']}"}); return
            except Exception as e:
                self.j({"error": str(e)}, 500); return

        m = re.match(r'^/api/start-sequence/(\d+)$', path)
        if m:
            lid = int(m.group(1)); c = db()
            lead = c.execute("SELECT * FROM leads WHERE id=?", (lid,)).fetchone()
            seq  = c.execute("SELECT * FROM email_sequence WHERE lead_id=? AND step=1 AND status='pending'", (lid,)).fetchone()
            c.close()
            if not lead: self.j({"error": "Lead not found"}, 404); return
            if not lead["owner_email"]: self.j({"error": "No email address"}, 400); return
            def send_first():
                if not seq: return
                try:
                    bt = re.sub(r'<[^>]+>', ' ', seq["body_html"] or "").strip()
                    uid = lead["user_id"] if "user_id" in lead.keys() else 0
                    send_smtp(lead["owner_email"], seq["subject"], seq["body_html"] or "", bt,
                        lead["unsubscribe_token"] or "", lead["store_name"] or "", uid)
                    now = datetime.now().isoformat(); c2 = db()
                    c2.execute("UPDATE email_sequence SET status='sent',sent_at=? WHERE id=?", (now, seq["id"]))
                    c2.execute("UPDATE leads SET status='contacted',last_emailed=?,updated_at=? WHERE id=?", (now, now, lid))
                    c2.execute("INSERT INTO email_log(lead_id,sequence_id,event,detail,created_at) VALUES(?,?,?,?,?)",
                        (lid, seq["id"], "sent", f"Step 1 to {lead['owner_email']}", now))
                    c2.commit(); c2.close()
                except Exception as e:
                    c2 = db()
                    c2.execute("INSERT INTO email_log(lead_id,event,detail,created_at) VALUES(?,?,?,?)",
                        (lid, "error", str(e), datetime.now().isoformat()))
                    c2.commit(); c2.close()
            _pool.submit(send_first)
            self.j({"ok": True, "message": f"Sequence started — {len(SEQ_DAYS)} emails over 365 days"}); return

        if path == "/api/bulk-action":
            d = self.jbody(); ids = d.get("lead_ids", []); action = d.get("action", "")
            c = db(); now = datetime.now().isoformat()
            if action == "delete":
                for lid in ids:
                    c.execute("DELETE FROM leads WHERE id=?", (lid,))
                    c.execute("DELETE FROM email_sequence WHERE lead_id=?", (lid,))
            elif action == "mark_contacted":
                for lid in ids: c.execute("UPDATE leads SET status='contacted',updated_at=? WHERE id=?", (now, lid))
            elif action == "cancel_sequence":
                for lid in ids: c.execute("UPDATE email_sequence SET status='cancelled' WHERE lead_id=? AND status='pending'", (lid,))
            elif action == "start_sequence":
                c.close()
                for lid in ids:
                    c2 = db()
                    lead = c2.execute("SELECT * FROM leads WHERE id=?", (lid,)).fetchone()
                    seq  = c2.execute("SELECT * FROM email_sequence WHERE lead_id=? AND step=1 AND status='pending'", (lid,)).fetchone()
                    c2.close()
                    if lead and seq and lead["owner_email"]:
                        def sf(l=lead, s=seq, i=lid):
                            try:
                                bt = re.sub(r'<[^>]+>', ' ', s["body_html"] or "").strip()
                                uid = l["user_id"] if "user_id" in l.keys() else 0
                                send_smtp(l["owner_email"], s["subject"], s["body_html"] or "", bt,
                                    l["unsubscribe_token"] or "", l["store_name"] or "", uid)
                                n = datetime.now().isoformat(); c3 = db()
                                c3.execute("UPDATE email_sequence SET status='sent',sent_at=? WHERE id=?", (n, s["id"]))
                                c3.execute("UPDATE leads SET status='contacted',last_emailed=?,updated_at=? WHERE id=?", (n, n, i))
                                c3.commit(); c3.close()
                            except: pass
                        _pool.submit(sf)
                self.j({"ok": True, "message": f"Started sequences for {len(ids)} leads"}); return
            c.commit(); c.close()
            self.j({"ok": True}); return

        if path == "/api/inbox/sync":
            threading.Thread(target=_inbox, daemon=True).start()
            self.j({"ok": True, "message": "Syncing Gmail inbox in background..."}); return

        if path == "/api/report/regenerate":
            d = self.jbody(); lid = d.get("lead_id"); c = db()
            lead = c.execute("SELECT * FROM leads WHERE id=?", (lid,)).fetchone(); c.close()
            if not lead: self.j({"error": "Not found"}, 404); return
            def regen():
                analysis = json.loads(lead["analysis"] or "{}") if isinstance(lead["analysis"], str) else (lead["analysis"] or {})
                sn = cfg("sender_name", SENDER); st = cfg("sender_title", TITLE)
                rh = build_report(lead["store_url"], lead["store_name"], lead["platform"] or "Ecommerce", analysis, sn, st)
                c2 = db()
                c2.execute("UPDATE leads SET report_html=?,updated_at=? WHERE id=?", (rh, datetime.now().isoformat(), lid))
                c2.commit(); c2.close()
            _pool.submit(regen)
            self.j({"ok": True, "message": "Regenerating report in background..."}); return

        self.j({"error": "Not found"}, 404)

    def do_PATCH(self):
        from urllib.parse import urlparse
        path = urlparse(self.path).path; d = self.jbody()

        m = re.match(r'^/api/leads/(\d+)$', path)
        if m:
            lid = int(m.group(1)); c = db(); now = datetime.now().isoformat()
            if "status" in d:
                c.execute("UPDATE leads SET status=?,updated_at=? WHERE id=?", (d["status"], now, lid))
                if d["status"] in ("replied", "converted", "skip", "unsubscribed"):
                    c.execute("UPDATE email_sequence SET status='cancelled' WHERE lead_id=? AND status='pending'", (lid,))
            if "notes" in d: c.execute("UPDATE leads SET notes=?,updated_at=? WHERE id=?", (d["notes"], now, lid))
            if "owner_email" in d:
                conf = max(score_email(d["owner_email"], ""), 70)
                c.execute("UPDATE leads SET owner_email=?,email_confidence=?,updated_at=? WHERE id=?", (d["owner_email"], conf, now, lid))
            if "tags" in d: c.execute("UPDATE leads SET tags=?,updated_at=? WHERE id=?", (json.dumps(d["tags"]), now, lid))
            c.commit(); c.close(); self.j({"ok": True}); return

        m = re.match(r'^/api/sequences/(\d+)/cancel$', path)
        if m:
            sid = int(m.group(1)); c = db()
            c.execute("UPDATE email_sequence SET status='cancelled' WHERE id=? AND status='pending'", (sid,))
            c.commit(); c.close(); self.j({"ok": True}); return

        m = re.match(r'^/api/inbox/(\d+)/read$', path)
        if m:
            rid = int(m.group(1)); c = db()
            c.execute("UPDATE inbox_replies SET is_read=1 WHERE id=?", (rid,))
            c.commit(); c.close(); self.j({"ok": True}); return

        self.j({"error": "Not found"}, 404)

    def do_DELETE(self):
        from urllib.parse import urlparse
        path = urlparse(self.path).path
        m = re.match(r'^/api/leads/(\d+)$', path)
        if m:
            lid = int(m.group(1)); c = db()
            c.execute("DELETE FROM leads WHERE id=?", (lid,))
            c.execute("DELETE FROM email_sequence WHERE lead_id=?", (lid,))
            c.commit(); c.close(); self.j({"ok": True}); return
        self.j({"error": "Not found"}, 404)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), H)
    print(f"\n  ⚡ OutReach — Educational Email Outreach Platform")
    print(f"  Running on http://0.0.0.0:{PORT}")
    print(f"  Google OAuth: {'enabled' if (GOOGLE_CLIENT_ID or cfg('google_client_id')) else 'disabled (add GOOGLE_CLIENT_ID)'}")
    print(f"  Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
        server.shutdown()
