async function api(path, opts={}) {
  const res = await fetch(path, { credentials:'include', headers:{'content-type':'application/json'}, ...opts });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

// Check if user is admin, redirect if not
async function checkAdminAuth() {
  try {
    const result = await api('/api/auth/me');
    if (!result.user || result.user.role !== 'admin') {
      alert('Access denied. Admin privileges required.');
      window.location.href = '/';
      return;
    }
  } catch (error) {
    alert('Please log in to access admin panel.');
    window.location.href = '/';
  }
}

// Check admin auth on page load
checkAdminAuth();

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

document.getElementById('removeSamplesBtn').addEventListener('click', async ()=>{
  const adminMsg = document.getElementById('adminMsg');
  if (!confirm('Are you sure you want to remove all sample media?')) return;
  
  try{
    await api('/api/admin/remove-samples',{ method:'POST'});
    adminMsg.textContent = 'Sample media removed!';
    adminMsg.style.color = '#6f6';
  }catch(err){
    adminMsg.textContent = err.message;
    adminMsg.style.color = '#f66';
  }
});