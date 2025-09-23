async function api(path, opts={}) {
  try {
    const res = await fetch(path, { credentials:'include', headers:{'content-type':'application/json'}, ...opts });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `HTTP ${res.status}: Request failed`);
    }
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

async function load() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '<p>Loading…</p>';
  try {
    const { items } = await api('/api/media');
    grid.innerHTML = '';
    items.forEach(m => {
      const el = document.createElement('div');
      el.className = 'card';
      if (m.type === 'image') {
        const img = new Image(); img.loading='lazy'; img.src = m.url; el.appendChild(img);
      } else {
        const v = document.createElement('video'); v.controls = true; v.preload='metadata';
        const s = document.createElement('source'); s.src = m.url; s.type = 'video/mp4'; v.appendChild(s);
        el.appendChild(v);
      }
      const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.marginTop='6px';
      row.innerHTML = `<span>${m.title ?? ''}</span><button data-id="${m.id}" class="like">❤ ${m.likes}</button>`;
      el.appendChild(row);
      grid.appendChild(el);
    });

    grid.addEventListener('click', async (e)=>{
      const b = e.target.closest('button.like'); if(!b) return;
      const id = b.getAttribute('data-id');
      try{ await api(`/api/media/${id}/like`, { method:'POST' }); b.textContent = '❤ ' + (parseInt(b.textContent.slice(2)) + 1); }catch(err){ alert(err.message); }
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:#f66">${err.message}</p>`;
  }
}

// Simple auth bar
document.getElementById('loginBtn')?.addEventListener('click', async ()=>{
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    alert('Please enter both email and password');
    return;
  }
  
  try { 
    console.log('Attempting login with:', email);
    const result = await api('/api/auth/login',{ method:'POST', body: JSON.stringify({ email, password })});
    console.log('Login successful:', result);
    location.reload(); 
  }
  catch(err){ 
    console.error('Login error:', err);
    alert('Login failed: ' + err.message); 
  }
});
document.getElementById('logoutBtn')?.addEventListener('click', async ()=>{
  await api('/api/auth/logout',{ method:'POST' }); location.reload();
});

// Registration functionality
document.getElementById('showRegisterBtn')?.addEventListener('click', ()=>{
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
});

document.getElementById('showLoginBtn')?.addEventListener('click', ()=>{
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
});

document.getElementById('registerBtn')?.addEventListener('click', async ()=>{
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  
  if (!username || !email || !password) {
    alert('Please fill in all fields');
    return;
  }
  
  try { 
    console.log('Attempting registration with:', email);
    const result = await api('/api/auth/register',{ method:'POST', body: JSON.stringify({ username, email, password })});
    console.log('Registration successful:', result);
    alert('Registration successful! You are now logged in.');
    location.reload(); 
  }
  catch(err){ 
    console.error('Registration error:', err);
    alert('Registration failed: ' + err.message); 
  }
});

load();
