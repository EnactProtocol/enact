// Enact Environment Manager - Client-side JavaScript
let currentPackage = null;
let packages = [];

document.addEventListener('DOMContentLoaded', () => {
  loadPackages();
  
  // Check URL parameters for bulk variable requests
  checkUrlForVars();
  
  // Event listeners
  document.getElementById('env-var-form').addEventListener('submit', saveVariable);
  document.getElementById('clear-form-btn').addEventListener('click', clearForm);
  document.getElementById('create-package-btn').addEventListener('click', createPackage);
  
  // Link generator event listeners
  document.getElementById('generate-link-btn').addEventListener('click', generateLink);
  document.getElementById('copy-link-btn').addEventListener('click', copyLink);
  
  // Modal event listeners
  document.getElementById('close-modal').addEventListener('click', closeBulkModal);
  document.getElementById('cancel-bulk').addEventListener('click', closeBulkModal);
  document.getElementById('bulk-form').addEventListener('submit', saveBulkVariables);
});

// Check URL parameters for bulk variable requests
function checkUrlForVars() {
  const urlParams = new URLSearchParams(window.location.search);
  const varsParam = urlParams.get('vars');
  const packageParam = urlParams.get('package');
  
  if (varsParam) {
    try {
      let varsArray;
      // Try to parse as JSON first
      if (varsParam.startsWith('[') && varsParam.endsWith(']')) {
        varsArray = JSON.parse(varsParam);
      } else {
        // Fallback to comma-separated string
        varsArray = varsParam.split(',').map(item => item.trim()).filter(item => item);
      }
      
      if (varsArray && varsArray.length > 0) {
        // Set current package if specified
        if (packageParam) {
          currentPackage = packageParam;
        }
        
        // Wait for packages to load before opening modal
        setTimeout(() => {
          openBulkModal(varsArray);
        }, 100);
      }
    } catch (error) {
      console.error('Error parsing URL variables:', error);
      showNotification('Invalid variables format in URL', 'error');
    }
  }
}

// Function to open bulk modal with variables
function openBulkModal(variables) {
  const bulkVariablesContainer = document.getElementById('bulk-variables-container');
  bulkVariablesContainer.innerHTML = '';
  
  // Add package selection if no current package is selected
  if (!currentPackage) {
    const packageSelectContainer = document.createElement('div');
    packageSelectContainer.className = 'form-group';
    
    const packageOptions = packages.map(pkg => 
      `<option value="${escapeHtml(pkg.namespace)}">${escapeHtml(pkg.namespace)}</option>`
    ).join('');
    
    packageSelectContainer.innerHTML = `
      <label for="bulk-package-select">Select Package Namespace</label>
      <select id="bulk-package-select" required>
        <option value="">-- Select a package --</option>
        ${packageOptions}
      </select>
      <small style="color: #666; font-size: 0.9em;">Or <a href="#" onclick="showCreatePackageForBulk(event)">create a new package</a></small>
    `;
    bulkVariablesContainer.appendChild(packageSelectContainer);
    
    // Add event listener for package selection
    document.getElementById('bulk-package-select').addEventListener('change', function(e) {
      currentPackage = e.target.value;
    });
  } else {
    // Show current package
    const packageInfoContainer = document.createElement('div');
    packageInfoContainer.className = 'form-group';
    packageInfoContainer.innerHTML = `
      <label>Package Namespace</label>
      <div style="background-color: #f1f1f1; padding: 8px; border-radius: 4px; font-family: monospace;">${escapeHtml(currentPackage)}</div>
    `;
    bulkVariablesContainer.appendChild(packageInfoContainer);
  }
  
  variables.forEach((key, index) => {
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'form-group';
    
    fieldContainer.innerHTML = `
      <label for="bulk-value-${index}">${escapeHtml(key)}</label>
      <input type="text" id="bulk-value-${index}" name="${escapeHtml(key)}" required>
    `;
    
    bulkVariablesContainer.appendChild(fieldContainer);
  });
  
  document.getElementById('bulk-modal').style.display = 'block';
}

