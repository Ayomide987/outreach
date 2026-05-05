// Module 4 — LeadForge Analytics Dashboard
// Full standalone dashboard with all KPIs, charts, pipeline, inbox, scheduler

import { useState, useEffect, useCallback, useRef } from 'react'

const API = '/api'

const SEQ_LABEL = {
  1:'Initial pitch',2:'Day 3',3:'Day 7',4:'Day 14',5:'Day 21',
  6:'Month 1',7:'Month 2',8:'Month 3',9:'Month 4.5',10:'Month 6',
  11:'Month 7.5',12:'Month 9',13:'Month 10.5',14:'Year 1'
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const I = {
  chart: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  trend: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  mail: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  eye: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  users: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  zap: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  clock: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  download: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  inbox: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  star: <svg width="12" height="12" fill="currentColor" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  refresh: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
  ext: <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  calendar: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
}

function Spinner() {
  return <div className="spin" style={{ width:14, height:14, border:'2px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%', flexShrink:0 }} />
}

// ── Micro bar chart ───────────────────────────────────────────────────────────
function MiniBar({ value, max, color = 'var(--accent)', height = 6 }) {
  const pct = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0
  return (
    <div style={{ height, background:'var(--bg3)', borderRadius:3, overflow:'hidden', flex:1 }}>
      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width .6s ease' }} />
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, color, icon, trend }) {
  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.07em' }}>{label}</div>
        {icon && <span style={{ color:'var(--muted)', opacity:.6 }}>{icon}</span>}
      </div>
      <div className="syne" style={{ fontSize:26, fontWeight:700, color:color||'var(--text)', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ fontSize:11, marginTop:5, color: trend > 0 ? 'var(--green)' : trend < 0 ? 'var(--red)' : 'var(--muted)' }}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
}

// ── Simple sparkline ──────────────────────────────────────────────────────────
function Sparkline({ data, color = 'var(--accent)', height = 48, width = 180 }) {
  if (!data || data.length < 2) return <div style={{ height, width, background:'var(--bg3)', borderRadius:6 }} />
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - (v / max) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={color} fillOpacity=".08" stroke="none" />
    </svg>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon, action, children, loading }) {
  return (
    <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ color:'var(--muted)' }}>{icon}</span>
          <span className="syne" style={{ fontSize:13, fontWeight:700 }}>{title}</span>
          {loading && <Spinner />}
        </div>
        {action}
      </div>
      <div style={{ padding:'14px 18px' }}>{children}</div>
    </div>
  )
}

// ── Export button ─────────────────────────────────────────────────────────────
function ExportBtn({ dataset, label }) {
  return (
    <a href={`${API}/analytics/export/${dataset}`} style={{ textDecoration:'none' }}>
      <button style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:5, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}
        onMouseEnter={e=>{e.target.style.color='var(--text)';e.target.style.borderColor='var(--border2)'}}
        onMouseLeave={e=>{e.target.style.color='var(--muted)';e.target.style.borderColor='var(--border)'}}>
        {I.download} {label}
      </button>
    </a>
  )
}

