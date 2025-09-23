async function api(path, opts={}) {
  const res = await fetch(path, { credentials:'include', headers:{'content-type':'application/json'}, ...opts });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

document.getElementById('addBtn').addEventListener('click', async ()=>{
  const title = document.getElementById('title').value.trim();
  const url = document.getElementById('url').value.trim();
  const type = document.getElementById('type').value;
  const category = document.getElementById('category').value.trim();
  const msg = document.getElementById('msg');
  try{
    await api('/api/admin/media',{ method:'POST', body: JSON.stringify({ title, url, type, category })});
    msg.textContent = 'Added!';
    msg.style.color = '#6f6';
  }catch(err){
    msg.textContent = err.message;
    msg.style.color = '#f66';
  }
});
