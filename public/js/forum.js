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

// Check if user is logged in and update UI
async function checkAuthStatus() {
  try {
    const result = await api('/api/auth/me');
    if (result.user) {
      // User is logged in - hide login form, show logout and account
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('logoutBtn').style.display = 'block';
      document.getElementById('accountBtn').style.display = 'block';
      document.getElementById('newPostBtn').style.display = 'block';
      
      // Update profile info
      document.getElementById('profileUsername').textContent = result.user.username;
      document.getElementById('profileEmail').textContent = result.user.email;
      document.getElementById('profileCreated').textContent = new Date(result.user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Show/hide admin link based on role
      const adminLink = document.querySelector('nav a[href="/admin"]');
      if (adminLink) {
        if (result.user.role === 'admin') {
          adminLink.style.display = 'block';
        } else {
          adminLink.style.display = 'none';
        }
      }
    } else {
      // User is not logged in - show login form, hide logout and admin
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('logoutBtn').style.display = 'none';
      document.getElementById('accountBtn').style.display = 'none';
      document.getElementById('newPostBtn').style.display = 'none';
      
      // Hide admin link when not logged in
      const adminLink = document.querySelector('nav a[href="/admin"]');
      if (adminLink) {
        adminLink.style.display = 'none';
      }
    }
  } catch (error) {
    // Not logged in - show login form, hide admin
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('accountBtn').style.display = 'none';
    document.getElementById('newPostBtn').style.display = 'none';
    
    // Hide admin link when not logged in
    const adminLink = document.querySelector('nav a[href="/admin"]');
    if (adminLink) {
      adminLink.style.display = 'none';
    }
  }
}

// Login functionality
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
    await checkAuthStatus(); // Update UI after login
  }
  catch(err){ 
    console.error('Login error:', err);
    alert('Login failed: ' + err.message); 
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', async ()=>{
  await api('/api/auth/logout',{ method:'POST' }); 
  await checkAuthStatus(); // Update UI after logout
});

// Profile dropdown functionality
document.getElementById('accountBtn')?.addEventListener('click', ()=>{
  const dropdown = document.getElementById('profileDropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('closeProfileBtn')?.addEventListener('click', ()=>{
  document.getElementById('profileDropdown').style.display = 'none';
});

document.getElementById('logoutFromProfileBtn')?.addEventListener('click', async ()=>{
  await api('/api/auth/logout',{ method:'POST' }); 
  document.getElementById('profileDropdown').style.display = 'none';
  await checkAuthStatus(); // Update UI after logout
});

// Email toggle functionality
document.getElementById('toggleProfileEmailBtn')?.addEventListener('click', ()=>{
  const emailSpan = document.getElementById('profileEmail');
  const toggleBtn = document.getElementById('toggleProfileEmailBtn');
  
  if (emailSpan.style.display === 'none') {
    emailSpan.style.display = 'inline';
    toggleBtn.textContent = 'Hide Email';
  } else {
    emailSpan.style.display = 'none';
    toggleBtn.textContent = 'Show Email';
  }
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
    await checkAuthStatus(); // Update UI after registration
  }
  catch(err){ 
    console.error('Registration error:', err);
    alert('Registration failed: ' + err.message); 
  }
});

// New post functionality
document.getElementById('newPostBtn')?.addEventListener('click', ()=>{
  const title = prompt('Post Title:');
  if (!title) return;
  
  const content = prompt('Post Content:');
  if (!content) return;
  
  // For now, just show an alert - we'll implement the backend later
  alert('New post feature coming soon!');
});

// Close profile dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('profileDropdown');
  const accountBtn = document.getElementById('accountBtn');
  
  if (dropdown && !dropdown.contains(e.target) && !accountBtn.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

// Initialize the page
checkAuthStatus();