// ── Main Module 4 Component ───────────────────────────────────────────────────
export default function Analytics4() {
  const [view, setView] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [seqPerf, setSeqPerf] = useState([])
  const [daily, setDaily] = useState(null)
  const [topLeads, setTopLeads] = useState([])
  const [inbox, setInbox] = useState([])
  const [scheduled, setScheduled] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, camp, seq, day, top, inb, sch, sub] = await Promise.all([
        fetch(`${API}/analytics/overview`).then(r=>r.json()).catch(()=>null),
        fetch(`${API}/analytics/campaigns`).then(r=>r.json()).catch(()=>[]),
        fetch(`${API}/analytics/sequence-performance`).then(r=>r.json()).catch(()=>[]),
        fetch(`${API}/analytics/daily-activity?days=30`).then(r=>r.json()).catch(()=>null),
        fetch(`${API}/analytics/top-leads?limit=15`).then(r=>r.json()).catch(()=>[]),
        fetch(`${API}/analytics/inbox?limit=40`).then(r=>r.json()).catch(()=>[]),
        fetch(`${API}/analytics/scheduled?days=30`).then(r=>r.json()).catch(()=>[]),
        fetch(`${API}/analytics/subject-performance`).then(r=>r.json()).catch(()=>[]),
      ])
      setOverview(ov); setCampaigns(camp); setSeqPerf(seq); setDaily(day)
      setTopLeads(top); setInbox(inb); setScheduled(sch); setSubjects(sub)
      setLastRefresh(new Date())
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const ov = overview
  const pl = ov?.pipeline || {}
  const em = ov?.emails || {}
  const rates = ov?.rates || {}
  const leads = ov?.leads || {}

  // Build daily chart data
  const dailySends = daily?.sends || []
  const dailyOpens = daily?.opens || []
  const dailyNew = daily?.new_leads || []

  // Merge all dates
  const allDays = [...new Set([...dailySends.map(d=>d.day), ...dailyOpens.map(d=>d.day), ...dailyNew.map(d=>d.day)])].sort().slice(-30)
  const sendMap = Object.fromEntries(dailySends.map(d=>[d.day,d.count]))
  const openMap = Object.fromEntries(dailyOpens.map(d=>[d.day,d.count]))
  const newMap = Object.fromEntries(dailyNew.map(d=>[d.day,d.count]))

  const chartData = allDays.map(day => ({
    day, sends: sendMap[day]||0, opens: openMap[day]||0, new: newMap[day]||0
  }))

  const navItems = [
    { id:'overview', label:'Overview', icon:I.chart },
    { id:'campaigns', label:'Campaigns', icon:I.users },
    { id:'pipeline', label:'Pipeline', icon:I.trend },
    { id:'sequence', label:'Sequence Stats', icon:I.zap },
    { id:'inbox', label:'Activity Feed', icon:I.inbox },
    { id:'scheduled', label:'Scheduled', icon:I.calendar },
    { id:'subjects', label:'Subject Lines', icon:I.star },
    { id:'exports', label:'Export Centre', icon:I.download },
  ]

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* Sidebar nav */}
      <div style={{ width:180, flexShrink:0, borderRight:'1px solid var(--border)', background:'var(--bg2)', padding:'14px 0', display:'flex', flexDirection:'column', gap:2 }}>
        <div className="syne" style={{ fontSize:12, fontWeight:700, padding:'0 14px 12px', borderBottom:'1px solid var(--border)', marginBottom:8, color:'var(--accent)' }}>
          Analytics
        </div>
        {navItems.map(item => (
          <button key={item.id} onClick={()=>setView(item.id)}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background: view===item.id ? 'var(--accent-dim2)' : 'transparent', color: view===item.id ? 'var(--accent)' : 'var(--muted)', borderLeft: view===item.id ? '2px solid var(--accent)' : '2px solid transparent', border:'none', borderLeft: view===item.id ? '2px solid var(--accent)' : '2px solid transparent', cursor:'pointer', fontSize:12, fontWeight: view===item.id ? 500 : 400, width:'100%', textAlign:'left', fontFamily:'inherit' }}>
            {item.icon} {item.label}
          </button>
        ))}
        <div style={{ flex:1 }} />
        <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)', fontSize:10, color:'var(--dim)' }}>
          {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Loading...'}
          <button onClick={fetchAll} style={{ display:'flex', alignItems:'center', gap:4, marginTop:6, background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', padding:'4px 8px', borderRadius:4, cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>
            {I.refresh} Refresh
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, overflowY:'auto', padding:20 }}>

        {/* ── OVERVIEW ── */}
        {view === 'overview' && (
          <div>
            <div className="syne" style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Dashboard Overview</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:18 }}>All-time performance across your entire LeadForge account</div>

            {/* Top KPIs */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
              <KPI label="Total Leads" value={leads.total||0} icon={I.users} sub={`${leads.email_rate||0}% have confirmed emails`} />
              <KPI label="Emails Sent" value={em.sent||0} icon={I.mail} sub={`${em.pending||0} queued to send`} />
              <KPI label="Open Rate" value={`${rates.open_rate||0}%`} color={rates.open_rate>30?'var(--green)':rates.open_rate>15?'var(--amber)':'var(--muted)'} icon={I.eye} sub={`${em.total_opens||0} total opens`} />
              <KPI label="Converted" value={pl.converted||0} color="var(--accent)" icon={I.zap} sub={`${rates.conv_rate||0}% conv. rate`} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
              <KPI label="With Email" value={leads.with_email||0} color="var(--blue)" sub="Confirmed addresses" />
              <KPI label="Contacted" value={pl.contacted||0} color="var(--muted)" />
              <KPI label="Replied" value={pl.replied||0} color="var(--green)" sub={`${rates.reply_rate||0}% reply rate`} />
              <KPI label="Reports Made" value={leads.reports||0} color="var(--amber)" sub="Branded PDFs" />
            </div>

            {/* Funnel */}
            <Section title="Conversion Funnel" icon={I.trend} loading={loading}>
              {[
                { label:'Leads found', val:leads.total||0, color:'var(--muted)' },
                { label:'With confirmed email', val:leads.with_email||0, color:'var(--blue)' },
                { label:'Contacted', val:pl.contacted||0, color:'#a78bfa' },
                { label:'Replied', val:pl.replied||0, color:'var(--amber)' },
                { label:'Converted', val:pl.converted||0, color:'var(--accent)' },
              ].map(({ label, val, color }) => {
                const pct = (leads.total||0) > 0 ? Math.round(val / leads.total * 100) : 0
                return (
                  <div key={label} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:13, color:'var(--muted)' }}>{label}</span>
                      <span style={{ fontSize:13, fontWeight:500 }}>{val.toLocaleString()} <span style={{ color:'var(--dim)', fontSize:11 }}>({pct}%)</span></span>
                    </div>
                    <MiniBar value={val} max={leads.total||1} color={color} height={7} />
                  </div>
                )
              })}
            </Section>

            {/* Activity chart */}
            {chartData.length > 0 && (
              <Section title="30-Day Activity" icon={I.chart} loading={loading}>
                <div style={{ display:'flex', gap:16, marginBottom:12 }}>
                  {[['Sends','var(--blue)',chartData.map(d=>d.sends)],['Opens','var(--accent)',chartData.map(d=>d.opens)],['New Leads','var(--green)',chartData.map(d=>d.new)]].map(([label,color,data])=>(
                    <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:10, height:3, background:color, borderRadius:2 }}/>
                      <span style={{ fontSize:11, color:'var(--muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
                {/* Chart grid */}
                <div style={{ position:'relative', height:120, background:'var(--bg3)', borderRadius:8, padding:'12px 14px', overflow:'hidden' }}>
                  {/* Grid lines */}
                  {[0,25,50,75,100].map(pct => (
                    <div key={pct} style={{ position:'absolute', left:0, right:0, top:`${100-pct}%`, borderTop:'1px solid var(--border)', opacity:.4 }}/>
                  ))}
                  {/* Bars */}
                  <div style={{ display:'flex', alignItems:'flex-end', height:'100%', gap:2 }}>
                    {chartData.map((d,i) => {
                      const maxVal = Math.max(...chartData.map(x=>x.sends+x.opens+x.new), 1)
                      return (
                        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', gap:1, height:'100%' }} title={`${d.day}: ${d.sends} sent, ${d.opens} opened, ${d.new} new`}>
                          <div style={{ width:'100%', background:'var(--green)', opacity:.7, borderRadius:'1px 1px 0 0', height:`${(d.new/maxVal)*100}%`, minHeight: d.new>0?2:0 }}/>
                          <div style={{ width:'100%', background:'var(--accent)', opacity:.8, height:`${(d.opens/maxVal)*100}%`, minHeight: d.opens>0?2:0 }}/>
                          <div style={{ width:'100%', background:'var(--blue)', opacity:.7, height:`${(d.sends/maxVal)*100}%`, minHeight: d.sends>0?2:0 }}/>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {/* Date labels */}
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:10, color:'var(--dim)' }}>
                  {[chartData[0]?.day, chartData[Math.floor(chartData.length/2)]?.day, chartData[chartData.length-1]?.day].filter(Boolean).map(d=>(
                    <span key={d}>{d?.slice(5)}</span>
                  ))}
                </div>
              </Section>
            )}

            {/* Next 7 days */}
            <div style={{ padding:'12px 16px', background:'var(--accent-dim2)', border:'1px solid var(--accent-dim)', borderRadius:8, fontSize:13 }}>
              <span style={{ color:'var(--accent)', fontWeight:500 }}>{em.next_7d||0} emails</span>
              <span style={{ color:'var(--muted)' }}> scheduled to send in the next 7 days — auto-sent by the scheduler</span>
            </div>
          </div>
        )}

        {/* ── CAMPAIGNS ── */}
        {view === 'campaigns' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
              <div>
                <div className="syne" style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Campaign Performance</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>{campaigns.length} campaigns tracked</div>
              </div>
              <ExportBtn dataset="all-leads" label="Export leads" />
            </div>
            {campaigns.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontSize:13 }}>No campaigns yet — run a search to create your first campaign</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {campaigns.map(c => {
                  const replyRate = c.contacted > 0 ? Math.round(c.replied / c.contacted * 100) : 0
                  const convRate = c.contacted > 0 ? Math.round(c.converted / c.contacted * 100) : 0
                  return (
                    <div key={c.campaign} className="card" style={{ padding:'16px 18px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                        <div>
                          <div className="syne" style={{ fontSize:14, fontWeight:700 }}>{c.campaign}</div>
                          <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                            {c.total} leads · avg score {c.avg_score||0}/100 · started {c.first_lead?.slice(0,10)}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:16, textAlign:'center' }}>
                          {[['Leads',c.total,'var(--text)'],['Emails',c.emails_sent,'var(--blue)'],['Open %',`${c.open_rate}%`,'var(--accent)'],['Replied',c.replied,'var(--green)'],['Converted',c.converted,'var(--accent)']].map(([l,v,col])=>(
                            <div key={l}>
                              <div className="syne" style={{ fontSize:17, fontWeight:700, color:col }}>{v}</div>
                              <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Mini funnel */}
                      <div style={{ display:'flex', gap:3, alignItems:'flex-end', height:24 }}>
                        {[
                          [c.total,'var(--muted)','Total'],
                          [c.with_email,'var(--blue)','Email'],
                          [c.contacted,'#a78bfa','Contacted'],
                          [c.replied,'var(--amber)','Replied'],
                          [c.converted,'var(--accent)','Converted'],
                        ].map(([val,color,label],i)=>{
                          const pct = c.total > 0 ? Math.max(4, Math.round(val/c.total*100)) : 4
                          return (
                            <div key={i} title={`${label}: ${val}`} style={{ flex:1, display:'flex', flexDirection:'column', gap:2, alignItems:'center' }}>
                              <div style={{ height:`${pct}%`, minHeight:4, width:'100%', background:color, borderRadius:2, opacity:.8 }} />
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ display:'flex', gap:12, marginTop:8 }}>
                        <span style={{ fontSize:11, color:'var(--muted)' }}>Reply rate: <strong style={{ color:'var(--text)' }}>{replyRate}%</strong></span>
                        <span style={{ fontSize:11, color:'var(--muted)' }}>Conversion rate: <strong style={{ color:'var(--text)' }}>{convRate}%</strong></span>
                        <span style={{ fontSize:11, color:'var(--muted)' }}>Open rate: <strong style={{ color:'var(--text)' }}>{c.open_rate}%</strong></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PIPELINE ── */}
        {view === 'pipeline' && (
          <div>
            <div className="syne" style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Lead Pipeline</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:18 }}>Visual kanban view of where every lead stands</div>

            {/* Pipeline columns */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20 }}>
              {[
                { status:'new', label:'New / Ready', color:'var(--muted)', count: pl.replied !== undefined ? (leads.total||0)-(pl.contacted||0)-(pl.replied||0)-(pl.converted||0) : 0 },
                { status:'contacted', label:'Contacted', color:'var(--blue)', count: pl.contacted||0 },
                { status:'replied', label:'Replied', color:'var(--amber)', count: pl.replied||0 },
                { status:'converted', label:'Converted', color:'var(--accent)', count: pl.converted||0 },
                { status:'unsubscribed', label:'Unsubscribed', color:'var(--red)', count: pl.unsubscribed||0 },
              ].map(col => (
                <div key={col.status} className="card" style={{ padding:'14px' }}>
                  <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--muted)', marginBottom:8 }}>{col.label}</div>
                  <div className="syne" style={{ fontSize:28, fontWeight:800, color:col.color, lineHeight:1 }}>{col.count}</div>
                  <MiniBar value={col.count} max={leads.total||1} color={col.color} height={4} />
                  <div style={{ fontSize:10, color:'var(--dim)', marginTop:6 }}>{leads.total>0?Math.round(col.count/leads.total*100):0}% of total</div>
                </div>
              ))}
            </div>

            {/* Top leads ready to convert */}
            <Section title="Top Leads — Highest Score, Not Yet Converted" icon={I.star} loading={loading} action={<ExportBtn dataset="all-leads" label="Export"/>}>
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                {topLeads.length === 0 ? (
                  <div style={{ textAlign:'center', padding:24, color:'var(--muted)', fontSize:13 }}>No leads found yet — run a search first</div>
                ) : topLeads.map(lead => (
                  <div key={lead.id} style={{ display:'grid', gridTemplateColumns:'2fr 80px 1.5fr 60px 80px', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.store_name||lead.store_url}</div>
                      <div style={{ fontSize:11, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.owner_email}</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <span style={{ fontSize:12, fontWeight:700, color: lead.score>=60?'var(--green)':lead.score>=40?'var(--amber)':'var(--red)' }}>{lead.score}%</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.platform} · {lead.country}</div>
                    <div style={{ fontSize:11, color:'var(--blue)' }}>{lead.email_confidence}% conf</div>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, textAlign:'center', background: lead.status==='contacted'?'var(--blue-dim)':lead.status==='replied'?'var(--green-dim)':'var(--bg3)', color: lead.status==='contacted'?'var(--blue)':lead.status==='replied'?'var(--green)':'var(--muted)', border:'1px solid var(--border)' }}>
                      {lead.status}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── SEQUENCE STATS ── */}
        {view === 'sequence' && (
          <div>
            <div className="syne" style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Email Sequence Performance</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:18 }}>How each of your 14 sequence steps is performing across all leads</div>

            {seqPerf.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontSize:13 }}>No emails sent yet — start a sequence to see stats here</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {/* Header */}
                <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 80px 80px 80px 80px', gap:10, padding:'8px 12px', borderBottom:'1px solid var(--border)' }}>
                  {['Step','Open Rate Bar','Sent','Opened','Pending','Cancelled'].map(h=>(
                    <div key={h} style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</div>
                  ))}
                </div>
                {seqPerf.map(step => {
                  const maxSent = Math.max(...seqPerf.map(s=>s.sent), 1)
                  const rateColor = step.open_rate >= 40 ? 'var(--green)' : step.open_rate >= 20 ? 'var(--accent)' : step.open_rate >= 10 ? 'var(--amber)' : 'var(--red)'
                  return (
                    <div key={step.step} style={{ display:'grid', gridTemplateColumns:'140px 1fr 80px 80px 80px 80px', gap:10, padding:'10px 12px', borderBottom:'1px solid var(--border)', alignItems:'center' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:500 }}>{SEQ_LABEL[step.step]||`Step ${step.step}`}</div>
                        <div style={{ fontSize:10, color:rateColor, fontWeight:600, marginTop:1 }}>{step.open_rate}% open rate</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <MiniBar value={step.opened} max={step.sent||1} color={rateColor} height={8} />
                        <span style={{ fontSize:11, color:'var(--dim)', minWidth:32 }}>{step.open_rate}%</span>
                      </div>
                      <div style={{ fontSize:13, textAlign:'center', fontWeight:500 }}>{step.sent}</div>
                      <div style={{ fontSize:13, textAlign:'center', color:'var(--green)' }}>{step.opened}</div>
                      <div style={{ fontSize:13, textAlign:'center', color:'var(--blue)' }}>{step.pending}</div>
                      <div style={{ fontSize:13, textAlign:'center', color:'var(--dim)' }}>{step.cancelled}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── INBOX / ACTIVITY FEED ── */}
        {view === 'inbox' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
              <div>
                <div className="syne" style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Activity Feed</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>All email events — sends, opens, replies, errors</div>
              </div>
            </div>
            {inbox.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontSize:13 }}>No activity yet — send your first email to see events here</div>
            ) : (
              <div className="card" style={{ overflow:'hidden' }}>
                {inbox.map(log => {
                  const eventColor = {
                    sent:'var(--blue)', opened:'var(--accent)', unsubscribed:'var(--red)',
                    error:'var(--red)', cancelled:'var(--dim)', sequence_cancelled:'var(--dim)'
                  }[log.event] || 'var(--muted)'
                  const eventIcon = {
                    sent: I.mail, opened: I.eye, error: '⚠', unsubscribed: '🚫', cancelled: I.clock
                  }[log.event] || '•'
                  return (
                    <div key={log.id} style={{ display:'flex', gap:12, padding:'11px 16px', borderBottom:'1px solid var(--border)', alignItems:'flex-start' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background: log.event==='opened'?'var(--accent-dim)':log.event==='sent'?'var(--blue-dim)':'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:eventColor }}>
                        {eventIcon}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <div>
                            <span style={{ fontSize:13, fontWeight:500, color:eventColor }}>{log.event}</span>
                            {log.store_name && <span style={{ fontSize:12, color:'var(--muted)', marginLeft:8 }}>{log.store_name}</span>}
                          </div>
                          <span style={{ fontSize:11, color:'var(--dim)', flexShrink:0, marginLeft:12 }}>
                            {log.created_at ? new Date(log.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}
                          </span>
                        </div>
                        {log.detail && <div style={{ fontSize:12, color:'var(--muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.detail}</div>}
                        {log.owner_email && <div style={{ fontSize:11, color:'var(--dim)', marginTop:1 }}>{log.owner_email}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SCHEDULED ── */}
        {view === 'scheduled' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
              <div>
                <div className="syne" style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Scheduled Emails</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>Next 30 days — {scheduled.length} emails queued to auto-send</div>
              </div>
              <ExportBtn dataset="email-stats" label="Export email stats" />
            </div>
            {scheduled.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontSize:13 }}>No emails scheduled — start a sequence to see the queue here</div>
            ) : (
              <>
                {/* Group by week */}
                {(() => {
                  const groups = {}
                  scheduled.forEach(s => {
                    const date = new Date(s.scheduled_at)
                    const week = `Week of ${date.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`
                    if (!groups[week]) groups[week] = []
                    groups[week].push(s)
                  })
                  return Object.entries(groups).slice(0, 8).map(([week, items]) => (
                    <div key={week} style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                        {I.calendar} {week} <span style={{ color:'var(--accent)', fontWeight:500 }}>({items.length} emails)</span>
                      </div>
                      <div className="card" style={{ overflow:'hidden' }}>
                        {items.slice(0,10).map(s => (
                          <div key={s.id} style={{ display:'grid', gridTemplateColumns:'120px 2fr 1.5fr 80px', gap:10, padding:'9px 14px', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
                            <div style={{ fontSize:11, color:'var(--blue)' }}>
                              {new Date(s.scheduled_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
                              <div style={{ fontSize:10, color:'var(--dim)' }}>{new Date(s.scheduled_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
                            </div>
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.store_name||s.store_url}</div>
                              <div style={{ fontSize:11, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.subject}</div>
                            </div>
                            <div style={{ fontSize:11, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.owner_email}</div>
                            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'var(--blue-dim)', color:'var(--blue)', textAlign:'center' }}>
                              {SEQ_LABEL[s.step]||`Step ${s.step}`}
                            </span>
                          </div>
                        ))}
                        {items.length > 10 && (
                          <div style={{ padding:'8px 14px', fontSize:12, color:'var(--dim)', textAlign:'center' }}>+{items.length-10} more this week</div>
                        )}
                      </div>
                    </div>
                  ))
                })()}
              </>
            )}
          </div>
        )}

        {/* ── SUBJECT LINE PERFORMANCE ── */}
        {view === 'subjects' && (
          <div>
            <div className="syne" style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Subject Line Performance</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:18 }}>Which subject lines are getting the most opens — sorted by open rate</div>

            {subjects.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontSize:13 }}>No data yet — send at least 2 emails with the same subject to see comparisons</div>
            ) : (
              <div className="card" style={{ overflow:'hidden' }}>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 100px 100px 70px 70px', gap:10, padding:'8px 14px', borderBottom:'1px solid var(--border)' }}>
                  {['Subject Line','Step','Open Rate','Sent','Opened'].map(h=>(
                    <div key={h} style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</div>
                  ))}
                </div>
                {subjects.map((s,i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 100px 100px 70px 70px', gap:10, padding:'11px 14px', borderBottom:'1px solid var(--border)', alignItems:'center' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.subject}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{SEQ_LABEL[s.step]||`Step ${s.step}`}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <MiniBar value={s.opened} max={s.sent} color={s.open_rate>=30?'var(--green)':s.open_rate>=15?'var(--accent)':'var(--amber)'} />
                      <span style={{ fontSize:12, fontWeight:600, color:s.open_rate>=30?'var(--green)':s.open_rate>=15?'var(--accent)':'var(--amber)', minWidth:36 }}>{s.open_rate}%</span>
                    </div>
                    <div style={{ fontSize:12, textAlign:'center' }}>{s.sent}</div>
                    <div style={{ fontSize:12, textAlign:'center', color:'var(--green)' }}>{s.opened}</div>
                  </div>
                ))}
              </div>
            )}

            {subjects.length > 0 && (
              <div style={{ marginTop:14, padding:14, background:'var(--accent-dim2)', border:'1px solid var(--accent-dim)', borderRadius:8, fontSize:13, color:'var(--muted)' }}>
                <strong style={{ color:'var(--accent)' }}>Tip:</strong> Subject lines above 30% open rate are performing excellently. Use these patterns for future campaigns. Subject lines below 10% should be revised.
              </div>
            )}
          </div>
        )}

        {/* ── EXPORT CENTRE ── */}
        {view === 'exports' && (
          <div>
            <div className="syne" style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Export Centre</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:20 }}>Download any dataset as a CSV file. Opens immediately in Excel.</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { dataset:'all-leads', title:'All Leads', desc:'Every lead with URL, email, platform, country, score, campaign, status, and notes', icon:I.users, color:'var(--blue)' },
                { dataset:'converted', title:'Converted Clients', desc:'All leads marked as Converted — your closed deals list', icon:I.zap, color:'var(--accent)' },
                { dataset:'email-stats', title:'Email Statistics', desc:'Every email ever sent — subject, step, status, sent date, open count', icon:I.mail, color:'var(--purple, #a78bfa)' },
                { dataset:'pipeline', title:'Pipeline Summary', desc:'Count and percentage of leads in each status stage', icon:I.chart, color:'var(--amber)' },
              ].map(item => (
                <div key={item.dataset} className="card" style={{ padding:'18px 20px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ width:38, height:38, borderRadius:8, background:`${item.color}22`, display:'flex', alignItems:'center', justifyContent:'center', color:item.color, flexShrink:0 }}>
                      {item.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div className="syne" style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>{item.title}</div>
                      <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.6, marginBottom:12 }}>{item.desc}</div>
                      <a href={`${API}/analytics/export/${item.dataset}`} style={{ textDecoration:'none' }}>
                        <button style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=item.color;e.currentTarget.style.color=item.color}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text)'}}>
                          {I.download} Download CSV
                        </button>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop:20, padding:16, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8 }}>
              <div className="syne" style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>How to open CSV in Excel</div>
              <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.8 }}>
                1. Click Download CSV — the file saves to your Downloads folder<br/>
                2. Open Excel → File → Open → browse to the downloaded file<br/>
                3. If data appears in one column: Data tab → Text to Columns → Delimited → Comma → Finish
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
