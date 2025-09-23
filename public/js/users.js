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
      // User is logged in - show account button
      document.getElementById('accountBtn').style.display = 'block';
      
      // Update profile info
      document.getElementById('profileUsername').textContent = result.user.username;
      // Store the real email for toggle functionality
      if (result.user.email) {
        document.getElementById('profileEmail').setAttribute('data-email', result.user.email);
        document.getElementById('profileEmail').textContent = '***@***.***';
      }
      
      // Fix date formatting
      const createdDate = new Date(result.user.created_at);
      if (!isNaN(createdDate.getTime())) {
        document.getElementById('profileCreated').textContent = createdDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } else {
        document.getElementById('profileCreated').textContent = 'Unknown';
      }
      
      // Check if admin
      if (result.user.role !== 'admin') {
        alert('Access denied. Admin privileges required.');
        window.location.href = '/';
        return;
      }
    } else {
      // Not logged in
      alert('Please log in to access user accounts.');
      window.location.href = '/';
    }
  } catch (error) {
    alert('Please log in to access user accounts.');
    window.location.href = '/';
  }
}

// Load all users
async function loadUsers() {
  const usersTable = document.getElementById('usersTable');
  try {
    const { users } = await api('/api/admin/users');
    
    if (users.length === 0) {
      usersTable.innerHTML = '<p>No users found</p>';
      return;
    }
    
    // Update total count
    document.getElementById('totalUsers').textContent = `Total Users: ${users.length}`;
    
    // Create users table
    usersTable.innerHTML = `
      <div class="users-table">
        <div class="table-header">
          <div>ID</div>
          <div>Username</div>
          <div>Email</div>
          <div>Role</div>
          <div>Joined</div>
          <div>Actions</div>
        </div>
        ${users.map(user => `
          <div class="table-row">
            <div>${user.id}</div>
            <div>${user.username}</div>
            <div>${user.email}</div>
            <div><span class="role-badge ${user.role}">${user.role}</span></div>
            <div>${new Date(user.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}</div>
            <div>
              <button class="show-password-btn" data-id="${user.id}" data-username="${user.username}">
                Show Password
              </button>
              <button class="delete-user-btn" data-id="${user.id}" ${user.role === 'admin' ? 'disabled' : ''}>
                ${user.role === 'admin' ? 'Protected' : 'Delete'}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    // Add delete event listeners
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.target.dataset.id;
        if (confirm('Are you sure you want to delete this user?')) {
          try {
            await api(`/api/admin/users/${userId}`, { method: 'DELETE' });
            loadUsers(); // Reload the list
          } catch (error) {
            alert('Error deleting user: ' + error.message);
          }
        }
      });
    });
    
    // Add password reveal event listeners
    document.querySelectorAll('.show-password-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.target.dataset.id;
        const username = e.target.dataset.username;
        
        // Ask for admin password
        const adminPassword = prompt(`Enter admin password to reveal password for ${username}:`);
        if (!adminPassword) return;
        
        try {
          const result = await api(`/api/admin/users/${userId}/password`, { 
            method: 'POST',
            body: JSON.stringify({ adminPassword })
          });
          
          // Show password in a modal or alert
          alert(`Password for ${username}: ${result.password}\n\n${result.note}`);
        } catch (error) {
          alert('Error: ' + error.message);
        }
      });
    });
    
  } catch (error) {
    usersTable.innerHTML = `<p style="color: #f66;">Error loading users: ${error.message}</p>`;
  }
}

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
  window.location.href = '/';
});

// Email toggle functionality
document.getElementById('toggleProfileEmailBtn')?.addEventListener('click', ()=>{
  const emailSpan = document.getElementById('profileEmail');
  const toggleBtn = document.getElementById('toggleProfileEmailBtn');
  const realEmail = emailSpan.getAttribute('data-email');
  
  if (emailSpan.textContent === '***@***.***') {
    emailSpan.textContent = realEmail;
    toggleBtn.textContent = 'Hide Email';
  } else {
    emailSpan.textContent = '***@***.***';
    toggleBtn.textContent = 'Show Email';
  }
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
loadUsers();
