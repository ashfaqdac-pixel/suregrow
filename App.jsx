
import React, { useEffect, useState } from 'react'
const API = (path, opts={}) => fetch('/api'+path, { headers:{'Content-Type':'application/json'}, ...opts }).then(r=>r.json())

export default function App(){
  const [lang,setLang]=useState('en')
  const [dark,setDark]=useState(false)
  const t=(en,bn)=>lang==='en'?en:bn

  const [tab,setTab]=useState('simulate')
  return (<div style={{...s.page,background:dark?'#0b1210':'#f7faf5',color:dark?'#f3f4f6':'#0e1e16'}}>
    <h1>SureGrow</h1>
    <div style={s.bar}>
      {['investors','batches','money','cows','simulate','close','reports','settings'].map(t=>
        <button key={t} style={s.btn(tab===t)} onClick={()=>setTab(t)}>{t.toUpperCase()}</button>
      )}
    </div>
    {tab==='investors'&&<Investors/>}
    {tab==='batches'&&<Batches/>}
    {tab==='money'&&<Money/>}
    {tab==='cows'&&<Cows/>}
    {tab==='simulate'&&<Simulate/>}
    {tab==='close'&&<CloseBatch/>}
    {tab==='reports'&&<Reports/>}
    {tab==='settings'&&<Settings/>}
  </div>)
}

