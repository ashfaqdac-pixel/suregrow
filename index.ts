
import { Hono } from 'hono'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

type Env = {
  BUCKET: R2Bucket,
  R2_PUBLIC_BASE: string,
  DB: D1Database,
  FOUNDERS_SHARE: string,
  INVESTORS_SHARE: string,
  TIERA_MIN: string, TIERA_MAX: string,
  TIERB_MIN: string, TIERB_MAX: string,
  TIERC_MIN: string, TIERC_MAX: string,
  TIERD_MIN: string, TIERD_MAX: string,
  ACCESS_REQUIRED: string,
  ACCESS_DEV_EMAIL: string,
}

const app = new Hono<{Bindings: Env}>()


function toCSV(rows:any[]){
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = (v:any)=>(''+(v??'')).replace(/"/g,'""')
  const head = keys.map(k=>`"${k}"`).join(',')
  const body = rows.map(r=> keys.map(k=>`"${esc(r[k])}"`).join(',')).join('\n')
  return head + '\n' + body
}


function uuid(){ return crypto.randomUUID() }
async function all(db: D1Database, sql: string, params: any[] = []){
  const res = await db.prepare(sql).bind(...params).all()
  return res.results || []
}
async function run(db: D1Database, sql: string, params: any[] = []){
  await db.prepare(sql).bind(...params).run()
}

// --- Auth helper ---
type User = { id:string, email:string, name?:string|null, role:'owner'|'member'|'viewer' }
async function getOrCreateUser(c:any): Promise<User|null> {
  const required = (c.env.ACCESS_REQUIRED||'false') === 'true'
  let email = c.req.header('Cf-Access-Authenticated-User-Email') || ''
  if (!email) email = new URL(c.req.url).searchParams.get('dev_email') || (c.env.ACCESS_DEV_EMAIL||'')
  if (required && !email) return null
  if (!email) return { id:'anon', email:'', name:null, role:'viewer' }
  email = String(email).toLowerCase()
  const found = await all(c.env.DB, 'select * from users where email=?', [email])
  if (found.length){
    const u:any = found[0]
    return { id:u.id, email:u.email, name:u.name, role:(u.role||'viewer') }
  }
  const id = uuid()
  const count = (await all(c.env.DB, 'select count(*) as n from users'))[0]?.n || 0
  const role:'owner'|'member'|'viewer' = count===0 ? 'owner' : 'member'
  await run(c.env.DB, 'insert into users (id, email, role) values (?,?,?)', [id, email, role])
  return { id, email, name:null, role }
}
function canWrite(u:User|null){ return !!u && (u.role==='owner' || u.role==='member') }

// --- Health & Me ---
app.get('/api/health', c => c.json({ ok:true }))
app.get('/api/me', async c => {
  const me = await getOrCreateUser(c)
  if (!me) return c.json({ error:'Unauthorized' }, 401)
  return c.json(me)
})

// --- Batches ---
app.get('/api/batches', async c => {
  const rows = await all(c.env.DB, 'select * from batches order by created_at')
  return c.json(rows)
})
app.post('/api/batches', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const b = await c.req.json()
  const id = uuid()
  const count = (await all(c.env.DB, 'select count(*) as n from batches'))[0]?.n || 0
  const code = 'B' + String(count+1).padStart(3,'0')
  await run(c.env.DB, 'insert into batches (id, code, name, start_date, closure_date) values (?,?,?,?,?)', [id, code, b.name, b.start_date, b.closure_date])
  return c.json({ id, code, ...b })
})

// --- Investors ---
app.get('/api/investors', async c => {
  const rows = await all(c.env.DB, 'select * from investors order by created_at')
  return c.json(rows)
})
app.post('/api/investors', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const inv = await c.req.json()
  const id = uuid()
  await run(c.env.DB, 'insert into investors (id, name, phone, email) values (?,?,?,?)', [id, inv.name, inv.phone, inv.email])
  return c.json({ id, ...inv })
})

