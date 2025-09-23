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

// Load gallery management
async function loadGallery() {
  const galleryList = document.getElementById('galleryList');
  try {
    const { items } = await api('/api/admin/media');
    if (items.length === 0) {
      galleryList.innerHTML = '<p>No media in gallery</p>';
      return;
    }
    
    galleryList.innerHTML = '';
    items.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'gallery-item';
      itemDiv.style.cssText = 'border: 1px solid #ccc; margin: 10px 0; padding: 10px; border-radius: 5px; display: flex; align-items: center; gap: 10px;';
      
      const preview = document.createElement('div');
      preview.style.cssText = 'width: 80px; height: 60px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 3px;';
      
      if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = item.url;
        img.style.cssText = 'max-width: 80px; max-height: 60px; object-fit: cover; border-radius: 3px;';
        img.onerror = () => { preview.textContent = 'IMG'; };
        preview.appendChild(img);
      } else {
        const video = document.createElement('video');
        video.src = item.url;
        video.style.cssText = 'max-width: 80px; max-height: 60px; object-fit: cover; border-radius: 3px;';
        video.onerror = () => { preview.textContent = 'VID'; };
        preview.appendChild(video);
      }
      
      const info = document.createElement('div');
      info.style.cssText = 'flex: 1;';
      info.innerHTML = `
        <div><strong>${item.title || 'Untitled'}</strong></div>
        <div style="font-size: 12px; color: #666;">${item.type.toUpperCase()} • ${item.likes} likes • ${item.category || 'No category'}</div>
        <div style="font-size: 11px; color: #999;">Added: ${new Date(item.created_at).toLocaleDateString()}</div>
        <div style="font-size: 11px; color: ${item.is_approved ? '#6f6' : '#f66'};">${item.is_approved ? 'Approved' : 'Pending'}</div>
      `;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.style.cssText = 'background: #f66; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;';
      deleteBtn.onclick = () => deleteMedia(item.id, itemDiv);
      
      itemDiv.appendChild(preview);
      itemDiv.appendChild(info);
      itemDiv.appendChild(deleteBtn);
      galleryList.appendChild(itemDiv);
    });
  } catch (error) {
    galleryList.innerHTML = `<p style="color: #f66;">Error loading gallery: ${error.message}</p>`;
  }
}

async function deleteMedia(id, element) {
  if (!confirm('Are you sure you want to delete this media?')) return;
  
  try {
    await api(`/api/admin/media/${id}`, { method: 'DELETE' });
    element.remove();
    document.getElementById('adminMsg').textContent = 'Media deleted successfully';
    document.getElementById('adminMsg').style.color = '#6f6';
  } catch (error) {
    document.getElementById('adminMsg').textContent = 'Error deleting media: ' + error.message;
    document.getElementById('adminMsg').style.color = '#f66';
  }
}

// Load gallery when page loads
loadGallery();

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
    
    // Clear form
    document.getElementById('title').value = '';
    document.getElementById('url').value = '';
    document.getElementById('category').value = '';
    
    // Refresh gallery list
    loadGallery();
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
    
    // Refresh gallery list
    loadGallery();
  }catch(err){
    adminMsg.textContent = err.message;
    adminMsg.style.color = '#f66';
  }
});

document.getElementById('removeDuplicatesBtn').addEventListener('click', async ()=>{
  const adminMsg = document.getElementById('adminMsg');
  if (!confirm('Are you sure you want to remove duplicate media?')) return;
  
  try{
    const result = await api('/api/admin/remove-duplicates',{ method:'POST'});
    adminMsg.textContent = result.message;
    adminMsg.style.color = '#6f6';
    
    // Refresh gallery list
    loadGallery();
  }catch(err){
    adminMsg.textContent = err.message;
    adminMsg.style.color = '#f66';
  }
});