// Function to close bulk modal
function closeBulkModal() {
  document.getElementById('bulk-modal').style.display = 'none';
  // Clear URL parameters after closing modal
  const url = new URL(window.location);
  url.searchParams.delete('vars');
  url.searchParams.delete('package');
  window.history.replaceState({}, '', url);
}

// Function to show create package form in bulk modal
function showCreatePackageForBulk(event) {
  event.preventDefault();
  const bulkVariablesContainer = document.getElementById('bulk-variables-container');
  const packageSelectContainer = bulkVariablesContainer.querySelector('.form-group');
  
  packageSelectContainer.innerHTML = `
    <label for="bulk-new-package">Create New Package Namespace</label>
    <input type="text" id="bulk-new-package" placeholder="e.g., org/package/subpackage" required>
    <button type="button" onclick="createPackageForBulk(event)">Create Package</button>
    <small style="color: #666; font-size: 0.9em;">Or <a href="#" onclick="showPackageSelectForBulk(event)">select existing package</a></small>
  `;
}

// Function to show package select in bulk modal
function showPackageSelectForBulk(event) {
  event.preventDefault();
  const bulkVariablesContainer = document.getElementById('bulk-variables-container');
  const packageSelectContainer = bulkVariablesContainer.querySelector('.form-group');
  
  const packageOptions = packages.map(pkg => 
    `<option value="${escapeHtml(pkg.namespace)}">${escapeHtml(pkg.namespace)}</option>`
  ).join('');
  
  packageSelectContainer.innerHTML = `
    <label for="bulk-package-select">Select Package Namespace</label>
    <select id="bulk-package-select" required>
      <option value="">-- Select a package --</option>
      ${packageOptions}
    </select>
    <small style="color: #666; font-size: 0.9em;">Or <a href="#" onclick="showCreatePackageForBulk(event)">create a new package</a></small>
  `;
  
  // Add event listener for package selection
  document.getElementById('bulk-package-select').addEventListener('change', function(e) {
    currentPackage = e.target.value;
  });
}

// Function to create package for bulk variables
async function createPackageForBulk(event) {
  event.preventDefault();
  const newPackageInput = document.getElementById('bulk-new-package');
  const namespace = newPackageInput.value.trim();
  
  if (!namespace) {
    showNotification('Package namespace is required', 'error');
    return;
  }
  
  if (!/^[a-zA-Z0-9_-]+([\/][a-zA-Z0-9_-]+)*$/.test(namespace)) {
    showNotification('Invalid package namespace format. Use format like "org/package" or "org/package/subpackage"', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/packages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ namespace })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create package');
    }
    
    // Set as current package and update UI
    currentPackage = namespace;
    await loadPackages(); // Refresh package list
    
    // Update the bulk modal to show the created package
    const bulkVariablesContainer = document.getElementById('bulk-variables-container');
    const packageSelectContainer = bulkVariablesContainer.querySelector('.form-group');
    packageSelectContainer.innerHTML = `
      <label>Package Namespace</label>
      <div style="background-color: #e8f5e8; padding: 8px; border-radius: 4px; font-family: monospace; border: 1px solid #4caf50;">${escapeHtml(namespace)} <small style="color: #4caf50;">(created)</small></div>
    `;
    
    showNotification(`Package "${namespace}" created successfully`, 'success');
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Function to save bulk variables
async function saveBulkVariables(event) {
  event.preventDefault();
  
  // Check if package is selected from the dropdown if no current package
  if (!currentPackage) {
    const packageSelect = document.getElementById('bulk-package-select');
    if (packageSelect && packageSelect.value) {
      currentPackage = packageSelect.value;
    }
  }
  
  if (!currentPackage) {
    showNotification('Please select or create a package first', 'error');
    return;
  }
  
  const formData = new FormData(document.getElementById('bulk-form'));
  const variables = {};
  let successCount = 0;
  
  // Collect all variables from the form (excluding package selection)
  for (const [key, value] of formData.entries()) {
    if (key !== 'package-select' && value.trim()) { 
      variables[key] = value.trim();
    }
  }
  
  if (Object.keys(variables).length === 0) {
    showNotification('No variables to save', 'error');
    return;
  }
  
  // Save each variable via API
  for (const [key, value] of Object.entries(variables)) {
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(currentPackage)}/variables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, value })
      });
      
      if (response.ok) {
        successCount++;
      } else {
        const error = await response.json();
        console.error(`Error saving ${key}:`, error.error || "Unknown error");
      }
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  }
  
  closeBulkModal();
  showNotification(`Successfully saved ${successCount} out of ${Object.keys(variables).length} variables to package "${currentPackage}"`, 'success');
  
  // Reload data
  await loadPackages();
  if (currentPackage) {
    // Find and select the package in the UI
    setTimeout(() => {
      const packageItems = document.querySelectorAll('.package-item');
      for (const item of packageItems) {
        if (item.textContent.includes(currentPackage)) {
          item.click();
          break;
        }
      }
    }, 100);
  }
}