// --- Commitments (auto-tier) ---
app.post('/api/commitments', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const cm = await c.req.json()
  const id = uuid()
  const amt = Number(cm.amount||0)
  const S = c.env
  let tier = 'A', min = Number(S.TIERA_MIN), max = Number(S.TIERA_MAX)
  if(amt >= 100000 && amt < 500000){ tier='B'; min=Number(S.TIERB_MIN); max=Number(S.TIERB_MAX) }
  else if(amt >= 500000 && amt < 1000000){ tier='C'; min=Number(S.TIERC_MIN); max=Number(S.TIERC_MAX) }
  else if(amt >= 1000000){ tier='D'; min=Number(S.TIERD_MIN); max=Number(S.TIERD_MAX) }
  await run(c.env.DB, `insert into commitments (id, investor_id, batch_id, amount, start_date, end_date, frequency, tier, roi_min_pct, roi_max_pct)
    values (?,?,?,?,?,?,?,?,?,?)`, [id, cm.investor_id, cm.batch_id, amt, cm.start_date, cm.end_date, cm.frequency, tier, min, max])
  return c.json({ id, tier, roi_min_pct:min, roi_max_pct:max })
})

// --- Transactions ---
app.post('/api/transactions', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const t = await c.req.json()
  const id = uuid()
  await run(c.env.DB, `insert into transactions (id, date, direction, wallet, category, amount, batch_id, cow_id, notes)
    values (?,?,?,?,?,?,?,?,?)`, [id, t.date, t.direction, t.wallet, t.category, Number(t.amount||0), t.batch_id||null, t.cow_id||null, t.notes||null])
  return c.json({ id })
})

// --- Close batch (distribute ROI within 40% profit pool) ---
app.post('/api/close', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const { batch_id } = await c.req.json()
  const S = c.env
  const [b] = await all(c.env.DB, 'select * from batches where id=?', [batch_id])
  if(!b) return c.json({ error:'Batch not found' }, 404)
  const tx = await all(c.env.DB, 'select * from transactions where batch_id=?', [batch_id])
  const revenue = tx.filter(t=>t.direction==='in').reduce((a,t)=>a+Number(t.amount||0),0)
  const expenses = tx.filter(t=>t.direction==='out').reduce((a,t)=>a+Number(t.amount||0),0)
  const profit = revenue - expenses
  const cms = await all(c.env.DB, 'select * from commitments where batch_id=?', [batch_id])
  const totalP = cms.reduce((a,c)=>a+Number(c.amount||0),0) || 1
  const invShare = Number(S.INVESTORS_SHARE||'40')/100
  let pool = Math.max(0, profit * invShare)
  const months = Math.max(1, Math.round((Date.parse(b.closure_date) - Date.parse(b.start_date))/(1000*60*60*24*30)))
  let roiPaid = 0
  for(const cmt of cms){
    const p = Number(cmt.amount||0)
    const weight = p/totalP
    const corridorMid = (Number(cmt.roi_min_pct)+Number(cmt.roi_max_pct))/2/100
    const target = Math.round(p * corridorMid * months)
    const alloc = Math.min(pool * weight, target)
    if (alloc>0){
      await run(c.env.DB, `insert into distributions (id, batch_id, date, kind, investor_id, amount, notes)
        values (?,?,?,?,?,?,?)`, [uuid(), batch_id, new Date().toISOString().slice(0,10), 'roi', cmt.investor_id, alloc, `ROI for ${months} mo`])
      roiPaid += alloc; pool -= alloc
    }
  }
  const founders_retained = profit - roiPaid
  return c.json({ revenue, expenses, profit, roiPaid, founders_retained, months })
})

