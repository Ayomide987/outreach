import React, { useState, useEffect, useCallback, useRef } from 'react'
const API = '/api'

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('auth_token') }
function setToken(t) { localStorage.setItem('auth_token', t) }
function clearToken() { localStorage.removeItem('auth_token') }
function authFetch(url, opts = {}) {
  const token = getToken()
  const headers = { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  return fetch(url, { ...opts, headers })
}

// ── Login page ────────────────────────────────────────────────────────────────
function LoginPage({ onSkip }) {
  const [checking, setChecking] = React.useState(false)
  const [googleEnabled, setGoogleEnabled] = React.useState(null)

  React.useEffect(() => {
    fetch(`${API}/settings/check`).then(r => r.json()).then(d => {
      setGoogleEnabled(d.google_oauth_enabled || false)
    }).catch(() => setGoogleEnabled(false))
  }, [])

  function signInGoogle() {
    setChecking(true)
    window.location.href = `${API}/auth/google`
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',padding:16}}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:16,padding:40,width:'100%',maxWidth:400,textAlign:'center'}}>
        <div style={{fontSize:28,fontWeight:800,color:'var(--accent)',marginBottom:8}}>⚡ OutReach</div>
        <div style={{fontSize:14,color:'var(--muted)',marginBottom:32,lineHeight:1.6}}>Educational outreach platform — personalized, data-driven, automated</div>

        {googleEnabled ? (
          <button onClick={signInGoogle} disabled={checking} style={{
            width:'100%',padding:'13px',borderRadius:8,border:'1px solid var(--border)',
            background:'#fff',color:'#333',fontWeight:600,fontSize:14,cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:16
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
            {checking ? 'Redirecting...' : 'Sign in with Google'}
          </button>
        ) : (
          <div style={{padding:'12px 16px',borderRadius:8,background:'rgba(251,191,36,.1)',border:'1px solid rgba(251,191,36,.2)',fontSize:12,color:'var(--amber)',marginBottom:16,lineHeight:1.6}}>
            Google OAuth not configured. Add GOOGLE_CLIENT_ID to Settings or use the app directly.
          </div>
        )}

        <button onClick={onSkip} style={{
          width:'100%',padding:'11px',borderRadius:8,border:'1px solid var(--border)',
          background:'var(--bg3)',color:'var(--muted)',fontSize:13,cursor:'pointer'
        }}>
          Continue without sign-in
        </button>

        <div style={{fontSize:11,color:'var(--dim)',marginTop:20,lineHeight:1.6}}>
          Sign in with Google to sync your settings, leads, and sequences across devices.
        </div>
      </div>
    </div>
  )
}

function useInterval(fn, ms) {
  const r = useRef(fn)
  useEffect(() => { r.current = fn }, [fn])
  useEffect(() => { const id = setInterval(() => r.current(), ms); return () => clearInterval(id) }, [ms])
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function Spinner() {
  return <span style={{display:'inline-block',width:12,height:12,border:'2px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .6s linear infinite',flexShrink:0}}/>
}
function Tag({children, color}) {
  return <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:`${color}18`,color,border:`1px solid ${color}40`,fontWeight:600,whiteSpace:'nowrap'}}>{children}</span>
}
const STATUS_COLOR = {ready:'var(--accent)',new:'var(--muted)',contacted:'var(--blue)',replied:'var(--green)',converted:'var(--accent)',error:'var(--red)',no_email:'var(--red)',processing:'var(--blue)',unsubscribed:'var(--dim)',skip:'var(--dim)',analysed:'var(--blue)'}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toasts({ list, remove }) {
  return (
    <div style={{position:'fixed',bottom:20,right:20,display:'flex',flexDirection:'column',gap:8,zIndex:999}}>
      {list.map(t=>(
        <div key={t.id} onClick={()=>remove(t.id)} style={{
          background:t.type==='success'?'var(--green)':t.type==='error'?'#2d0f0f':t.type==='warn'?'#2d1f00':'var(--bg2)',
          color:t.type==='success'?'#0a0a0b':t.type==='error'?'var(--red)':t.type==='warn'?'var(--amber)':'var(--text)',
          border:'1px solid var(--border)',borderRadius:8,padding:'10px 16px',fontSize:13,fontWeight:500,
          cursor:'pointer',maxWidth:380,lineHeight:1.5,boxShadow:'0 4px 16px rgba(0,0,0,.4)'
        }}>{t.msg}</div>
      ))}
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsModal({ onClose, addToast, user }) {
  const [form, setForm] = React.useState({
    anthropic_api_key: '', gmail_address: '', gmail_app_password: '',
    sender_name: 'Ayomide Alonge', sender_title: 'Ecommerce Growth Specialist',
    base_url: 'http://localhost:8000', avatar_url: '',
    calendar_link: '', google_client_id: '', google_client_secret: ''
  })
  const [status, setStatus] = React.useState({})
  const [testing, setTesting] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  React.useEffect(() => {
    // Load ONLY non-sensitive settings to pre-fill
    fetch(`${API}/settings/check`).then(r => r.json()).then(d => {
      setStatus(d)
      setForm(f => ({
        ...f,
        sender_name: d.sender_name || f.sender_name,
        sender_title: d.sender_title || f.sender_title,
        gmail_address: d.gmail_address || f.gmail_address,
        base_url: d.base_url || f.base_url,
        avatar_url: d.avatar_url || f.avatar_url,
        calendar_link: d.calendar_link || f.calendar_link,
        // Never pre-fill password/secret fields
      }))
    }).catch(() => {})
  }, [])

  async function save() {
    const r = await fetch(`${API}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const d = await r.json()
    setSaved(true)
    addToast('Settings saved — ' + (d.saved || []).join(', '), 'success')
    // Refresh status
    fetch(`${API}/settings/check`).then(r => r.json()).then(setStatus).catch(() => {})
    setTimeout(() => { setSaved(false); onClose() }, 1200)
  }

  async function testGmail() {
    setTesting(true)
    // Save first so the test uses the new values
    await fetch(`${API}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const r = await fetch(`${API}/test-gmail`, { method: 'POST' })
    const d = await r.json()
    addToast(r.ok ? d.message : d.error, r.ok ? 'success' : 'error')
    setTesting(false)
  }

  const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 11px', color: 'var(--text)', fontSize: 13 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>⚙ Settings</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* API Key status banner */}
        <div style={{ background: status.anthropic_key === 'ok' ? 'var(--green-dim)' : 'var(--amber-dim)', border: `1px solid ${status.anthropic_key === 'ok' ? 'rgba(74,222,128,.2)' : 'rgba(251,191,36,.2)'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
          {status.anthropic_key === 'ok'
            ? <span style={{ color: 'var(--green)' }}>✓ Anthropic API key is saved and valid — leave blank to keep existing key</span>
            : <span style={{ color: 'var(--amber)' }}>⚠ No valid Anthropic API key saved yet — enter it below to enable AI features</span>}
        </div>

        {/* Anthropic API Key */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
            Anthropic API Key {status.anthropic_key === 'ok' && <span style={{ color: 'var(--green)', fontSize: 10 }}>(saved)</span>}
          </label>
          <input type="password" value={form.anthropic_api_key} onChange={e => set('anthropic_api_key', e.target.value)}
            placeholder={status.anthropic_key === 'ok' ? '••••••••••••• (already saved — leave blank to keep)' : 'sk-ant-api03-...'}
            style={inp} />
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>console.anthropic.com — powers all AI features (emails, analysis, reports)</div>
        </div>

        {/* Sender info */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Your Name</label>
          <input type="text" value={form.sender_name} onChange={e => set('sender_name', e.target.value)} placeholder="Ayomide Alonge" style={inp} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Your Title</label>
          <input type="text" value={form.sender_title} onChange={e => set('sender_title', e.target.value)} placeholder="Ecommerce Growth Specialist" style={inp} />
        </div>

        {/* Gmail */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Gmail Address</label>
          <input type="email" value={form.gmail_address} onChange={e => set('gmail_address', e.target.value)} placeholder="you@gmail.com" style={inp} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
            Gmail App Password {status.gmail_app_password === 'saved' && <span style={{ color: 'var(--green)', fontSize: 10 }}>(saved)</span>}
          </label>
          <input type="password" value={form.gmail_app_password} onChange={e => set('gmail_app_password', e.target.value)}
            placeholder={status.gmail_app_password === 'saved' ? '•••••••••••••••• (already saved — leave blank to keep)' : 'xxxx xxxx xxxx xxxx'}
            style={inp} />
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>Google Account → Security → 2-Step Verification → App Passwords → create new → copy all 16 chars</div>
        </div>

        {/* Avatar */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Profile Photo URL</label>
          <input type="text" value={form.avatar_url} onChange={e => set('avatar_url', e.target.value)} placeholder="https://... direct link to your photo" style={inp} />
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>Appears as circular avatar in email signatures</div>
        </div>

        {/* Calendar Link */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
            Calendar Link <span style={{ color: 'var(--accent)' }}>(CTA in all emails)</span>
          </label>
          <input type="text" value={form.calendar_link} onChange={e => set('calendar_link', e.target.value)} placeholder="https://calendly.com/yourname/..." style={inp} />
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>Calendly, Cal.com, or any booking link — appears as the CTA button in every email</div>
        </div>

        {/* Base URL */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>App URL (for email tracking)</label>
          <input type="text" value={form.base_url} onChange={e => set('base_url', e.target.value)} placeholder="http://localhost:8000" style={inp} />
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>Your deployment URL — used for email open tracking and unsubscribe links</div>
        </div>

        {/* Google OAuth */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>🔐 Google OAuth (for user sign-in)</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Google Client ID</label>
            <input type="text" value={form.google_client_id} onChange={e => set('google_client_id', e.target.value)} placeholder="123456789-abc...apps.googleusercontent.com" style={inp} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Google Client Secret</label>
            <input type="password" value={form.google_client_secret} onChange={e => set('google_client_secret', e.target.value)} placeholder="GOCSPX-..." style={inp} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>
            Get credentials from <strong>console.cloud.google.com</strong> → APIs & Services → Credentials → OAuth 2.0 Client ID. Set redirect URI to: <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 3 }}>{form.base_url || 'http://localhost:8000'}/api/auth/google/callback</code>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={testGmail} disabled={testing} style={{ flex: 1, padding: '9px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>
            {testing ? 'Testing...' : '🔌 Test Gmail'}
          </button>
          <button onClick={save} style={{ flex: 2, padding: '9px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#0a0a0b', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  )
}


// ── Advanced Search Panel (20 filters) ────────────────────────────────────────
// ── Advanced Search Panel (20 filters) ───────────────────────────────────────
function SearchPanel({ addToast, onStart, loading, campaigns }) {
  const [f, setF] = useState({
    query:'', platform:'Shopify', country:'', city:'', niche:'',
    traffic:'', store_age:'', revenue:'', employees:'', language:'',
    has_reviews:'', has_social:'', has_blog:'', has_app:'', has_live_chat:'',
    has_email_capture:'', has_loyalty:'', has_bnpl:'', currency:'', founded_year:'',
    limit:20, campaign:''
  })
  const set = (k,v) => setF(p=>({...p,[k]:v}))

  function go() {
    const q = [f.query, f.niche, f.city].filter(Boolean).join(' ')
    if (!q && !f.country && !f.platform) { addToast('Enter at least one search term, country or niche','warn'); return }
    const searchQuery = q || `${f.platform.toLowerCase()} ${f.country.toLowerCase()} store`
    onStart({
      query: searchQuery,
      limit: f.limit,
      campaign: f.campaign || searchQuery.slice(0,30),
      filters: {
        platform: f.platform, country: f.country, niche: f.niche, city: f.city,
        traffic: f.traffic, store_age: f.store_age, revenue: f.revenue,
        language: f.language, has_reviews: f.has_reviews, has_social: f.has_social,
        has_blog: f.has_blog, has_live_chat: f.has_live_chat,
        has_email_capture: f.has_email_capture, has_loyalty: f.has_loyalty,
        has_bnpl: f.has_bnpl, currency: f.currency, founded_year: f.founded_year,
      }
    })
  }

  // ── Option lists ──────────────────────────────────────────────────────────
  const PLATFORMS = ['Shopify','WooCommerce','BigCommerce','Wix','Squarespace','Magento','PrestaShop','OpenCart','Ecwid','Volusion','Big Cartel','WordPress','Shopware','nopCommerce','OsCommerce','X-Cart','ZenCart','CS-Cart','Shift4Shop','Weebly','3dcart','Yo!Kart']
  const COUNTRIES = [
    '','--- Africa ---','Nigeria','Ghana','Kenya','South Africa','Egypt','Ethiopia','Uganda','Tanzania','Senegal','Cameroon','Ivory Coast','Zimbabwe','Zambia','Rwanda','Mozambique',
    '--- Europe ---','United Kingdom','Germany','France','Netherlands','Spain','Italy','Poland','Sweden','Norway','Denmark','Finland','Belgium','Austria','Switzerland','Ireland','Portugal','Czech Republic','Hungary','Romania',
    '--- North America ---','USA','Canada','Mexico',
    '--- South America ---','Brazil','Argentina','Colombia','Chile','Peru',
    '--- Asia ---','India','Pakistan','Bangladesh','China','Japan','South Korea','Indonesia','Malaysia','Philippines','Singapore','Thailand','Vietnam','UAE','Saudi Arabia','Turkey','Israel',
    '--- Oceania ---','Australia','New Zealand',
  ]
  const NICHES = [
    '','Fashion & Apparel','Streetwear','Luxury Fashion','Plus Size Fashion','African Fashion','Vintage & Thrift','Kidswear','Sportswear','Lingerie','Shoes & Footwear',
    'Beauty & Cosmetics','Skincare','Haircare','African Beauty','Natural/Organic Beauty',"Men's Grooming",'Nail Products','Fragrances & Perfumes',
    'Health & Wellness','Vitamins & Supplements','CBD & Hemp','Fitness Equipment','Sports Nutrition','Yoga & Meditation',
    'Food & Beverage',"Gourmet/Specialty Food",'Coffee & Tea','Snacks',"Alcohol & Spirits",'Meal Kits',
    'Electronics & Tech','Mobile Accessories','Gaming','Smart Home','Audio & Headphones',
    'Home & Garden','Furniture','Kitchen & Dining','Bedding & Linen','Art & Décor','Plants & Garden',
    'Baby & Kids','Toys & Games','Educational Products','Baby Gear',
    'Pet Products','Dog Supplies','Cat Supplies','Pet Food',
    'Jewelry & Accessories','Fine Jewelry','Fashion Jewelry','Watches','Bags & Luggage',
    'Automotive','Car Accessories','Motorcycle',
    'Books & Education','E-learning','Stationery',
    'Art & Crafts','Photography','Music & Instruments',
    'Outdoor & Adventure','Camping','Hiking','Water Sports',
    'Religious & Faith-Based','Sustainable/Eco','Charity & Social Enterprise',
  ]
  const TRAFFIC = ['','Under 1K/month','1K–10K/month','10K–50K/month','50K–100K/month','100K–500K/month','500K–1M/month','Over 1M/month']
  const STORE_AGE = ['','Less than 1 year','1–2 years','2–5 years','5–10 years','Over 10 years']
  const REVENUE = ['','Early stage','Under $10K/month','$10K–$50K/month','$50K–$200K/month','$200K–$1M/month','Over $1M/month']
  const LANGUAGES = ['','English','Spanish','French','German','Portuguese','Arabic','Dutch','Italian','Polish','Turkish','Hindi','Malay','Yoruba','Swahili','Chinese','Japanese','Korean','Russian','Greek']
  const CURRENCIES = ['','USD','GBP','EUR','NGN','GHS','KES','ZAR','CAD','AUD','INR','BRL','MXN','AED','SGD','MYR','PHP','IDR','PKR','BDT']
  const FOUNDED = ['','2020–2025','2015–2020','2010–2015','2000–2010','Before 2000']
  const YESNO = ['','Yes','No']
  const LIMITS = [10,20,30,50,100,200,500]

  const inp = {width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',color:'var(--text)',fontSize:12,outline:'none'}
  const lbl = {display:'block',fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}

  const Section = ({title, children}) => (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px',marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>{title}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>{children}</div>
    </div>
  )

  const Field = ({label, children}) => (
    <div><label style={lbl}>{label}</label>{children}</div>
  )

  return (
    <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
      <div style={{maxWidth:700}}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:17,fontWeight:800,marginBottom:6}}>🔍 Advanced Store Search</div>
          <div style={{fontSize:13,color:'var(--muted)',lineHeight:1.8}}>
            Search 18+ sources simultaneously with 20 precision filters. Every store already in your database is automatically skipped. Only stores with confirmed email addresses are saved.
          </div>
        </div>

        {/* Keywords */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px',marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>🔑 Keywords</div>
          <label style={lbl}>Search Terms (optional extra keywords)</label>
          <input value={f.query} onChange={e=>set('query',e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()}
            placeholder={`e.g. "luxury" "handmade" "organic" "dropshipping" — leave blank to use filters only`}
            style={{...inp,padding:'10px 12px',fontSize:13}}/>
        </div>

        {/* Section 1: Platform & Location */}
        <Section title="🏪 Platform & Location">
          <Field label="Platform / CMS">
            <select value={f.platform} onChange={e=>set('platform',e.target.value)} style={inp}>
              {PLATFORMS.map(p=><option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Country">
            <select value={f.country} onChange={e=>set('country',e.target.value)} style={inp}>
              {COUNTRIES.map(c=>(
                c.startsWith('---') ? <option key={c} disabled style={{color:'var(--dim)',fontWeight:700}}>{c}</option>
                : <option key={c} value={c}>{c||'Any Country'}</option>
              ))}
            </select>
          </Field>
          <Field label="City / Region (optional)">
            <input value={f.city} onChange={e=>set('city',e.target.value)} placeholder="e.g. Lagos, London, New York" style={inp}/>
          </Field>
          <Field label="Store Language">
            <select value={f.language} onChange={e=>set('language',e.target.value)} style={inp}>
              {LANGUAGES.map(l=><option key={l} value={l}>{l||'Any Language'}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <select value={f.currency} onChange={e=>set('currency',e.target.value)} style={inp}>
              {CURRENCIES.map(c=><option key={c} value={c}>{c||'Any Currency'}</option>)}
            </select>
          </Field>
          <Field label="Founded / Store Age">
            <select value={f.founded_year} onChange={e=>set('founded_year',e.target.value)} style={inp}>
              {FOUNDED.map(y=><option key={y} value={y}>{y||'Any Age'}</option>)}
            </select>
          </Field>
        </Section>

        {/* Section 2: Niche */}
        <Section title="🎯 Niche & Industry">
          <div style={{gridColumn:'1/-1'}}>
            <label style={lbl}>Niche / Industry</label>
            <select value={f.niche} onChange={e=>set('niche',e.target.value)} style={{...inp,padding:'8px 10px'}}>
              {NICHES.map(n=><option key={n} value={n}>{n||'Any Niche'}</option>)}
            </select>
          </div>
        </Section>

        {/* Section 3: Size & Traffic */}
        <Section title="📈 Size & Traffic">
          <Field label="Monthly Website Traffic">
            <select value={f.traffic} onChange={e=>set('traffic',e.target.value)} style={inp}>
              {TRAFFIC.map(t=><option key={t} value={t}>{t||'Any Traffic'}</option>)}
            </select>
          </Field>
          <Field label="Estimated Monthly Revenue">
            <select value={f.revenue} onChange={e=>set('revenue',e.target.value)} style={inp}>
              {REVENUE.map(r=><option key={r} value={r}>{r||'Any Revenue'}</option>)}
            </select>
          </Field>
          <Field label="Store Age">
            <select value={f.store_age} onChange={e=>set('store_age',e.target.value)} style={inp}>
              {STORE_AGE.map(s=><option key={s} value={s}>{s||'Any Age'}</option>)}
            </select>
          </Field>
        </Section>

        {/* Section 4: Features present */}
        <Section title="✅ Store Features (find stores with/without)">
          <Field label="Has Customer Reviews?">
            <select value={f.has_reviews} onChange={e=>set('has_reviews',e.target.value)} style={inp}>
              <option value="">Any</option>
              <option value="Yes">Yes — has reviews</option>
              <option value="No">No — missing reviews (great pitch angle)</option>
            </select>
          </Field>
          <Field label="Active on Social Media?">
            <select value={f.has_social} onChange={e=>set('has_social',e.target.value)} style={inp}>
              <option value="">Any</option>
              <option value="Yes">Yes — active social presence</option>
              <option value="No">No — no social media (pitch angle)</option>
            </select>
          </Field>
          <Field label="Has a Blog / Content?">
            <select value={f.has_blog} onChange={e=>set('has_blog',e.target.value)} style={inp}>
              <option value="">Any</option>
              <option value="Yes">Yes — has blog/content</option>
              <option value="No">No — missing content strategy</option>
            </select>
          </Field>
          <Field label="Has Live Chat?">
            <select value={f.has_live_chat} onChange={e=>set('has_live_chat',e.target.value)} style={inp}>
              <option value="">Any</option>
              <option value="Yes">Yes — has live chat</option>
              <option value="No">No — missing live chat (pitch angle)</option>
            </select>
          </Field>
          <Field label="Has Email Capture / Popup?">
            <select value={f.has_email_capture} onChange={e=>set('has_email_capture',e.target.value)} style={inp}>
              <option value="">Any</option>
              <option value="Yes">Yes — captures emails</option>
              <option value="No">No — not capturing emails</option>
            </select>
          </Field>
          <Field label="Has Loyalty Programme?">
            <select value={f.has_loyalty} onChange={e=>set('has_loyalty',e.target.value)} style={inp}>
              <option value="">Any</option>
              <option value="Yes">Yes — has loyalty/rewards</option>
              <option value="No">No — missing loyalty programme</option>
            </select>
          </Field>
          <Field label="Has Buy Now Pay Later?">
            <select value={f.has_bnpl} onChange={e=>set('has_bnpl',e.target.value)} style={inp}>
              <option value="">Any</option>
              <option value="Yes">Yes — offers BNPL (Klarna, Afterpay etc)</option>
              <option value="No">No — missing BNPL (pitch angle)</option>
            </select>
          </Field>
        </Section>

        {/* Section 5: Campaign & Quantity */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px',marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>⚙ Search Settings</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Field label="Campaign Name">
              <input value={f.campaign} onChange={e=>set('campaign',e.target.value)} placeholder="e.g. Nigeria Shopify Fashion Apr" style={inp}/>
            </Field>
            <Field label="Number of Stores to Find">
              <select value={f.limit} onChange={e=>set('limit',Number(e.target.value))} style={inp}>
                {LIMITS.map(n=><option key={n} value={n}>{n} stores</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Active filters summary */}
        {Object.entries(f).filter(([k,v])=>v&&k!=='query'&&k!=='limit'&&k!=='campaign'&&k!=='platform').length > 0 && (
          <div style={{background:'rgba(200,241,53,.06)',border:'1px solid rgba(200,241,53,.2)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'var(--accent)',lineHeight:1.8}}>
            <strong>Active filters:</strong> {Object.entries(f).filter(([k,v])=>v&&k!=='query'&&k!=='limit'&&k!=='campaign'&&v!=='Shopify').map(([k,v])=>`${k.replace(/_/g,' ')}: ${v}`).join(' · ')}
          </div>
        )}

        <button onClick={go} disabled={loading} style={{width:'100%',padding:'13px',borderRadius:8,border:'none',background:'var(--accent)',color:'#0a0a0b',fontWeight:800,cursor:'pointer',fontSize:15,opacity:loading?0.5:1,letterSpacing:'.01em'}}>
          {loading?'🔄 Searching...':'🔍 Search for Stores'}
        </button>

        <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 16px',marginTop:12,fontSize:12,color:'var(--muted)',lineHeight:1.9}}>
          <strong style={{color:'var(--text)'}}>How the search works:</strong><br/>
          Searches myip.ms (14 pages × 3 sort orders), DuckDuckGo (10 query variants), Bing, Yahoo, Trustpilot, BuiltWith and more — simultaneously.<br/>
          Every domain already in your database is skipped. Only stores with a confirmed email are saved to your leads.
        </div>

        {campaigns.length>0&&(
          <div style={{marginTop:16}}>
            <div style={{fontSize:11,color:'var(--muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>Previous Campaigns (click to reuse name)</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {campaigns.map(c=>(
                <span key={c.campaign} onClick={()=>set('campaign',c.campaign)}
                  style={{fontSize:12,padding:'3px 10px',borderRadius:20,background:'rgba(167,139,250,.1)',color:'#a78bfa',border:'1px solid rgba(167,139,250,.2)',cursor:'pointer'}}>
                  {c.campaign} ({c.count})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ── Upload URLs ───────────────────────────────────────────────────────────────
function UploadPanel({ addToast, onDone }) {
  const [mode, setMode] = useState('single')
  const [url, setUrl] = useState('')
  const [batch, setBatch] = useState('')
  const [camp, setCamp] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)

  async function submitSingle() {
    if (!url.trim()) return
    setBusy(true); setRes(null)
    const r = await fetch(`${API}/manual-url`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url.trim(),campaign:camp.trim()})})
    const d = await r.json(); setBusy(false)
    if (d.duplicate) { setRes({t:'warn',m:d.message}); addToast(d.message,'warn') }
    else if (d.ok) { setRes({t:'success',m:d.message}); addToast('Store queued!','success'); setUrl(''); onDone() }
    else setRes({t:'error',m:d.message||'Error'})
  }

  async function submitBatch() {
    const urls = batch.split('\n').map(u=>u.trim()).filter(Boolean)
    if (!urls.length) return
    setBusy(true); setRes(null)
    const r = await fetch(`${API}/manual-urls-batch`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({urls,campaign:camp.trim()})})
    const d = await r.json(); setBusy(false)
    setRes({t:'success',m:d.message}); addToast(d.message,'success'); setBatch(''); onDone()
  }

  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { const urls = ev.target.result.split('\n').map(l=>l.split(',')[0].trim()).filter(u=>u.includes('.')); setBatch(urls.join('\n')); setMode('batch') }
    reader.readAsText(file)
  }

  const inp = {width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 11px',color:'var(--text)',fontSize:13,outline:'none'}

  return (
    <div style={{padding:24,maxWidth:560,overflowY:'auto'}}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>➕ Add Stores by URL</div>
      <div style={{fontSize:13,color:'var(--muted)',marginBottom:18,lineHeight:1.8}}>
        Give LeadForge any ecommerce store URL. It will visit the site, find the owner's email through the website and all social media profiles, run a 30-point store analysis, generate a branded PDF-ready report in your name, and create 30 personalised emails scheduled over 365 days. Duplicates are detected automatically.
      </div>
      <div style={{display:'flex',gap:2,background:'var(--bg3)',borderRadius:8,padding:3,border:'1px solid var(--border)',marginBottom:16}}>
        {[['single','Single URL'],['batch','Multiple URLs'],['file','Upload CSV/TXT']].map(([m,l])=>(
          <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:'7px',borderRadius:6,fontSize:12,fontWeight:mode===m?600:400,background:mode===m?'var(--bg2)':'transparent',color:mode===m?'var(--text)':'var(--muted)',border:mode===m?'1px solid var(--border)':'1px solid transparent',cursor:'pointer'}}>{l}</button>
        ))}
      </div>

      {mode==='single'&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div>
            <label style={{display:'block',fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4}}>Store URL</label>
            <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitSingle()} placeholder="https://www.example-store.com" style={{...inp,fontSize:14,padding:'10px 12px'}}/>
          </div>
          <div>
            <label style={{display:'block',fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4}}>Campaign name (optional)</label>
            <input value={camp} onChange={e=>setCamp(e.target.value)} placeholder="e.g. Manual Outreach Apr" style={inp}/>
          </div>
          <button onClick={submitSingle} disabled={busy||!url.trim()} style={{padding:'11px',borderRadius:7,border:'none',background:'var(--accent)',color:'#0a0a0b',fontWeight:700,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:7,opacity:busy||!url.trim()?0.5:1}}>
            {busy?<><Spinner/>Processing...</>:'🔗 Add This Store'}
          </button>
          {res&&<div style={{padding:'10px 14px',borderRadius:7,fontSize:13,background:res.t==='success'?'rgba(74,222,128,.1)':res.t==='warn'?'rgba(251,191,36,.1)':'rgba(248,113,113,.1)',color:res.t==='success'?'var(--green)':res.t==='warn'?'var(--amber)':'var(--red)',lineHeight:1.6}}>{res.m}</div>}
        </div>
      )}

      {mode==='batch'&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div>
            <label style={{display:'block',fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4}}>URLs — one per line (max 200)</label>
            <textarea value={batch} onChange={e=>setBatch(e.target.value)} rows={10} placeholder={'https://store1.com\nhttps://store2.com\nhttps://store3.com'}
              style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'10px 12px',color:'var(--text)',fontSize:12,lineHeight:1.7,resize:'vertical',fontFamily:'monospace',outline:'none'}}/>
            <div style={{fontSize:11,color:'var(--dim)',marginTop:3}}>{batch.split('\n').filter(l=>l.trim()).length} URLs entered</div>
          </div>
          <div>
            <label style={{display:'block',fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4}}>Campaign name</label>
            <input value={camp} onChange={e=>setCamp(e.target.value)} placeholder="e.g. Batch April" style={inp}/>
          </div>
          <button onClick={submitBatch} disabled={busy||!batch.trim()} style={{padding:'11px',borderRadius:7,border:'none',background:'var(--accent)',color:'#0a0a0b',fontWeight:700,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:7,opacity:busy||!batch.trim()?0.5:1}}>
            {busy?<><Spinner/>Queueing...</>:'⬆ Queue All URLs'}
          </button>
          {res&&<div style={{padding:'10px 14px',borderRadius:7,fontSize:13,background:'rgba(74,222,128,.1)',color:'var(--green)',lineHeight:1.6}}>{res.m}</div>}
        </div>
      )}

      {mode==='file'&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{border:'2px dashed var(--border)',borderRadius:10,padding:36,textAlign:'center',cursor:'pointer'}}
            onClick={()=>document.getElementById('lf-file').click()}
            onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor='var(--accent)'}}
            onDragLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
            onDrop={e=>{e.preventDefault();handleFile({target:{files:[e.dataTransfer.files[0]]}})}}>
            <div style={{fontSize:32,marginBottom:10}}>📂</div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:5}}>Drop CSV or TXT file here</div>
            <div style={{fontSize:12,color:'var(--muted)'}}>Or click to browse. One URL per line or row.</div>
            <input id="lf-file" type="file" accept=".csv,.txt" style={{display:'none'}} onChange={handleFile}/>
          </div>
          <div style={{fontSize:12,color:'var(--muted)',padding:'10px 14px',background:'var(--bg3)',borderRadius:8,lineHeight:1.8}}>
            <strong style={{color:'var(--text)'}}>Supported:</strong> .txt (one URL per line) · .csv (URLs in first column)
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sequence timeline ─────────────────────────────────────────────────────────
function SequenceTimeline({ leadId }) {
  const [seqs, setSeqs] = useState([]); const [loading, setLoading] = useState(true); const [preview, setPreview] = useState(null)
  useEffect(()=>{ fetch(`${API}/sequences/${leadId}`).then(r=>r.json()).then(d=>{setSeqs(d);setLoading(false)}).catch(()=>setLoading(false)) },[leadId])
  if (loading) return <div style={{padding:20,textAlign:'center',color:'var(--muted)',fontSize:13}}>Loading...</div>
  if (!seqs.length) return <div style={{padding:16,color:'var(--muted)',fontSize:13}}>No sequence generated yet. Make sure your Anthropic API key is set in Settings, then re-add this store.</div>
  const sent=seqs.filter(s=>s.status==='sent').length; const pending=seqs.filter(s=>s.status==='pending').length; const opens=seqs.reduce((a,s)=>a+(s.open_count||0),0)
  const LABELS=['Initial pitch','Day 3','Day 5','Day 7','Day 10','Day 14','Day 18','Day 21','Day 25','Month 1','Week 5','Week 6','Week 7','Week 8','Month 2+','Month 2.5','Month 3','Month 3.5','Month 4','Month 4.5','Month 5','Month 5.5','Month 6','Month 6.5','Month 7','Month 8','Month 9','Month 10','Month 11','Year 1']
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
        {[['Total',seqs.length,'var(--muted)'],['Sent',sent,'var(--green)'],['Pending',pending,'var(--blue)'],['Opens',opens,'var(--accent)']].map(([l,v,c])=>(
          <div key={l} style={{background:'var(--bg3)',borderRadius:6,padding:'8px',textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
            <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>
      {seqs.map(seq=>(
        <div key={seq.id} style={{display:'flex',gap:8,padding:'7px 4px',borderBottom:'1px solid var(--border)',alignItems:'center'}}>
          <div style={{width:22,height:22,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,
            background:seq.status==='sent'?'rgba(74,222,128,.15)':seq.status==='cancelled'||seq.status==='error'?'rgba(248,113,113,.1)':'var(--bg3)',
            color:seq.status==='sent'?'var(--green)':seq.status==='cancelled'||seq.status==='error'?'var(--red)':'var(--muted)',border:'1px solid var(--border)'}}>
            {seq.step}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>
              {LABELS[seq.step-1]||`Step ${seq.step}`}
              {seq.open_count>0&&<span style={{fontSize:10,background:'rgba(200,241,53,.1)',color:'var(--accent)',padding:'1px 6px',borderRadius:10}}>{seq.open_count} open{seq.open_count>1?'s':''}</span>}
            </div>
            <div style={{fontSize:11,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{seq.subject}</div>
            <div style={{fontSize:10,color:'var(--dim)',marginTop:1}}>{seq.status==='sent'?`Sent ${new Date(seq.sent_at).toLocaleDateString()}`:seq.status==='pending'?`Due ${new Date(seq.scheduled_at).toLocaleDateString()}`:seq.status}</div>
          </div>
          <div style={{display:'flex',gap:3,flexShrink:0}}>
            <button onClick={()=>setPreview(seq.id)} title="Preview email" style={{padding:'3px 7px',fontSize:10,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:4,cursor:'pointer',color:'var(--text)'}}>👁</button>
            {seq.status==='pending'&&<button onClick={async()=>{await fetch(`${API}/sequences/${seq.id}/cancel`,{method:'PATCH'});setSeqs(p=>p.map(s=>s.id===seq.id?{...s,status:'cancelled'}:s))}} title="Cancel this email" style={{padding:'3px 7px',fontSize:10,background:'rgba(248,113,113,.1)',border:'1px solid rgba(248,113,113,.2)',borderRadius:4,cursor:'pointer',color:'var(--red)'}}>✕</button>}
          </div>
        </div>
      ))}
      {preview&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:400}}>
          <div style={{width:640,maxHeight:'88vh',display:'flex',flexDirection:'column',borderRadius:12,overflow:'hidden',border:'1px solid var(--border)'}}>
            <div style={{background:'var(--bg2)',padding:'12px 16px',display:'flex',justifyContent:'space-between',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:13,fontWeight:500}}>Email Preview — Step {seqs.find(s=>s.id===preview)?.step}</span>
              <button onClick={()=>setPreview(null)} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:18}}>✕</button>
            </div>
            <iframe src={`${API}/sequence-html/${preview}`} style={{flex:1,border:'none',minHeight:480}} title="preview"/>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inbox ─────────────────────────────────────────────────────────────────────
function InboxTab({ addToast }) {
  const [replies, setReplies] = useState([]); const [loading, setLoading] = useState(true); const [syncing, setSyncing] = useState(false); const [unreadOnly, setUnreadOnly] = useState(false)
  const load = useCallback(async()=>{ try{ const r=await fetch(`${API}/inbox?unread_only=${unreadOnly}`); setReplies(await r.json()) }catch(e){} setLoading(false) },[unreadOnly])
  useEffect(()=>{load()},[load])
  async function sync(){ setSyncing(true); const r=await fetch(`${API}/inbox/sync`,{method:'POST'}); const d=await r.json(); addToast(d.message,'info'); setTimeout(()=>{load();setSyncing(false)},3500) }
  async function markRead(id){ await fetch(`${API}/inbox/${id}/read`,{method:'PATCH'}); setReplies(p=>p.map(r=>r.id===id?{...r,is_read:1}:r)) }
  const unread = replies.filter(r=>!r.is_read).length
  return (
    <div style={{padding:20,overflowY:'auto',flex:1}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4,display:'flex',alignItems:'center',gap:8}}>
            📬 Inbox {unread>0&&<span style={{background:'var(--red)',color:'#fff',borderRadius:20,fontSize:11,padding:'2px 9px',fontWeight:700}}>{unread} new</span>}
          </div>
          <div style={{fontSize:12,color:'var(--muted)'}}>Replies from Gmail matched to leads automatically. Sequence cancels when a lead replies. Auto-syncs every 15 minutes.</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--muted)',cursor:'pointer'}}>
            <input type="checkbox" checked={unreadOnly} onChange={e=>setUnreadOnly(e.target.checked)}/> Unread only
          </label>
          <button onClick={sync} disabled={syncing} style={{padding:'7px 14px',borderRadius:6,border:'none',background:'var(--accent)',color:'#0a0a0b',fontWeight:700,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',gap:6,opacity:syncing?0.6:1}}>
            {syncing?<><Spinner/>Syncing...</>:'↻ Sync Gmail'}
          </button>
        </div>
      </div>
      {loading?<div style={{textAlign:'center',padding:40,color:'var(--muted)'}}>Loading...</div>
      :replies.length===0?(
        <div style={{textAlign:'center',padding:50,color:'var(--muted)'}}>
          <div style={{fontSize:40,marginBottom:14}}>✉</div>
          <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:8}}>No replies yet</div>
          <div style={{fontSize:13,lineHeight:1.7}}>Click "Sync Gmail" to check for new replies.<br/>When a lead replies, their sequence is automatically cancelled and they appear here.</div>
        </div>
      ):(
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
          {replies.map(r=>(
            <div key={r.id} onClick={()=>markRead(r.id)} style={{display:'flex',gap:12,padding:'14px 18px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:r.is_read?'transparent':'rgba(200,241,53,.03)'}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:r.is_read?'var(--bg3)':'rgba(74,222,128,.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:15,color:r.is_read?'var(--muted)':'var(--green)'}}>↩</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontSize:13,fontWeight:500,color:r.is_read?'var(--text)':'var(--accent)'}}>{r.from_email}</span>
                    {r.store_name&&<span style={{fontSize:11,color:'var(--muted)'}}>· {r.store_name}</span>}
                    {!r.is_read&&<span style={{fontSize:10,background:'var(--green)',color:'#0a0a0b',borderRadius:20,padding:'1px 7px',fontWeight:700}}>NEW</span>}
                  </div>
                  <span style={{fontSize:11,color:'var(--dim)',flexShrink:0}}>{r.received_at?.slice(0,16)}</span>
                </div>
                <div style={{fontSize:13,fontWeight:500,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.subject}</div>
                <div style={{fontSize:12,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.body?.slice(0,130)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [ov, setOv] = useState(null); const [seq, setSeq] = useState([]); const [sched, setSched] = useState([]); const [top, setTop] = useState([]); const [camps, setCamps] = useState([])
  useEffect(()=>{
    fetch(`${API}/analytics/overview`).then(r=>r.json()).then(setOv)
    fetch(`${API}/analytics/sequence-performance`).then(r=>r.json()).then(setSeq)
    fetch(`${API}/analytics/scheduled`).then(r=>r.json()).then(setSched)
    fetch(`${API}/analytics/top-leads`).then(r=>r.json()).then(setTop)
    fetch(`${API}/analytics/campaigns`).then(r=>r.json()).then(setCamps)
  },[])
  if (!ov) return <div style={{padding:40,textAlign:'center',color:'var(--muted)'}}>Loading analytics...</div>
  const {leads,pipeline,emails,rates,inbox} = ov
  return (
    <div style={{padding:20,overflowY:'auto',flex:1}}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:18}}>📊 Analytics</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18}}>
        {[['Total Leads',leads.total,'var(--text)'],['With Email',leads.with_email,'#60a5fa'],['Avg Score',`${leads.avg_score||0}/100`,'var(--amber)'],['Open Rate',`${rates.open_rate}%`,rates.open_rate>30?'var(--green)':rates.open_rate>10?'var(--amber)':'var(--muted)'],['Emails Sent',emails.sent,'var(--text)'],['Opened',emails.opened,'var(--green)'],['Pending',emails.pending,'#60a5fa'],['New Replies',inbox.new_replies,'var(--accent)']].map(([l,v,c])=>(
          <div key={l} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
            <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:5}}>{l}</div>
            <div style={{fontSize:22,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:18,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>Lead Pipeline</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,textAlign:'center'}}>
          {[['New',pipeline.new,'#60a5fa'],['Contacted',pipeline.contacted,'var(--amber)'],['Replied',pipeline.replied,'var(--green)'],['Converted',pipeline.converted,'var(--accent)'],['Unsubbed',pipeline.unsubscribed,'var(--red)']].map(([l,v,c])=>(
            <div key={l} style={{padding:'12px 8px',background:'var(--bg3)',borderRadius:8}}>
              <div style={{fontSize:22,fontWeight:800,color:c,lineHeight:1}}>{v||0}</div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      {seq.length>0&&(
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:18,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>30-Email Sequence Performance</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{borderBottom:'1px solid var(--border)'}}>
                {['Step','Theme','Sent','Opened','Open Rate','Pending'].map(h=><th key={h} style={{padding:'6px 10px',textAlign:'left',color:'var(--muted)',fontWeight:500,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {seq.map(row=><tr key={row.step} style={{borderBottom:'1px solid var(--border)'}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{row.step}</td>
                  <td style={{padding:'7px 10px',color:'var(--muted)'}}>{['Initial pitch','Day 3','Day 5','Day 7','Day 10','Day 14','Day 18','Day 21','Day 25','Month 1','Week 5','Week 6','Week 7','Week 8','Month 2+','Month 2.5','Month 3','Month 3.5','Month 4','Month 4.5','Month 5','Month 5.5','Month 6','Month 6.5','Month 7','Month 8','Month 9','Month 10','Month 11','Year 1'][row.step-1]||`Step ${row.step}`}</td>
                  <td style={{padding:'7px 10px'}}>{row.sent||0}</td>
                  <td style={{padding:'7px 10px',color:'var(--green)'}}>{row.opened||0}</td>
                  <td style={{padding:'7px 10px',color:row.open_rate>30?'var(--green)':row.open_rate>10?'var(--amber)':'var(--muted)'}}>{row.open_rate||0}%</td>
                  <td style={{padding:'7px 10px',color:'#60a5fa'}}>{row.pending||0}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {sched.length>0&&(
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:18,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>Upcoming Emails (Next 30 Days)</div>
          {sched.slice(0,12).map((s,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
              <div><span style={{fontSize:12,fontWeight:500}}>{s.store_name||s.owner_email}</span><span style={{fontSize:11,color:'var(--muted)',marginLeft:8}}>Step {s.step}</span></div>
              <span style={{fontSize:11,color:'var(--dim)'}}>{new Date(s.scheduled_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
      {top.length>0&&(
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:18,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>Top Leads by Score</div>
          {top.slice(0,10).map(l=>(
            <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.store_name||l.store_url}</div>
                <div style={{fontSize:11,color:'var(--muted)'}}>{l.owner_email} · {l.platform}</div>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:l.score>=40?'var(--amber)':'var(--red)',marginLeft:8}}>{l.score}/100</span>
            </div>
          ))}
        </div>
      )}
      {camps.length>0&&(
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:18}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>Campaigns</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
            {camps.map(c=>(
              <div key={c.campaign} style={{background:'var(--bg3)',borderRadius:8,padding:'12px 14px',border:'1px solid var(--border)'}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.campaign}</div>
                <div style={{fontSize:11,color:'var(--muted)',lineHeight:1.9}}>{c.total} leads · {c.with_email} with email<br/>{c.replied||0} replied · {c.converted||0} converted</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Lead detail panel ─────────────────────────────────────────────────────────
function LeadDetail({ lead: init, onClose, onUpdate, addToast }) {
  const [lead, setLead] = useState(init)
  const [dtab, setDtab] = useState('pitch')
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState(null)
  const [notes, setNotes] = useState(init.notes||'')
  const [editEmail, setEditEmail] = useState(init.owner_email||'')
  const [editingEmail, setEditingEmail] = useState(false)
  const pitch = (() => { try { return typeof lead.pitch==='object'?lead.pitch:JSON.parse(lead.pitch||'{}') } catch{ return {} } })()
  const analysis = (() => { try { return typeof lead.analysis==='object'?lead.analysis:JSON.parse(lead.analysis||'{}') } catch{ return {} } })()

  async function updateStatus(s) {
    await fetch(`${API}/leads/${lead.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:s})})
    setLead(l=>({...l,status:s})); onUpdate(lead.id,{status:s})
    addToast(`Status → "${s}"${['replied','converted','skip'].includes(s)?' (pending emails cancelled)':''}`, 'success')
  }
  async function saveEmail() {
    await fetch(`${API}/leads/${lead.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner_email:editEmail})})
    setLead(l=>({...l,owner_email:editEmail})); setEditingEmail(false); addToast('Email updated','success')
  }
  async function saveNotes() {
    await fetch(`${API}/leads/${lead.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes})})
    addToast('Notes saved','success')
  }
  async function sendNow() {
    if (!lead.owner_email) { setSendMsg({t:'error',m:'Add an email address first'}); return }
    setSending(true); setSendMsg(null)
    const r = await fetch(`${API}/send-now`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lead_id:lead.id,subject:pitch.subject||'',body_html:'',attach_report:true})})
    const d = await r.json(); setSending(false)
    if (r.ok) { setSendMsg({t:'success',m:d.message}); setLead(l=>({...l,status:'contacted'})); onUpdate(lead.id,{status:'contacted'}) }
    else setSendMsg({t:'error',m:d.error||'Send failed'})
  }
  async function startSeq() {
    if (!lead.owner_email) { setSendMsg({t:'error',m:'No email address'}); return }
    setSending(true)
    const r = await fetch(`${API}/start-sequence/${lead.id}`,{method:'POST'})
    const d = await r.json(); setSending(false)
    setSendMsg({t:r.ok?'success':'error',m:r.ok?d.message:d.error||'Error'})
    if (r.ok) { setLead(l=>({...l,status:'contacted'})); onUpdate(lead.id,{status:'contacted'}); setDtab('sequence') }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'stretch',justifyContent:'flex-end',zIndex:100}}>
      <div style={{width:560,background:'var(--bg2)',borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',overflowY:'auto'}}>
        {/* Header */}
        <div style={{padding:'16px 20px 12px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
            <div style={{flex:1,minWidth:0,paddingRight:12}}>
              <div style={{fontSize:15,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.store_name||lead.store_url}</div>
              <a href={lead.store_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:'var(--muted)',textDecoration:'none'}}>
                🔗 {lead.store_url.replace('https://','').replace('http://','').split('/')[0]}
              </a>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:20}}>✕</button>
          </div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
            {lead.platform&&<Tag color="var(--muted)">{lead.platform}</Tag>}
            {lead.country&&<Tag color="var(--muted)">{lead.country}</Tag>}
            {lead.niche&&<Tag color="var(--muted)">{lead.niche}</Tag>}
            {lead.score>0&&<Tag color="var(--amber)">{lead.score}/100</Tag>}
            {lead.reply_received?<Tag color="var(--green)">✓ Replied</Tag>:null}
            {lead.campaign&&<Tag color="#a78bfa">{lead.campaign}</Tag>}
          </div>
          {/* Email */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            {editingEmail?(
              <>
                <input value={editEmail} onChange={e=>setEditEmail(e.target.value)} style={{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:5,padding:'5px 9px',color:'var(--text)',fontSize:12,outline:'none'}}/>
                <button onClick={saveEmail} style={{padding:'5px 12px',borderRadius:5,border:'none',background:'var(--accent)',color:'#0a0a0b',fontSize:12,cursor:'pointer',fontWeight:700}}>Save</button>
                <button onClick={()=>setEditingEmail(false)} style={{padding:'5px 9px',borderRadius:5,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--muted)',fontSize:12,cursor:'pointer'}}>Cancel</button>
              </>
            ):(
              <>
                <span style={{fontSize:12,color:lead.owner_email?'var(--text)':'var(--dim)',display:'flex',alignItems:'center',gap:5}}>
                  ✉ {lead.owner_email||'No email found'}
                  {lead.email_confidence>0&&lead.owner_email&&<span style={{fontSize:10,color:lead.email_confidence>=70?'var(--green)':lead.email_confidence>=50?'var(--amber)':'var(--red)'}}>{lead.email_confidence}%</span>}
                </span>
                <button onClick={()=>setEditingEmail(true)} style={{padding:'3px 8px',borderRadius:4,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--muted)',fontSize:11,cursor:'pointer'}}>{lead.owner_email?'Edit':'+ Add email'}</button>
              </>
            )}
          </div>
          {/* Status */}
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {['new','contacted','replied','converted','skip'].map(s=>(
              <button key={s} onClick={()=>updateStatus(s)} style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:lead.status===s?700:400,cursor:'pointer',background:lead.status===s?'var(--accent)':'var(--bg3)',color:lead.status===s?'#0a0a0b':'var(--muted)',border:`1px solid ${lead.status===s?'var(--accent)':'var(--border)'}`}}>{s}</button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          {['pitch','analysis','sequence','notes'].map(t=>(
            <button key={t} onClick={()=>setDtab(t)} style={{flex:1,padding:'9px 4px',fontSize:11,fontWeight:dtab===t?600:400,color:dtab===t?'var(--text)':'var(--muted)',background:'transparent',border:'none',borderBottom:`2px solid ${dtab===t?'var(--accent)':'transparent'}`,cursor:'pointer',textTransform:'capitalize'}}>{t}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{flex:1,padding:18,overflowY:'auto'}}>
          {dtab==='pitch'&&(
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {pitch.subject?(
                <>
                  <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'9px 12px',fontSize:13,fontWeight:600}}>{pitch.subject}</div>
                  <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',height:200}}>
                    <iframe srcDoc={`<html><body style="font-family:sans-serif;font-size:14px;color:#1a1a1a;padding:16px;line-height:1.8;margin:0">${(pitch.body||'').replace(/\n/g,'<br>')}</body></html>`} style={{width:'100%',height:'100%',border:'none'}} title="Pitch preview"/>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={sendNow} disabled={sending} style={{flex:1,padding:'9px',borderRadius:6,border:'none',background:'var(--accent)',color:'#0a0a0b',fontWeight:700,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:6,opacity:sending?0.5:1}}>
                      {sending?<><Spinner/>Sending...</>:'✉ Send Educational Email'}
                    </button>
                    <button onClick={startSeq} disabled={sending} style={{flex:1,padding:'9px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',cursor:'pointer',fontSize:12,opacity:sending?0.5:1}}>
                      🚀 Start 30-Email Sequence
                    </button>
                  </div>
                  {sendMsg&&<div style={{padding:'9px 12px',borderRadius:6,fontSize:12,background:sendMsg.t==='success'?'rgba(74,222,128,.1)':'rgba(248,113,113,.1)',color:sendMsg.t==='success'?'var(--green)':'var(--red)',lineHeight:1.6}}>{sendMsg.m}</div>}
                </>
              ):(
                <div style={{padding:24,textAlign:'center',color:'var(--muted)',fontSize:13,lineHeight:1.8}}>
                  {lead.status==='processing'?<><Spinner/> Still processing — extracting email and generating content...</>
                  :lead.status==='no_email'?'No quality email found. Add one manually using the Edit button above.'
                  :'No pitch generated. Set your Anthropic API key in Settings, then click "Regenerate Report" in the Report tab.'}
                </div>
              )}
            </div>
          )}
          {dtab==='analysis'&&(
            <div>
              {analysis.score!=null&&(
                <div style={{marginBottom:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>Health score (hard cap: 50/100)</span>
                    <span style={{fontSize:12,fontWeight:700,color:analysis.score>=40?'var(--amber)':analysis.score>=25?'var(--amber)':'var(--red)'}}>{analysis.score}/100</span>
                  </div>
                  <div style={{height:7,background:'var(--bg3)',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${analysis.score*2}%`,background:analysis.score>=40?'var(--amber)':'var(--red)',borderRadius:4,transition:'width .5s'}}/>
                  </div>
                  <div style={{fontSize:11,color:'var(--dim)',marginTop:4}}>Every store is capped at 50% — reflects real untapped revenue potential</div>
                </div>
              )}
              {(analysis.strengths||[]).length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:'var(--green)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8,fontWeight:600}}>✓ What's working ({analysis.strengths.length})</div>
                  {analysis.strengths.map((s,i)=><div key={i} style={{fontSize:12,padding:'5px 0',borderBottom:'1px solid var(--border)',display:'flex',gap:8,color:'var(--muted)',lineHeight:1.5}}><span style={{color:'var(--green)',flexShrink:0}}>✓</span>{s}</div>)}
                </div>
              )}
              {(analysis.issues||[]).length>0&&(
                <div>
                  <div style={{fontSize:11,color:'var(--amber)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8,fontWeight:600}}>⚠ Issues found ({analysis.issues.length}) — see full report</div>
                  {analysis.issues.map((s,i)=><div key={i} style={{fontSize:12,padding:'5px 0',borderBottom:'1px solid var(--border)',display:'flex',gap:8,color:'var(--muted)',lineHeight:1.5}}><span style={{color:'var(--amber)',flexShrink:0}}>→</span>{s.split(' — ')[0]}</div>)}
                </div>
              )}
            </div>
          )}
          {dtab==='sequence'&&<SequenceTimeline leadId={lead.id}/>}
          {dtab==='notes'&&(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={8} placeholder="Notes — call outcomes, what they said, follow-up reminders, custom context..."
                style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'10px 12px',color:'var(--text)',fontSize:13,lineHeight:1.7,resize:'vertical',outline:'none'}}/>
              <button onClick={saveNotes} style={{alignSelf:'flex-start',padding:'8px 18px',borderRadius:6,border:'none',background:'var(--accent)',color:'#0a0a0b',fontWeight:700,cursor:'pointer'}}>
                Save Notes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Lead row ──────────────────────────────────────────────────────────────────
function LeadRow({ lead, selected, onSelect, onClick }) {
  const sc = STATUS_COLOR
  return (
    <div onClick={onClick} style={{display:'grid',gridTemplateColumns:'32px 2.2fr 85px 1.8fr 55px 90px',alignItems:'center',gap:8,padding:'9px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}}
      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <input type="checkbox" checked={selected} onChange={e=>{e.stopPropagation();onSelect(lead.id,e.target.checked)}} onClick={e=>e.stopPropagation()} style={{cursor:'pointer',accentColor:'var(--accent)'}}/>
      <div style={{minWidth:0}}>
        <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.store_name||lead.store_url}</div>
        <div style={{fontSize:11,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.store_url.replace('https://','').replace('http://','').split('/')[0]}{lead.niche?' · '+lead.niche:''}</div>
      </div>
      <span style={{fontSize:11,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:4,padding:'2px 6px',color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'center'}}>{lead.platform||'—'}</span>
      <div style={{fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:lead.owner_email?'var(--text)':'var(--dim)',display:'flex',alignItems:'center',gap:5}}>
        {lead.owner_email?<>✉ {lead.owner_email}{lead.reply_received?<span style={{color:'var(--green)',fontSize:11}}>↩</span>:null}</>:'—'}
      </div>
      <div style={{fontSize:12,fontWeight:700,textAlign:'center',color:lead.score>=40?'var(--amber)':lead.score>0?'var(--red)':'var(--dim)'}}>{lead.score>0?`${lead.score}%`:'—'}</div>
      <span style={{fontSize:11,padding:'3px 8px',borderRadius:20,background:`${sc[lead.status]||'var(--muted)'}18`,color:sc[lead.status]||'var(--muted)',border:`1px solid ${sc[lead.status]||'var(--border)'}40`,textAlign:'center',whiteSpace:'nowrap'}}>{lead.status}</span>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({label,value,color,sub}) {
  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px'}}>
      <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4}}>{label}</div>
      <div style={{fontSize:20,fontWeight:800,color:color||'var(--text)',lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>{sub}</div>}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [authState, setAuthState] = useState('checking') // 'checking' | 'logged_in' | 'skipped'
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('leads')
  const [leads, setLeads] = useState([])
  const [stats, setStats] = useState({})
  const [campaigns, setCampaigns] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCamp, setFilterCamp] = useState('')
  const [search, setSearch] = useState('')
  const [selIds, setSelIds] = useState(new Set())
  const [selLead, setSelLead] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [toasts, setToasts] = useState([])

  const addToast = (msg, type='info') => {
    const id = Date.now(); setToasts(t=>[...t,{id,msg,type}])
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500)
  }

  // Auth initialization
  useEffect(() => {
    // Check for token in URL (from Google OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken = urlParams.get('token')
    if (urlToken) {
      setToken(urlToken)
      window.history.replaceState({}, '', window.location.pathname)
    }
    const token = getToken()
    if (!token) { setAuthState('skipped'); return }
    authFetch(`${API}/auth/me`).then(r => r.json()).then(d => {
      if (d.id) { setUser(d); setAuthState('logged_in') }
      else { clearToken(); setAuthState('skipped') }
    }).catch(() => setAuthState('skipped'))
  }, [])

  function handleSignOut() {
    clearToken(); setUser(null); setAuthState('skipped')
    addToast('Signed out', 'info')
  }

  const fetchLeads = useCallback(async()=>{
    const p = new URLSearchParams()
    if (filterStatus!=='all') p.set('status',filterStatus)
    if (search) p.set('search',search)
    if (filterCamp) p.set('campaign',filterCamp)
    try { const r=await fetch(`${API}/leads?${p}`); const d=await r.json(); setLeads(Array.isArray(d)?d:[]) } catch{}
  },[filterStatus,search,filterCamp])

  const fetchStats = useCallback(async()=>{ try{ const r=await fetch(`${API}/stats`); setStats(await r.json()) }catch{} },[])
  const fetchCampaigns = useCallback(async()=>{ try{ const r=await fetch(`${API}/campaigns`); setCampaigns(await r.json()) }catch{} },[])

  useEffect(()=>{ fetchLeads(); fetchStats(); fetchCampaigns() },[fetchLeads,fetchStats,fetchCampaigns])
  useInterval(()=>{ if(scraping){ fetchLeads(); fetchStats() } },3000)

  const prevInProg = useRef(0)
  useEffect(()=>{
    const n = leads.filter(l=>['processing','analysed'].includes(l.status)).length
    if (prevInProg.current>0 && n===0 && leads.length>0) {
      setScraping(false); fetchStats(); fetchCampaigns()
      const ready = leads.filter(l=>l.status==='ready').length
      addToast(`Processing complete — ${ready} leads ready`,'success')
    }
    prevInProg.current = n
  },[leads])

  async function startSearch({query, limit, campaign, filters}) {
    setSearchLoading(true); setScraping(true)
    try {
      const r = await fetch(`${API}/scrape`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,limit,campaign,filters})})
      const d = await r.json(); addToast(d.message||`Searching for ${limit} stores...`,'info')
    } catch(e) { addToast('Error starting search','error') }
    setSearchLoading(false); setTab('leads')
    setTimeout(()=>{fetchLeads();fetchStats()},1500)
  }

  function sel(id,checked) { setSelIds(p=>{const n=new Set(p);checked?n.add(id):n.delete(id);return n}) }
  function selAll() { setSelIds(selIds.size===leads.length&&leads.length>0?new Set():new Set(leads.map(l=>l.id))) }

  async function bulkAction(action) {
    if (!selIds.size) return
    const ids=[...selIds]
    await fetch(`${API}/bulk-action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lead_ids:ids,action})})
    if (action==='delete'){setLeads(p=>p.filter(l=>!selIds.has(l.id)));addToast(`Deleted ${ids.length} leads`,'success')}
    else if (action==='start_sequence') addToast(`Started sequence for ${ids.length} leads`,'success')
    else if (action==='mark_contacted'){ setLeads(p=>p.map(l=>selIds.has(l.id)?{...l,status:'contacted'}:l)); addToast(`Marked ${ids.length} as contacted`,'info') }
    setSelIds(new Set()); fetchStats()
  }

  function updateLead(id, changes) {
    setLeads(p=>p.map(l=>l.id===id?{...l,...changes}:l))
    if (selLead?.id===id) setSelLead(l=>({...l,...changes}))
    fetchStats()
  }

  const inProg = leads.filter(l=>['processing','analysed'].includes(l.status)).length
  const newReplies = stats.new_replies||0
  const openRate = stats.emails_sent>0?Math.round((stats.emails_opened||0)/stats.emails_sent*100):0

  const TABS = [
    {id:'leads', label:`Leads${leads.length>0?' ('+leads.length+')':''}`},
    {id:'upload', label:'➕ Add URLs'},
    {id:'search', label:'🔍 Search'},
    {id:'inbox',  label:`📬 Inbox${newReplies>0?' 🔴'+newReplies:''}`},
    {id:'analytics', label:'📊 Analytics'},
  ]

  if (authState === 'checking') return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)',color:'var(--muted)',fontSize:14}}>
      <Spinner /> &nbsp; Loading...
    </div>
  )

  if (authState === 'skipped' && !getToken()) {
    // Only show login page on first load, not after logout
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} * { box-sizing: border-box; }`}</style>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px',height:50,borderBottom:'1px solid var(--border)',background:'var(--bg2)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{fontSize:18,fontWeight:800}}>⚡ <span style={{color:'var(--accent)'}}>Out</span>Reach</div>
          <div style={{width:1,height:16,background:'var(--border)'}}/>
          <div style={{display:'flex',gap:2}}>
            {TABS.map(({id,label})=>(
              <button key={id} onClick={()=>setTab(id)} style={{padding:'4px 12px',borderRadius:6,fontSize:12,fontWeight:tab===id?600:400,background:tab===id?'var(--bg3)':'transparent',color:tab===id?'var(--text)':'var(--muted)',border:`1px solid ${tab===id?'var(--border)':'transparent'}`,cursor:'pointer'}}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {(scraping||inProg>0)&&<div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--blue)'}}><Spinner/>{inProg} processing...</div>}
          <a href={`${API}/export-csv`} download style={{textDecoration:'none'}}>
            <button style={{padding:'5px 11px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',cursor:'pointer',fontSize:12}}>⬇ CSV</button>
          </a>
          <button onClick={()=>setShowSettings(true)} style={{padding:'5px 11px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',cursor:'pointer',fontSize:12}}>⚙ Settings</button>
          {user ? (
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              {user.avatar_url && <img src={user.avatar_url} alt="" style={{width:26,height:26,borderRadius:'50%',objectFit:'cover'}}/>}
              <span style={{fontSize:12,color:'var(--muted)',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.name||user.email}</span>
              <button onClick={handleSignOut} style={{padding:'3px 8px',borderRadius:5,border:'1px solid var(--border)',background:'none',color:'var(--dim)',cursor:'pointer',fontSize:11}}>Sign out</button>
            </div>
          ) : (
            <a href={`${API}/auth/google`} style={{textDecoration:'none'}}>
              <button style={{padding:'5px 11px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',cursor:'pointer',fontSize:12}}>🔐 Sign in</button>
            </a>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(9,1fr)',gap:6,padding:'8px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <StatCard label="Total" value={stats.total||0}/>
        <StatCard label="With Email" value={stats.with_email||0} color="var(--blue)"/>
        <StatCard label="Ready" value={stats.ready||0} color="var(--accent)"/>
        <StatCard label="Contacted" value={stats.contacted||0} color="var(--amber)"/>
        <StatCard label="Replied" value={stats.replied||0} color="var(--green)"/>
        <StatCard label="Converted" value={stats.converted||0} color="var(--accent)"/>
        <StatCard label="Emails Sent" value={stats.emails_sent||0}/>
        <StatCard label="Open Rate" value={`${openRate}%`} color={openRate>30?'var(--green)':openRate>10?'var(--amber)':'var(--muted)'}/>
        <StatCard label="New Replies" value={newReplies} color={newReplies>0?'var(--accent)':'var(--muted)'}/>
      </div>

      {/* Main content */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>

        {/* ADD URLs TAB */}
        {tab==='upload'&&(
          <div style={{flex:1,overflowY:'auto'}}>
            <UploadPanel addToast={addToast} onDone={()=>{fetchLeads();fetchStats();setTab('leads')}}/>
          </div>
        )}

        {/* SEARCH TAB */}
        {tab==='search'&&(
          <div style={{flex:1,overflowY:'auto'}}>
            <SearchPanel addToast={addToast} onStart={startSearch} loading={searchLoading} campaigns={campaigns}/>
          </div>
        )}

        {/* INBOX TAB */}
        {tab==='inbox'&&(
          <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <InboxTab addToast={addToast}/>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab==='analytics'&&(
          <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <AnalyticsTab/>
          </div>
        )}

        {/* LEADS TAB */}
        {tab==='leads'&&(
          <>
            {/* Filters bar */}
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',borderBottom:'1px solid var(--border)',flexShrink:0,flexWrap:'wrap'}}>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'var(--muted)',fontSize:12}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search stores..."
                  style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 10px 6px 28px',color:'var(--text)',width:190,fontSize:12,outline:'none'}}/>
              </div>
              <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                {['all','ready','new','contacted','replied','converted','no_email','error'].map(s=>(
                  <button key={s} onClick={()=>setFilterStatus(s)} style={{padding:'3px 9px',borderRadius:20,fontSize:11,cursor:'pointer',fontWeight:filterStatus===s?700:400,background:filterStatus===s?'var(--accent)':'var(--bg3)',color:filterStatus===s?'#0a0a0b':'var(--muted)',border:`1px solid ${filterStatus===s?'var(--accent)':'var(--border)'}`}}>{s}</button>
                ))}
              </div>
              {campaigns.length>0&&(
                <select value={filterCamp} onChange={e=>setFilterCamp(e.target.value)} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 9px',color:filterCamp?'var(--text)':'var(--muted)',fontSize:12,outline:'none'}}>
                  <option value="">All campaigns</option>
                  {campaigns.map(c=><option key={c.campaign} value={c.campaign}>{c.campaign} ({c.count})</option>)}
                </select>
              )}
              <div style={{flex:1}}/>
              {selIds.size>0&&(
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <span style={{fontSize:12,color:'var(--accent)',fontWeight:600}}>{selIds.size} selected</span>
                  <button onClick={()=>bulkAction('start_sequence')} style={{padding:'4px 10px',borderRadius:5,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',cursor:'pointer',fontSize:11}}>🚀 Start Sequence</button>
                  <button onClick={()=>bulkAction('mark_contacted')} style={{padding:'4px 10px',borderRadius:5,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',cursor:'pointer',fontSize:11}}>✉ Mark Contacted</button>
                  <button onClick={()=>bulkAction('delete')} style={{padding:'4px 10px',borderRadius:5,border:'1px solid rgba(248,113,113,.3)',background:'rgba(248,113,113,.08)',color:'var(--red)',cursor:'pointer',fontSize:11}}>🗑 Delete</button>
                </div>
              )}
              <button onClick={()=>{fetchLeads();fetchStats()}} title="Refresh" style={{padding:'5px 9px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--muted)',cursor:'pointer',fontSize:12}}>↺</button>
            </div>

            {/* Table header */}
            <div style={{display:'grid',gridTemplateColumns:'32px 2.2fr 85px 1.8fr 55px 90px',gap:8,padding:'5px 14px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
              <input type="checkbox" checked={selIds.size===leads.length&&leads.length>0} onChange={selAll} style={{cursor:'pointer',accentColor:'var(--accent)'}}/>
              {['Store','Platform','Email','Score','Status'].map(h=>(
                <div key={h} style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</div>
              ))}
            </div>

            {/* Leads list */}
            <div style={{flex:1,overflowY:'auto'}}>
              {leads.length===0?(
                <div style={{padding:60,textAlign:'center',color:'var(--muted)'}}>
                  <div style={{fontSize:40,marginBottom:14}}>⚡</div>
                  <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:8}}>No leads yet</div>
                  <div style={{fontSize:13,marginBottom:20,lineHeight:1.7}}>Add stores two ways:</div>
                  <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                    <button onClick={()=>setTab('upload')} style={{padding:'10px 20px',borderRadius:8,border:'none',background:'var(--accent)',color:'#0a0a0b',fontWeight:700,cursor:'pointer',fontSize:14}}>
                      ➕ Add URLs
                    </button>
                    <button onClick={()=>setTab('search')} style={{padding:'10px 20px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',cursor:'pointer',fontSize:14}}>
                      🔍 Search for Stores
                    </button>
                  </div>
                </div>
              ):leads.map(lead=>(
                <LeadRow key={lead.id} lead={lead} selected={selIds.has(lead.id)} onSelect={sel} onClick={()=>setSelLead(lead)}/>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {selLead&&<LeadDetail lead={selLead} onClose={()=>setSelLead(null)} onUpdate={updateLead} addToast={addToast}/>}
      {showSettings&&<SettingsModal onClose={()=>setShowSettings(false)} addToast={addToast}/>}
      <Toasts list={toasts} remove={id=>setToasts(t=>t.filter(x=>x.id!==id))}/>
    </div>
  )
}