function Investors(){
  const [inv,setInv]=useState({name:'',phone:'',email:''})
  const [commit,setCommit]=useState({investor_id:'',batch_id:'',amount:'',start_date:'',end_date:'',frequency:'monthly'})
  const [preview,setPreview]=useState('')
  const [investors,setInvestors]=useState([])
  const [batches,setBatches]=useState([])
  useEffect(()=>{ API('/investors').then(setInvestors); API('/batches').then(setBatches)},[])
  return (<div>
    <div style={s.card}>
      <h2>Add Investor</h2>
      <div style={s.row}>
        <input style={s.input} placeholder="Full name" value={inv.name} onChange={e=>setInv({...inv,name:e.target.value})}/>
        <input style={s.input} placeholder="Phone" value={inv.phone} onChange={e=>setInv({...inv,phone:e.target.value})}/>
        <input style={s.input} placeholder="Email" value={inv.email} onChange={e=>setInv({...inv,email:e.target.value})}/>
        <button style={s.btn(true)} onClick={async()=>{ await API('/investors',{method:'POST',body:JSON.stringify(inv)}); setInv({name:'',phone:'',email:''}); setInvestors(await API('/investors'))}}>Save</button>
      </div>
    </div>
    <div style={s.card}>
      <h2>Add Commitment (auto-tier)</h2>
      <div style={s.row}>
        <select style={s.input} value={commit.investor_id} onChange={e=>setCommit({...commit,investor_id:e.target.value})}>
          <option value="">Investor</option>
          {investors.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select style={s.input} value={commit.batch_id} onChange={e=>setCommit({...commit,batch_id:e.target.value})}>
          <option value="">Batch</option>
          {batches.map(b=><option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
        </select>
        <input style={s.input} type="number" placeholder="Amount (Tk)" value={commit.amount} onChange={e=>setCommit({...commit,amount:e.target.value})}/>
        <input style={s.input} type="date" value={commit.start_date} onChange={e=>setCommit({...commit,start_date:e.target.value})}/>
        <input style={s.input} type="date" value={commit.end_date} onChange={e=>setCommit({...commit,end_date:e.target.value})}/>
        <select style={s.input} value={commit.frequency} onChange={e=>setCommit({...commit,frequency:e.target.value})}>
          <option value="monthly">Monthly ROI</option>
          <option value="quarterly">Quarterly ROI</option>
          <option value="closure">Lump sum at closure</option>
        </select>
        <button style={s.btn(true)} onClick={async()=>{
          const res = await API('/commitments',{method:'POST',body:JSON.stringify(commit)})
          setPreview(`Tier ${res.tier} | ROI Corridor ${res.roi_min_pct}% – ${res.roi_max_pct}% per month`)
        }}>Save Commitment</button>
      </div>
      <div style={{marginTop:8,color:'#334155'}}>{preview}</div>
    </div>
  </div>)
}

function Batches(){
  const [b,setB]=useState({name:'',start_date:'',closure_date:''})
  const [list,setList]=useState([])
  useEffect(()=>{ API('/batches').then(setList)},[])
  return (<div style={s.card}>
    <h2>Create Batch</h2>
    <div style={s.row}>
      <input style={s.input} placeholder="Batch name (e.g., Eid 2026)" value={b.name} onChange={e=>setB({...b,name:e.target.value})}/>
      <input style={s.input} type="date" value={b.start_date} onChange={e=>setB({...b,start_date:e.target.value})}/>
      <input style={s.input} type="date" value={b.closure_date} onChange={e=>setB({...b,closure_date:e.target.value})}/>
      <button style={s.btn(true)} onClick={async()=>{ await API('/batches',{method:'POST',body:JSON.stringify(b)}); setB({name:'',start_date:'',closure_date:''}); setList(await API('/batches'))}}>Save</button>
    </div>
    <table style={s.table}>
      <thead><tr><th style={s.thtd}>Code</th><th style={s.thtd}>Name</th><th style={s.thtd}>Start</th><th style={s.thtd}>Close</th></tr></thead>
      <tbody>{list.map(x=>(<tr key={x.id}><td style={s.thtd}>{x.code}</td><td style={s.thtd}>{x.name}</td><td style={s.thtd}>{x.start_date}</td><td style={s.thtd}>{x.closure_date}</td></tr>))}</tbody>
    </table>
  </div>)
}


function Money(){
  const [t,setT]=useState({date:'',direction:'out',wallet:'',category:'',amount:'',batch_id:'',cow_id:'',notes:'', receipt:null})
  const [batches,setBatches]=useState([])
  const [wallets,setWallets]=useState([])
  const [cats,setCats]=useState([])
  const [newW,setNewW]=useState({name:'',opening_balance:''})
  const [newC,setNewC]=useState({kind:'expense',name:''})

  const [flt,setFlt]=useState({from:'',to:'',wallet:'',category:'',batch:''})
  const [rows,setRows]=useState([])

  useEffect(()=>{ (async()=>{
    setBatches(await API('/batches'))
    setWallets(await API('/wallets'))
    setCats(await API('/categories'))
    await runFilter()
  })() },[])

  async function refresh(){ setWallets(await API('/wallets')); setCats(await API('/categories')); await runFilter() }
  async function runFilter(){
    const q = new URLSearchParams(flt).toString()
    setRows(await API('/transactions?'+q))
  }

  async function uploadFile(f){
    const arr = await f.arrayBuffer()
    const b64 = 'data:'+ (f.type||'application/octet-stream') +';base64,' + btoa(String.fromCharCode(...new Uint8Array(arr)))
    const res = await API('/upload',{method:'POST',body:JSON.stringify({kind:'tx_receipt', ref_id:'', filename:f.name, base64:b64})})
    return res.url || res.key
  }

  return (<div>
    <div style={s.card}>
      <h2>Money In/Out</h2>
      <div style={s.row}>
        <input style={s.input} type="date" value={t.date} onChange={e=>setT({...t,date:e.target.value})}/>
        <select style={s.input} value={t.direction} onChange={e=>setT({...t,direction:e.target.value})}>
          <option value="in">Money In</option>
          <option value="out">Money Out</option>
        </select>
        <select style={s.input} value={t.wallet} onChange={e=>setT({...t,wallet:e.target.value})}>
          <option value="">Wallet</option>
          {wallets.map(w=><option key={w.id} value={w.name}>{w.name}</option>)}
        </select>
        <select style={s.input} value={t.category} onChange={e=>setT({...t,category:e.target.value})}>
          <option value="">Category</option>
          {cats.map(c=><option key={c.id} value={c.name}>{(c.kind==='expense'?'🟥':'🟩')+' '+c.name}</option>)}
        </select>
        <input style={s.input} type="number" placeholder="Amount (Tk)" value={t.amount} onChange={e=>setT({...t,amount:e.target.value})}/>
        <select style={s.input} value={t.batch_id} onChange={e=>setT({...t,batch_id:e.target.value})}>
          <option value="">Batch (optional)</option>
          {batches.map(b=><option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <input style={s.input} placeholder="Cow ID (optional)" value={t.cow_id} onChange={e=>setT({...t,cow_id:e.target.value})}/>
        <input style={{...s.input,minWidth:'240px'}} placeholder="Notes" value={t.notes} onChange={e=>setT({...t,notes:e.target.value})}/>
        <input style={s.input} type="file" onChange={e=>setT({...t,receipt:e.target.files?.[0]||null})}/>
        <button style={s.btn(true)} onClick={async()=>{
          let receipt_url=null; if(t.receipt){ receipt_url = await uploadFile(t.receipt) }
          await API('/transactions',{method:'POST',body:JSON.stringify({...t, receipt_url})}); alert('Saved'); setT({...t,amount:'',notes:'',receipt:null}); refresh()
        }}>Save</button>
      </div>
    </div>

    <div style={s.card}>
      <h2>Wallets Overview</h2>
      <table style={s.table}>
        <thead><tr><th style={s.thtd}>Wallet</th><th style={s.thtd}>Opening</th><th style={s.thtd}>Balance</th></tr></thead>
        <tbody>{wallets.map(w=>(<tr key={w.id}><td style={s.thtd}>{w.name}</td><td style={s.thtd}>৳ {fmt(w.opening_balance||0)}</td><td style={s.thtd}><b>৳ {fmt(w.balance||0)}</b></td></tr>))}</tbody>
      </table>
    </div>

    <div style={s.card}>
      <h3>Filter Transactions</h3>
      <div style={s.row}>
        <input style={s.input} type="date" value={flt.from} onChange={e=>setFlt({...flt,from:e.target.value})}/>
        <input style={s.input} type="date" value={flt.to} onChange={e=>setFlt({...flt,to:e.target.value})}/>
        <select style={s.input} value={flt.wallet} onChange={e=>setFlt({...flt,wallet:e.target.value})}>
          <option value="">All wallets</option>
          {wallets.map(w=><option key={w.id} value={w.name}>{w.name}</option>)}
        </select>
        <select style={s.input} value={flt.category} onChange={e=>setFlt({...flt,category:e.target.value})}>
          <option value="">All categories</option>
          {cats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select style={s.input} value={flt.batch} onChange={e=>setFlt({...flt,batch:e.target.value})}>
          <option value="">All batches</option>
          {batches.map(b=><option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <button style={s.btn(true)} onClick={runFilter}>Apply</button>
        <a style={s.btn(false)} href={'/api/export/transactions.csv?'+new URLSearchParams(flt).toString()}>Export CSV</a>
        <form onSubmit={async e=>{
          e.preventDefault()
          const f = e.target.file.files[0]; if(!f) return
          const txt = await f.text()
          const res = await fetch('/api/import/transactions.csv',{method:'POST',headers:{},body:txt})
          const js = await res.json(); alert('Imported: '+js.imported); runFilter(); refresh()
        }}>
          <input name="file" type="file" accept=".csv"/>
          <button style={s.btn(true)} type="submit">Import CSV</button>
        </form>
      </div>
      <table style={s.table}>
        <thead><tr><th style={s.thtd}>Date</th><th style={s.thtd}>Dir</th><th style={s.thtd}>Wallet</th><th style={s.thtd}>Category</th><th style={s.thtd}>Amount</th><th style={s.thtd}>Batch</th><th style={s.thtd}>Notes</th></tr></thead>
        <tbody>{rows.map((r,i)=>(<tr key={i}><td style={s.thtd}>{r.date}</td><td style={s.thtd}>{r.direction}</td><td style={s.thtd}>{r.wallet}</td><td style={s.thtd}>{r.category}</td><td style={s.thtd}>৳ {fmt(r.amount)}</td><td style={s.thtd}>{r.batch_id||''}</td><td style={s.thtd}>{r.notes||''}</td></tr>))}</tbody>
      </table>
    </div>

    <div style={s.card}>
      <h3>Add Wallet</h3>
      <div style={s.row}>
        <input style={s.input} placeholder="Wallet name (e.g., Petty Cash)" value={newW.name} onChange={e=>setNewW({...newW,name:e.target.value})}/>
        <input style={s.input} type="number" placeholder="Opening balance" value={newW.opening_balance} onChange={e=>setNewW({...newW,opening_balance:e.target.value})}/>
        <button style={s.btn(true)} onClick={async()=>{ await API('/wallets',{method:'POST',body:JSON.stringify(newW)}); setNewW({name:'',opening_balance:''}); refresh() }}>Add</button>
      </div>
    </div>

    <div style={s.card}>
      <h3>Add Category</h3>
      <div style={s.row}>
        <select style={s.input} value={newC.kind} onChange={e=>setNewC({...newC,kind:e.target.value})}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input style={s.input} placeholder="e.g., Feed, Medicine, Cow Sale" value={newC.name} onChange={e=>setNewC({...newC,name:e.target.value})}/>
        <button style={s.btn(true)} onClick={async()=>{ await API('/categories',{method:'POST',body:JSON.stringify(newC)}); setNewC({kind:'expense',name:''}); refresh() }}>Add</button>
      </div>
    </div>
  </div>)
}
  return (<div>
    <div style={s.card}>
      <h2>Money In/Out</h2>
      <div style={s.row}>
        <input style={s.input} type="date" value={t.date} onChange={e=>setT({...t,date:e.target.value})}/>
        <select style={s.input} value={t.direction} onChange={e=>setT({...t,direction:e.target.value})}>
          <option value="in">Money In</option>
          <option value="out">Money Out</option>
        </select>
        <select style={s.input} value={t.wallet} onChange={e=>setT({...t,wallet:e.target.value})}>
          <option value="">Wallet</option>
          {wallets.map(w=><option key={w.id} value={w.name}>{w.name}</option>)}
        </select>
        <select style={s.input} value={t.category} onChange={e=>setT({...t,category:e.target.value})}>
          <option value="">Category</option>
          {cats.map(c=><option key={c.id} value={c.name}>{(c.kind==='expense'?'🟥':'🟩')+' '+c.name}</option>)}
        </select>
        <input style={s.input} type="number" placeholder="Amount (Tk)" value={t.amount} onChange={e=>setT({...t,amount:e.target.value})}/>
        <select style={s.input} value={t.batch_id} onChange={e=>setT({...t,batch_id:e.target.value})}>
          <option value="">Batch (optional)</option>
          {batches.map(b=><option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <input style={s.input} placeholder="Cow ID (optional)" value={t.cow_id} onChange={e=>setT({...t,cow_id:e.target.value})}/>
        <input style={{...s.input,minWidth:'240px'}} placeholder="Notes" value={t.notes} onChange={e=>setT({...t,notes:e.target.value})}/>
        <button style={s.btn(true)} onClick={async()=>{ await API('/transactions',{method:'POST',body:JSON.stringify(t)}); alert('Saved'); setT({...t,amount:'',notes:''}); refresh()}}>Save</button>
      </div>
    </div>

    <div style={s.card}>
      <h2>Wallets Overview</h2>
      <table style={s.table}>
        <thead><tr><th style={s.thtd}>Wallet</th><th style={s.thtd}>Opening</th><th style={s.thtd}>Balance</th></tr></thead>
        <tbody>{wallets.map(w=>(<tr key={w.id}><td style={s.thtd}>{w.name}</td><td style={s.thtd}>৳ {fmt(w.opening_balance||0)}</td><td style={s.thtd}><b>৳ {fmt(w.balance||0)}</b></td></tr>))}</tbody>
      </table>
    </div>

    <div style={s.card}>
      <h3>Add Wallet</h3>
      <div style={s.row}>
        <input style={s.input} placeholder="Wallet name (e.g., Petty Cash)" value={newW.name} onChange={e=>setNewW({...newW,name:e.target.value})}/>
        <input style={s.input} type="number" placeholder="Opening balance" value={newW.opening_balance} onChange={e=>setNewW({...newW,opening_balance:e.target.value})}/>
        <button style={s.btn(true)} onClick={async()=>{ await API('/wallets',{method:'POST',body:JSON.stringify(newW)}); setNewW({name:'',opening_balance:''}); refresh() }}>Add</button>
      </div>
    </div>

    <div style={s.card}>
      <h3>Add Category</h3>
      <div style={s.row}>
        <select style={s.input} value={newC.kind} onChange={e=>setNewC({...newC,kind:e.target.value})}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input style={s.input} placeholder="e.g., Feed, Medicine, Cow Sale" value={newC.name} onChange={e=>setNewC({...newC,name:e.target.value})}/>
        <button style={s.btn(true)} onClick={async()=>{ await API('/categories',{method:'POST',body:JSON.stringify(newC)}); setNewC({kind:'expense',name:''}); refresh() }}>Add</button>
      </div>
    </div>
  </div>)
}

function Cows(){
  const [batches,setBatches]=useState([])
  const [cows,setCows]=useState([])
  const [cow,setCow]=useState({batch_id:'', purchase_price:'', purchase_weight_kg:'', purchase_height_cm:'', purchase_date:'', source:'', notes:''})
  const [meas,setMeas]=useState({cow_id:'', date:'', weight_kg:'', height_cm:'', health_score:'', notes:''})
  const [sell,setSell]=useState({cow_id:'', date:'', amount:'', weight_kg:'', wallet:'Petty Cash', buyer:''})

  useEffect(()=>{ (async()=>{ setBatches(await API('/batches')); setCows(await API('/cows')) })() },[])

  return (
    <div>
      <div style={s.card}>
        <h2>Add Cow (auto tag)</h2>
        <div style={s.row}>
          <select style={s.input} value={cow.batch_id} onChange={e=>setCow({...cow,batch_id:e.target.value})}>
            <option value="">Batch</option>
            {batches.map(b=><option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
          </select>
          <input style={s.input} type="number" placeholder="Purchase price" value={cow.purchase_price} onChange={e=>setCow({...cow,purchase_price:e.target.value})}/>
          <input style={s.input} type="number" placeholder="Purchase weight (kg)" value={cow.purchase_weight_kg} onChange={e=>setCow({...cow,purchase_weight_kg:e.target.value})}/>
          <input style={s.input} type="number" placeholder="Purchase height (cm)" value={cow.purchase_height_cm} onChange={e=>setCow({...cow,purchase_height_cm:e.target.value})}/>
          <input style={s.input} type="date" value={cow.purchase_date} onChange={e=>setCow({...cow,purchase_date:e.target.value})}/>
          <input style={{...s.input,minWidth:'240px'}} placeholder="Source/Notes" value={cow.source} onChange={e=>setCow({...cow,source:e.target.value})}/>
          <button style={s.btn(true)} onClick={async()=>{ const r=await API('/cows',{method:'POST',body:JSON.stringify(cow)}); setCow({batch_id:'', purchase_price:'', purchase_weight_kg:'', purchase_height_cm:'', purchase_date:'', source:'', notes:''}); setCows(await API('/cows')); alert('Cow added: '+r.tag) }}>Save</button>
        </div>
      </div>

      <div style={s.card}>
        <h2>Record Measurement</h2>
        <div style={s.row}>
          <select style={s.input} value={meas.cow_id} onChange={e=>setMeas({...meas,cow_id:e.target.value})}>
            <option value="">Cow</option>
            {cows.map(c=><option key={c.id} value={c.id}>{c.tag}</option>)}
          </select>
          <input style={s.input} type="date" value={meas.date} onChange={e=>setMeas({...meas,date:e.target.value})}/>
          <input style={s.input} type="number" placeholder="Weight (kg)" value={meas.weight_kg} onChange={e=>setMeas({...meas,weight_kg:e.target.value})}/>
          <input style={s.input} type="number" placeholder="Height (cm)" value={meas.height_cm} onChange={e=>setMeas({...meas,height_cm:e.target.value})}/>
          <input style={s.input} type="number" placeholder="Health score (1-10)" value={meas.health_score} onChange={e=>setMeas({...meas,health_score:e.target.value})}/>
          <input style={{...s.input,minWidth:'240px'}} placeholder="Notes" value={meas.notes} onChange={e=>setMeas({...meas,notes:e.target.value})}/>
          <button style={s.btn(true)} onClick={async()=>{ await API('/measurements',{method:'POST',body:JSON.stringify(meas)}); setMeas({cow_id:'', date:'', weight_kg:'', height_cm:'', health_score:'', notes:''}); alert('Saved') }}>Save</button>
        </div>
      </div>

      <div style={s.card}>
        <h2>Sell Cow</h2>
        <div style={s.row}>
          <select style={s.input} value={sell.cow_id} onChange={e=>setSell({...sell,cow_id:e.target.value})}>
            <option value="">Cow</option>
            {cows.filter(c=>c.status==='in_farm').map(c=><option key={c.id} value={c.id}>{c.tag}</option>)}
          </select>
          <input style={s.input} type="date" value={sell.date} onChange={e=>setSell({...sell,date:e.target.value})}/>
          <input style={s.input} type="number" placeholder="Sale amount (Tk)" value={sell.amount} onChange={e=>setSell({...sell,amount:e.target.value})}/>
          <input style={s.input} type="number" placeholder="Sale weight (kg)" value={sell.weight_kg} onChange={e=>setSell({...sell,weight_kg:e.target.value})}/>
          <input style={s.input} placeholder="Wallet" value={sell.wallet} onChange={e=>setSell({...sell,wallet:e.target.value})}/>
          <input style={{...s.input,minWidth:'240px'}} placeholder="Buyer" value={sell.buyer} onChange={e=>setSell({...sell,buyer:e.target.value})}/>
          <button style={s.btn(true)} onClick={async()=>{ await API('/cow/sell',{method:'POST',body:JSON.stringify(sell)}); setSell({cow_id:'', date:'', amount:'', weight_kg:'', wallet:'Petty Cash', buyer:''}); setCows(await API('/cows')); alert('Sale recorded') }}>Record Sale</button>
        </div>
      </div>

      <div style={s.card}>
        <h2>Herd</h2>
        <table style={s.table}>
          <thead><tr><th style={s.thtd}>Tag</th><th style={s.thtd}>Batch</th><th style={s.thtd}>Status</th><th style={s.thtd}>Purchase</th></tr></thead>
          <tbody>{cows.map(c=>(
            <tr key={c.id}>
              <td style={s.thtd}>{c.tag}</td>
              <td style={s.thtd}>{c.batch_id}</td>
              <td style={s.thtd}>{c.status}</td>
              <td style={s.thtd}>৳ {fmt(c.purchase_price||0)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

function Simulate(){
  const [inp,setInp]=useState({avg_weight_kg:'250', price_per_kg:'450', herd_size:'40', expense_adjust_pct:'0', batch_id:''})
  const [batches,setBatches]=useState([])
  const [res,setRes]=useState(null)
  useEffect(()=>{ API('/batches').then(setBatches)},[])
  return (
    <div style={s.card}>
      <h2>What‑If Simulator</h2>
      <div style={s.row}>
        <input style={s.input} type="number" placeholder="Avg weight (kg)" value={inp.avg_weight_kg} onChange={e=>setInp({...inp,avg_weight_kg:e.target.value})}/>
        <input style={s.input} type="number" placeholder="Price per kg (Tk)" value={inp.price_per_kg} onChange={e=>setInp({...inp,price_per_kg:e.target.value})}/>
        <input style={s.input} type="number" placeholder="Herd size" value={inp.herd_size} onChange={e=>setInp({...inp,herd_size:e.target.value})}/>
        <input style={s.input} type="number" placeholder="Expense adjust % (e.g., +10 or -5)" value={inp.expense_adjust_pct} onChange={e=>setInp({...inp,expense_adjust_pct:e.target.value})}/>
        <select style={s.input} value={inp.batch_id} onChange={e=>setInp({...inp,batch_id:e.target.value})}>
          <option value="">(Optional) Batch for months & expenses</option>
          {batches.map(b=><option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
        </select>
        <button style={s.btn(true)} onClick={async()=>{ const r = await API('/simulate',{method:'POST',body:JSON.stringify(inp)}); setRes(r) }}>Run</button>
      </div>
      {res && (<div>
        <p>Revenue: ৳ {fmt(res.revenue)} | Expenses: ৳ {fmt(res.expenses)} | Profit: <b>৳ {fmt(res.profit)}</b></p>
        <p>Investors Pool Cap: ৳ {fmt(res.investors_pool_cap)} | ROI Planned: ৳ {fmt(res.roi_total)} | Founders Retained: <b>৳ {fmt(res.founders_retained)}</b> | Months: {res.inputs.months}</p>
        <h3>Tier Summary</h3>
        <table style={s.table}>
          <thead><tr><th style={s.thtd}>Tier</th><th style={s.thtd}>Corridor</th><th style={s.thtd}>Eff. % / mo</th><th style={s.thtd}>Principal</th><th style={s.thtd}>ROI Alloc</th></tr></thead>
          <tbody>
            {Object.entries(res.tiers).map(([k,v])=>(
              <tr key={k}>
                <td style={s.thtd}>{k}</td>
                <td style={s.thtd}>{v.corridor_min}%–{v.corridor_max}%</td>
                <td style={s.thtd}>{v.effective_monthly_pct}%</td>
                <td style={s.thtd}>৳ {fmt(v.total_principal)}</td>
                <td style={s.thtd}>৳ {fmt(v.total_roi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>)}
    </div>
  )
}

function CloseBatch(){
  const [id,setId]=useState('')
  const [res,setRes]=useState(null)
  return (<div style={s.card}>
    <h2>Close Batch</h2>
    <div style={s.row}>
      <input style={s.input} placeholder="Batch ID" value={id} onChange={e=>setId(e.target.value)}/>
      <button style={s.btn(true)} onClick={async()=>{ const r = await API('/close', {method:'POST', body: JSON.stringify({batch_id:id})}); setRes(r)}}>Close & Distribute</button>
    </div>
    {res && (<div>
      <p>Revenue: ৳ {fmt(res.revenue)} | Expenses: ৳ {fmt(res.expenses)} | Profit: <b>৳ {fmt(res.profit)}</b></p>
      <p>ROI Paid: ৳ {fmt(res.roiPaid)} | Founders Retained: <b>৳ {fmt(res.founders_retained)}</b> | Months: {res.months}</p>
    </div>)}
  </div>)
}

function Reports(){
  const [batches,setBatches]=useState([])
  const [investors,setInvestors]=useState([])
  const [batch,setBatch]=useState('')
  const [investor,setInvestor]=useState('')
  useEffect(()=>{ API('/batches').then(setBatches); API('/investors').then(setInvestors) },[])
  async function dl(url, name){
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (<div style={s.card}>
    <h2>Reports</h2>
    <div style={s.row}>
      <select style={s.input} value={batch} onChange={e=>setBatch(e.target.value)}>
        <option value="">Select Batch</option>
        {batches.map(b=><option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
      </select>
      <select style={s.input} value={investor} onChange={e=>setInvestor(e.target.value)}>
        <option value="">Select Investor</option>
        {investors.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      <button style={s.btn(true)} disabled={!batch||!investor} onClick={()=>dl(`/api/report/investor?investor_id=${investor}&batch_id=${batch}`, `InvestorStatement-${investor}.pdf`)}>Download Investor Statement</button>
      <button style={s.btn(true)} disabled={!batch} onClick={()=>dl(`/api/report/batch?batch_id=${batch}`, `FounderBatchReport-${batch}.pdf`)}>Download Founder Batch Report</button>
    </div>
  </div>)
}


function Settings(){
  const [me,setMe]=useState(null)
  const [users,setUsers]=useState([])
  useEffect(()=>{ (async()=>{ const res = await API('/users'); if(!res.error){ setMe(res.me); setUsers(res.users) } else { setMe({error:true}) } })() },[])
  async function setRole(id, role){ await API('/users/role',{method:'POST',body:JSON.stringify({user_id:id,role})}); const res=await API('/users'); setUsers(res.users) }
  return (<div style={s.card}>
    <h2>Access & Roles</h2>
    {!me && <p>Loading...</p>}
    {me && me.error && <p style={{color:'#b91c1c'}}>Unauthorized — set up Cloudflare Access or pass ?dev_email=you@example.com in the URL for local testing.</p>}
    {me && !me.error && (<div>
      <p><b>Email:</b> {me.email||'(anonymous)'} &nbsp; <b>Role:</b> {me.role}</p>
      <table style={s.table}>
        <thead><tr><th style={s.thtd}>Email</th><th style={s.thtd}>Role</th><th style={s.thtd}>Actions</th></tr></thead>
        <tbody>{users.map(u=>(<tr key={u.id}><td style={s.thtd}>{u.email}</td><td style={s.thtd}>{u.role}</td><td style={s.thtd}>
          {me.role==='owner' && (<select value={u.role} onChange={e=>setRole(u.id, e.target.value)}>
            <option value="owner">owner</option>
            <option value="member">member</option>
            <option value="viewer">viewer</option>
          </select>)}
        </td></tr>))}</tbody>
      </table>
    </div>)}
  </div>)
}

  const [me,setMe]=useState(null)
  useEffect(()=>{ fetch('/api/me').then(r=>r.json()).then(setMe) },[])
  return (<div style={s.card}>
    <h2>Access & Roles</h2>
    {!me && <p>Loading...</p>}
    {me && me.error && <p style={{color:'#b91c1c'}}>Unauthorized — set up Cloudflare Access or pass ?dev_email=you@example.com in the URL for local testing.</p>}
    {me && !me.error && (<div>
      <p><b>Email:</b> {me.email||'(anonymous)'}</p>
      <p><b>Role:</b> {me.role}</p>
      <p style={{color:'#475569',marginTop:8}}>Owners and Members can add/update records. Viewers are read-only.</p>
    </div>)}
  </div>)
}

const s = { page:{fontFamily:'system-ui,Segoe UI,Inter,Arial',background:'#f7faf5',color:'#0e1e16',minHeight:'100vh',padding:'16px'},
  bar:{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'12px'},
  btn:(active)=>({padding:'10px 14px',borderRadius:'10px',border:'1px solid #d1d5db',background:active?'#32B256':'#fff',color:active?'#fff':'#0e1e16',fontWeight:600,cursor:'pointer'}),
  card:{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'14px',padding:'16px',marginBottom:'14px'},
  row:{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'8px'},
  input:{padding:'8px',border:'1px solid #d1d5db',borderRadius:'8px'},
  table:{width:'100%',borderCollapse:'collapse'},
  thtd:{padding:'8px',borderBottom:'1px solid #eee',textAlign:'left'}
}
function fmt(n){ return Number(n||0).toLocaleString('en-IN') }