// --- Simulator ---
app.post('/api/simulate', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const { avg_weight_kg, price_per_kg, herd_size, expense_adjust_pct = 0, batch_id = null } = await c.req.json()
  const S = c.env
  const nHerd = Number(herd_size||0)
  const price = Number(price_per_kg||0)
  const weight = Number(avg_weight_kg||0)
  const expenseAdj = Number(expense_adjust_pct||0) / 100
  const projectedRevenue = Math.max(0, nHerd * weight * price)
  let baselineExpenses = 0
  if (batch_id){
    const tx = await all(c.env.DB, 'select * from transactions where batch_id=? and direction=?', [batch_id, 'out'])
    baselineExpenses = tx.reduce((a,t)=>a+Number(t.amount||0),0)
  }
  const projectedExpenses = Math.max(0, baselineExpenses * (1 + expenseAdj))
  const profit = projectedRevenue - projectedExpenses
  const invShare = Number(S.INVESTORS_SHARE||'40')/100
  let pool = Math.max(0, profit * invShare)
  let months = 6
  if (batch_id){
    const [b] = await all(c.env.DB, 'select * from batches where id=?', [batch_id])
    if (b){
      months = Math.max(1, Math.round((Date.parse(b.closure_date) - Date.parse(b.start_date))/(1000*60*60*24*30)))
    }
  }
  let tiers:any = { A:{min:+S.TIERA_MIN, max:+S.TIERA_MAX, totalP:0},
                    B:{min:+S.TIERB_MIN, max:+S.TIERB_MAX, totalP:0},
                    C:{min:+S.TIERC_MIN, max:+S.TIERC_MAX, totalP:0},
                    D:{min:+S.TIERD_MIN, max:+S.TIERD_MAX, totalP:0} }
  let cms:any[] = []
  if (batch_id){
    cms = await all(c.env.DB, 'select * from commitments where batch_id=?', [batch_id])
    for (const cmt of cms){
      const p = Number(cmt.amount||0)
      if (tiers[cmt.tier]) tiers[cmt.tier].totalP += p
    }
  }
  const totalP = cms.reduce((a,c)=>a+Number(c.amount||0),0) || 1
  let roiPlan:any[] = []
  let roiTotal = 0
  for(const cmt of cms){
    const p = Number(cmt.amount||0)
    const weightShare = p/totalP
    const corridorMid = (Number(cmt.roi_min_pct)+Number(cmt.roi_max_pct))/2/100
    const target = Math.round(p * corridorMid * months)
    const alloc = Math.min(pool * weightShare, target)
    roiPlan.push({ investor_id: cmt.investor_id, tier: cmt.tier, principal: p, target, alloc })
    roiTotal += alloc
  }
  const founders_retained = profit - roiTotal
  const tierSummary:any = {}
  for (const k of Object.keys(tiers)){
    const principals = roiPlan.filter(r=>r.tier===k).reduce((a,r)=>a+r.principal,0)
    const alloc = roiPlan.filter(r=>r.tier===k).reduce((a,r)=>a+r.alloc,0)
    const effMonthlyPct = principals>0 && months>0 ? (alloc / (principals * months)) * 100 : 0
    tierSummary[k] = { corridor_min: tiers[k].min, corridor_max: tiers[k].max, effective_monthly_pct: +effMonthlyPct.toFixed(2), total_principal: principals, total_roi: alloc }
  }
  return c.json({ inputs: { avg_weight_kg: weight, price_per_kg: price, herd_size: nHerd, expense_adjust_pct: Number(expense_adjust_pct), months },
    revenue: projectedRevenue, expenses: projectedExpenses, profit, investors_pool_cap: Math.max(0, profit * invShare), roi_total: roiTotal, founders_retained, tiers: tierSummary, plan: roiPlan })
})