// Function to generate link with variables
function generateLink() {
  const varsInput = document.getElementById('vars-input');
  const packageInput = document.getElementById('package-input');
  const linkOutput = document.getElementById('link-output');
  const linkOutputContainer = document.getElementById('link-output-container');
  
  const vars = varsInput.value
    .split(/[\n,]/) // Split by newline or comma
    .map(item => item.trim())
    .filter(item => item); // Remove empty items
  
  if (vars.length === 0) {
    showNotification('Please enter at least one variable', 'error');
    return;
  }
  
  const baseUrl = window.location.origin + window.location.pathname;
  const varsParam = encodeURIComponent(JSON.stringify(vars));
  let url = `${baseUrl}?vars=${varsParam}`;
  
  // Add package parameter if specified
  const packageName = packageInput.value.trim();
  if (packageName) {
    url += `&package=${encodeURIComponent(packageName)}`;
  }
  
  linkOutput.textContent = url;
  linkOutputContainer.style.display = 'block';
}

// Function to copy link to clipboard
function copyLink() {
  const linkOutput = document.getElementById('link-output');
  navigator.clipboard.writeText(linkOutput.textContent)
    .then(() => {
      showNotification('Link copied to clipboard', 'success');
    })
    .catch(() => {
      showNotification('Failed to copy link', 'error');
    });
}

async function loadPackages() {
  try {
    const response = await fetch('/api/packages');
    const data = await response.json();
    packages = data.packages;
    renderPackageList();
  } catch (error) {
    showNotification('Error loading packages: ' + error.message, 'error');
  }
}

function renderPackageList() {
  const container = document.getElementById('package-list-content');
  
  if (packages.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No packages found</p><p>Create your first package using the form below</p></div>';
    return;
  }
  
  container.innerHTML = packages.map(pkg => `
    <div class="package-item" onclick="selectPackage('${escapeForJs(pkg.namespace)}')">
      <div class="package-name">${escapeHtml(pkg.namespace)}</div>
      <div class="package-path">${escapeHtml(pkg.path)}</div>
      <div class="package-var-count">${Object.keys(pkg.variables).length} variables</div>
    </div>
  `).join('');
}