// --- Cows ---
app.get('/api/cows', async c => {
  const rows = await all(c.env.DB, 'select * from cows order by created_at desc')
  return c.json(rows)
})
app.post('/api/cows', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const body = await c.req.json()
  const id = uuid()
  const [b] = await all(c.env.DB, 'select * from batches where id=?', [body.batch_id])
  if(!b) return c.json({ error:'Batch not found' }, 400)
  const count = (await all(c.env.DB, 'select count(*) as n from cows where batch_id=?', [body.batch_id]))[0]?.n || 0
  const tag = `${b.code}-${String(count+1).padStart(3,'0')}`
  await run(c.env.DB, `insert into cows (id, batch_id, tag, purchase_date, purchase_weight_kg, purchase_height_cm, purchase_price, source, status, photo_url, notes)
    values (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, body.batch_id, tag, body.purchase_date||null, Number(body.purchase_weight_kg||0)||null, Number(body.purchase_height_cm||0)||null, Number(body.purchase_price||0)||null, body.source||null, 'in_farm', body.photo_url||null, body.notes||null])
  return c.json({ id, tag })
})

// --- Measurements ---
app.post('/api/measurements', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const m = await c.req.json()
  const id = uuid()
  await run(c.env.DB, `insert into measurements (id, cow_id, date, weight_kg, height_cm, health_score, notes)
    values (?,?,?,?,?,?,?)`, [id, m.cow_id, m.date, Number(m.weight_kg||0)||null, Number(m.height_cm||0)||null, Number(m.health_score||0)||null, m.notes||null])
  return c.json({ id })
})

// --- Sell cow ---
app.post('/api/cow/sell', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const body = await c.req.json()
  const { cow_id, date, amount, weight_kg, wallet='Sales', buyer='' } = body
  const [cow] = await all(c.env.DB, 'select * from cows where id=?', [cow_id])
  if(!cow) return c.json({ error:'Cow not found' }, 404)
  await run(c.env.DB, `insert into cow_events (id, cow_id, date, type, details, amount) values (?,?,?,?,?,?)`,
    [uuid(), cow_id, date, 'sale', `Buyer: ${buyer}`, Number(amount||0)])
  await run(c.env.DB, 'update cows set status=? where id=?', ['sold', cow_id])
  await run(c.env.DB, `insert into transactions (id, date, direction, wallet, category, amount, batch_id, cow_id, notes)
    values (?,?,?,?,?,?,?,?,?)`, [uuid(), date, 'in', wallet, 'Cow Sale', Number(amount||0), cow.batch_id, cow_id, `Sold @ ${weight_kg||''}kg to ${buyer||''}`])
  if (weight_kg){
    await run(c.env.DB, `insert into measurements (id, cow_id, date, weight_kg, notes) values (?,?,?,?,?)`, [uuid(), cow_id, date, Number(weight_kg||0), 'Weight at sale'])
  }
  return c.json({ ok:true })
})

// --- Wallets & Categories ---
app.get('/api/wallets', async c => {
  const rows:any[] = await all(c.env.DB, 'select * from wallets order by created_at')
  for (const w of rows){
    const t:any[] = await all(c.env.DB, 'select direction, amount from transactions where wallet=?', [w.name])
    const net = t.reduce((a, x)=> a + (x.direction==='in'? Number(x.amount||0) : -Number(x.amount||0)), 0)
    w.balance = Number(w.opening_balance||0) + net
  }
  return c.json(rows)
})
app.post('/api/wallets', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const w = await c.req.json()
  const id = uuid()
  await run(c.env.DB, 'insert into wallets (id, name, opening_balance) values (?,?,?)', [id, w.name, Number(w.opening_balance||0)])
  return c.json({ id })
})

app.get('/api/categories', async c => {
  const rows = await all(c.env.DB, 'select * from categories order by kind, name')
  return c.json(rows)
})
app.post('/api/categories', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const body = await c.req.json()
  const id = uuid()
  await run(c.env.DB, 'insert into categories (id, kind, name) values (?,?,?)', [id, body.kind, body.name])
  return c.json({ id })
})

// --- PDF helper ---
async function makePDF(title:string, lines:string[]){
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const { width, height } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold)
  let y = height - 50
  page.drawText(title, { x: 50, y, size: 18, font: fontB, color: rgb(0.1,0.2,0.15) })
  y -= 24
  page.drawLine({ start: {x:50,y}, end: {x: width-50, y}, thickness: 1, color: rgb(0.8,0.8,0.8)})
  y -= 16
  const size = 10
  for(const line of lines){
    if (y < 60){
      const p = pdf.addPage([595.28, 841.89])
      const pw = p.getSize().width; const ph = p.getSize().height
      y = ph - 50
      p.drawText(title + ' (cont.)', { x: 50, y, size: 14, font: fontB })
      y -= 24
      p.drawLine({ start: {x:50,y}, end: {x: pw-50, y}, thickness: 1, color: rgb(0.8,0.8,0.8)})
      y -= 16
      p.drawText(line, { x: 50, y, size, font })
      y -= 14
    } else {
      page.drawText(line, { x: 50, y, size, font })
      y -= 14
    }
  }
  const bytes = await pdf.save()
  return bytes
}

// --- Reports PDFs ---
app.get('/api/report/investor', async c => {
  const investor_id = c.req.query('investor_id')
  const batch_id = c.req.query('batch_id')
  if(!investor_id || !batch_id) return c.json({ error: 'investor_id and batch_id required' }, 400)
  const [inv] = await all(c.env.DB, 'select * from investors where id=?', [investor_id])
  const [b] = await all(c.env.DB, 'select * from batches where id=?', [batch_id])
  if(!inv || !b) return c.json({ error:'Not found' }, 404)
  const cms = await all(c.env.DB, 'select * from commitments where batch_id=? and investor_id=?', [batch_id, investor_id])
  const dists = await all(c.env.DB, 'select * from distributions where batch_id=? and investor_id=?', [batch_id, investor_id])
  const txIn = await all(c.env.DB, 'select * from transactions where batch_id=? and direction=?', [batch_id, 'in'])
  const txOut = await all(c.env.DB, 'select * from transactions where batch_id=? and direction=?', [batch_id, 'out'])
  const principal = cms.reduce((a,c)=>a+Number(c.amount||0),0)
  const roiPaid = dists.filter(d=>d.kind==='roi').reduce((a,d)=>a+Number(d.amount||0),0)
  const revenue = txIn.reduce((a,t)=>a+Number(t.amount||0),0)
  const expenses = txOut.reduce((a,t)=>a+Number(t.amount||0),0)
  const profit = revenue - expenses
  const lines = [
    `Investor: ${inv.name} (${inv.email||''})`,
    `Batch: ${b.code} — ${b.name}`,
    `Start: ${b.start_date}    Close: ${b.closure_date}`,
    ``,
    `Principal Committed: ৳ ${principal.toLocaleString('en-IN')}`,
    `ROI Paid: ৳ ${roiPaid.toLocaleString('en-IN')}`,
    ``,
    `Batch Revenue: ৳ ${revenue.toLocaleString('en-IN')}`,
    `Batch Expenses: ৳ ${expenses.toLocaleString('en-IN')}`,
    `Batch Profit: ৳ ${profit.toLocaleString('en-IN')}`,
    ``,
    `Commitments:`,
    ...cms.map(c=> `  • ${c.tier} — ৳ ${Number(c.amount||0).toLocaleString('en-IN')} | ${c.roi_min_pct}%–${c.roi_max_pct}%/mo | ${c.frequency}`),
    ``,
    `Distributions:`,
    ...dists.map(d=> `  • ${d.date} — ${d.kind.toUpperCase()} ৳ ${Number(d.amount||0).toLocaleString('en-IN')} (${d.notes||''})`),
  ]
  const bytes = await makePDF(`Investor Statement — ${inv.name}`, lines)
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' } })
})

app.get('/api/report/batch', async c => {
  const batch_id = c.req.query('batch_id')
  if(!batch_id) return c.json({ error: 'batch_id required' }, 400)
  const [b] = await all(c.env.DB, 'select * from batches where id=?', [batch_id])
  if(!b) return c.json({ error:'Batch not found' }, 404)
  const tx = await all(c.env.DB, 'select * from transactions where batch_id=?', [batch_id])
  const cms = await all(c.env.DB, 'select * from commitments where batch_id=?', [batch_id])
  const dists = await all(c.env.DB, 'select * from distributions where batch_id=?', [batch_id])
  const revenue = tx.filter(t=>t.direction==='in').reduce((a,t)=>a+Number(t.amount||0),0)
  const expenses = tx.filter(t=>t.direction==='out').reduce((a,t)=>a+Number(t.amount||0),0)
  const profit = revenue - expenses
  const roiPaid = dists.filter(d=>d.kind==='roi').reduce((a,d)=>a+Number(d.amount||0),0)
  const foundersRetained = profit - roiPaid
  const princTotal = cms.reduce((a,c)=>a+Number(c.amount||0),0)
  const byTier:any = {A:0,B:0,C:0,D:0}
  for (const cmt of cms){ byTier[cmt.tier] = (byTier[cmt.tier]||0) + Number(cmt.amount||0) }
  const lines = [
    `Batch: ${b.code} — ${b.name}`,
    `Start: ${b.start_date}    Close: ${b.closure_date}`,
    ``,
    `Revenue: ৳ ${revenue.toLocaleString('en-IN')}`,
    `Expenses: ৳ ${expenses.toLocaleString('en-IN')}`,
    `Profit: ৳ ${profit.toLocaleString('en-IN')}`,
    ``,
    `Investor Pool ROI Paid: ৳ ${roiPaid.toLocaleString('en-IN')}`,
    `Founders Retained: ৳ ${foundersRetained.toLocaleString('en-IN')}`,
    ``,
    `Commitments (Total Principal: ৳ ${princTotal.toLocaleString('en-IN')}):`,
    `  Tier A: ৳ ${byTier.A.toLocaleString('en-IN')}`,
    `  Tier B: ৳ ${byTier.B.toLocaleString('en-IN')}`,
    `  Tier C: ৳ ${byTier.C.toLocaleString('en-IN')}`,
    `  Tier D: ৳ ${byTier.D.toLocaleString('en-IN')}`,
    ``,
    `Transactions:`,
    ...tx.map(t=> `  • ${t.date} — ${t.direction.toUpperCase()} — ৳ ${Number(t.amount||0).toLocaleString('en-IN')} — ${t.wallet||''} — ${t.category||''} — ${t.notes||''}`),
    ``,
    `Distributions:`,
    ...dists.map(d=> `  • ${d.date} — ${d.kind.toUpperCase()} — ৳ ${Number(d.amount||0).toLocaleString('en-IN')} — investor:${d.investor_id||''} (${d.notes||''})`),
  ]
  const bytes = await makePDF(`Founder Batch Report — ${b.code}`, lines)
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' } })
})


// --- Users & Roles ---
app.get('/api/users', async c => {
  const me = await getOrCreateUser(c); if(!me) return c.json({error:'Unauthorized'},401);
  const rows = await all(c.env.DB, 'select id,email,name,role,created_at from users order by created_at')
  return c.json({ me, users: rows })
})
app.post('/api/users/role', async c => {
  const me = await getOrCreateUser(c); if(!me) return c.json({error:'Unauthorized'},401);
  if (me.role!=='owner') return c.json({error:'Only owner can change roles'},403)
  const { user_id, role } = await c.req.json()
  if (!['owner','member','viewer'].includes(role)) return c.json({error:'bad role'},400)
  await run(c.env.DB, 'update users set role=? where id=?', [role, user_id])
  return c.json({ ok:true })
})


// --- R2 Upload ---
app.post('/api/upload', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const body = await c.req.json()
  const { kind='other', ref_id=null, filename='file.bin', base64='' } = body
  const id = crypto.randomUUID()
  const key = `${kind}/${id}-${filename}`
  const bin = Uint8Array.from(atob(base64.split(',').pop()||''), c=>c.charCodeAt(0))
  await c.env.BUCKET.put(key, bin, { httpMetadata:{ contentType: guessContentType(filename) }})
  const base = c.env.R2_PUBLIC_BASE || ''
  const url = base ? `${base.replace(/\/$/,'')}/${encodeURIComponent(key)}` : key
  await run(c.env.DB, 'insert into files (id, kind, ref_id, key, url) values (?,?,?,?,?)', [id, kind, ref_id, key, url])
  return c.json({ id, key, url })
})
function guessContentType(name:string){
  if (name.match(/\.pdf$/i)) return 'application/pdf'
  if (name.match(/\.jpe?g$/i)) return 'image/jpeg'
  if (name.match(/\.png$/i)) return 'image/png'
  if (name.match(/\.webp$/i)) return 'image/webp'
  return 'application/octet-stream'
}


// --- Transactions filter/export/import ---
app.get('/api/transactions', async c => {
  const q = new URL(c.req.url).searchParams
  const from = q.get('from'); const to = q.get('to')
  const wallet = q.get('wallet'); const category = q.get('category'); const batch = q.get('batch')
  let sql = 'select * from transactions where 1=1'
  const p:any[] = []
  if (from){ sql+=' and date>=?'; p.push(from) }
  if (to){ sql+=' and date<=?'; p.push(to) }
  if (wallet){ sql+=' and wallet=?'; p.push(wallet) }
  if (category){ sql+=' and category=?'; p.push(category) }
  if (batch){ sql+=' and batch_id=?'; p.push(batch) }
  sql += ' order by date'
  const rows = await all(c.env.DB, sql, p)
  return c.json(rows)
})

app.get('/api/export/transactions.csv', async c => {
  const q = new URL(c.req.url).searchParams
  const from = q.get('from')||''; const to = q.get('to')||''
  const wallet = q.get('wallet')||''; const category = q.get('category')||''; const batch = q.get('batch')||''
  const res = await (await fetch(c.req.url.replace('/api/export/transactions.csv','/api/transactions'))).json()
  const csv = toCSV(res||[])
  return new Response(csv, { headers:{ 'Content-Type':'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="transactions_${from}_${to}_${wallet||'all'}.csv"` } })
})

app.post('/api/import/transactions.csv', async c => {
  const me = await getOrCreateUser(c); if(!canWrite(me)) return c.json({error:'Forbidden'},403);
  const text = await c.req.text()
  const lines = text.trim().split(/\r?\n/)
  const header = lines.shift()?.split(',').map(h=>h.replace(/^"|"$/g,''))||[]
  let count = 0
  for (const line of lines){
    const cols = line.split(',').map(x=>x.replace(/^"|"$/g,'').replace(/\"/g,'"'))
    const row:any = {}; header.forEach((h,i)=> row[h] = cols[i])
    if (!row.date || !row.amount || !row.direction) continue
    await run(c.env.DB, `insert into transactions (id, date, direction, wallet, category, amount, batch_id, cow_id, notes, receipt_url)
      values (?,?,?,?,?,?,?,?,?,?)`, [crypto.randomUUID(), row.date, row.direction, row.wallet||null, row.category||null, Number(row.amount||0), row.batch_id||null, row.cow_id||null, row.notes||null, row.receipt_url||null])
    count++
  }
  return c.json({ imported: count })
})

export default app