async function selectPackage(namespace) {
  currentPackage = namespace;
  
  // Update UI
  document.querySelectorAll('.package-item').forEach(item => item.classList.remove('active'));
  // Find the clicked item and make it active
  const packageItems = document.querySelectorAll('.package-item');
  for (const item of packageItems) {
    if (item.textContent.includes(namespace)) {
      item.classList.add('active');
      break;
    }
  }
  
  document.getElementById('selected-package-title').textContent = namespace;
  document.getElementById('add-var-form').style.display = 'block';
  
  // Load package details
  try {
    const response = await fetch(`/api/packages/${encodeURIComponent(namespace)}`);
    const data = await response.json();
    renderPackageDetail(data.variables);
  } catch (error) {
    showNotification('Error loading package details: ' + error.message, 'error');
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// For use in onclick attributes - only escape quotes that would break JS
function escapeForJs(unsafe) {
  return unsafe
    .toString()
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

function renderPackageDetail(variables) {
  const container = document.getElementById('package-detail-content');
  
  if (Object.keys(variables).length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No environment variables</p><p>Add your first variable using the form below</p></div>';
    return;
  }
  
  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th>Variable Name</th>
          <th>Value</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  for (const [key, value] of Object.entries(variables)) {
    const escapedKey = escapeForJs(key);
    const escapedValue = escapeForJs(value);
    tableHtml += `
      <tr>
        <td>${escapeHtml(key)}</td>
        <td class="value-cell">
          <span class="masked-value" data-key="${escapeHtml(key)}" data-value="${escapeHtml(value)}">••••••••</span>
        </td>
        <td>
          <div class="actions">
            <button class="view" onclick="toggleValue('${escapedKey}')">View</button>
            <button onclick="editVariable('${escapedKey}', '${escapedValue}')">Edit</button>
            <button class="delete" onclick="deleteVariable('${escapedKey}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }
  
  tableHtml += '</tbody></table>';
  container.innerHTML = tableHtml;
}

function toggleValue(key) {
  const element = document.querySelector(`[data-key='${CSS.escape(key)}']`);
  const button = event.target;
  
  if (element.textContent === '••••••••') {
    element.textContent = element.dataset.value;
    button.textContent = 'Hide';
    button.classList.remove('view');
    button.classList.add('hide');
  } else {
    element.textContent = '••••••••';
    button.textContent = 'View';
    button.classList.remove('hide');
    button.classList.add('view');
  }
}

function editVariable(key, value) {
  document.getElementById('var-key').value = key;
  document.getElementById('var-value').value = value;
  document.getElementById('var-key').setAttribute('readonly', true);
  document.getElementById('var-key').style.backgroundColor = '#f1f1f1';
}

async function deleteVariable(key) {
  if (!confirm(`Are you sure you want to delete variable "${key}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/packages/${encodeURIComponent(currentPackage)}/variables/${encodeURIComponent(key)}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete variable');
    }
    
    showNotification(`Variable "${key}" deleted successfully`, 'success');
    selectPackage(currentPackage); // Reload package details
    loadPackages(); // Reload package list to update counts
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function saveVariable(event) {
  event.preventDefault();
  
  if (!currentPackage) {
    showNotification('Please select a package first', 'error');
    return;
  }
  
  const formData = new FormData(event.target);
  const key = formData.get('key').trim();
  const value = formData.get('value').trim();
  
  if (!key || !value) {
    showNotification('Variable name and value are required', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/packages/${encodeURIComponent(currentPackage)}/variables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ key, value })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save variable');
    }
    
    showNotification(`Variable "${key}" saved successfully`, 'success');
    clearForm();
    selectPackage(currentPackage); // Reload package details
    loadPackages(); // Reload package list to update counts
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function createPackage() {
  const namespace = document.getElementById('new-package-namespace').value.trim();
  
  if (!namespace) {
    showNotification('Package namespace is required', 'error');
    return;
  }
  
  if (!/^[a-zA-Z0-9_-]+([\/][a-zA-Z0-9_-]+)*$/.test(namespace)) {
    showNotification('Invalid package namespace format. Use format like "org/package" or "org/package/subpackage"', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/packages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ namespace })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create package');
    }
    
    showNotification(`Package "${namespace}" created successfully`, 'success');
    document.getElementById('new-package-namespace').value = '';
    loadPackages();
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

function clearForm() {
  document.getElementById('var-key').value = '';
  document.getElementById('var-value').value = '';
  document.getElementById('var-key').removeAttribute('readonly');
  document.getElementById('var-key').style.backgroundColor = '';
}

function showNotification(message, type) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type}`;
  
  setTimeout(() => {
    notification.style.opacity = '0';
  }, 3000);
}

// Make functions globally accessible for onclick handlers
window.showCreatePackageForBulk = showCreatePackageForBulk;
window.showPackageSelectForBulk = showPackageSelectForBulk;
window.createPackageForBulk = createPackageForBulk;
