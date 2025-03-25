// Debug logging for Chrome APIs
console.log('Chrome APIs available:', {
  tabs: typeof chrome.tabs !== 'undefined',
  scripting: typeof chrome.scripting !== 'undefined',
  runtime: typeof chrome.runtime !== 'undefined'
});

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize scan button
  const scanButton = document.getElementById('scan-button');
  if (scanButton) {
    scanButton.addEventListener('click', scanTablesAndOpenViewer);
    console.log('Scan button event listener added');
  } else {
    console.error('Scan button not found!');
  }
});

// Scan tables and open viewer window
async function scanTablesAndOpenViewer() {
  console.log('Scan tables function called');
  const statusElement = document.getElementById('status');
  statusElement.textContent = 'Scanning for tables...';
  
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Current tab:', tab.id);
    
    // Inject and execute content script to find tables
    console.log('Executing findTables script');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: findTables
    });
    
    const tables = results[0].result;
    console.log('Tables found:', tables.length);
    
    if (tables.length === 0) {
      statusElement.textContent = 'No tables found on this page.';
      return;
    }
    
    statusElement.textContent = `Found ${tables.length} tables. Opening viewer...`;
    
    try {
      // Use background script for data transfer
      console.log('Sending data to background script');
      chrome.runtime.sendMessage({
        action: 'storeTableData',
        data: {
          tables: tables,
          tabId: tab.id,
          url: tab.url
        }
      }, response => {
        if (response && response.success) {
          console.log('Data stored successfully');
          // Open the viewer in a new window
          chrome.windows.create({
            url: chrome.runtime.getURL('viewer.html'),
            type: 'popup',
            width: 1200,
            height: 800
          });
        } else {
          console.error('Failed to store data in background script');
          statusElement.textContent = 'Error storing data';
        }
      });
    } catch (storageError) {
      console.error('Error communicating with background script:', storageError);
      statusElement.textContent = `Error: ${storageError.message}`;
    }
    
  } catch (error) {
    console.error('Scan tables error:', error);
    statusElement.textContent = `Error: ${error.message}`;
  }
}

// Function that will be injected to find tables
function findTables() {
  console.log('findTables executing in page context');
  const tables = document.getElementsByTagName('table');
  console.log('Raw tables found:', tables.length);
  
  return Array.from(tables).map((table, index) => {
    // Get basic information about the table
    const rows = table.rows.length;
    const cols = table.rows[0]?.cells.length || 0;
    
    // Get a preview of the table (first row as header, up to 3 rows of data)
    const headerRow = table.rows[0];
    const headers = headerRow ? Array.from(headerRow.cells).map(cell => cell.innerText.trim()) : [];
    
    const previewRows = [];
    const maxPreviewRows = Math.min(3, table.rows.length - 1);
    
    for (let i = 1; i <= maxPreviewRows; i++) {
      const row = table.rows[i];
      if (row) {
        previewRows.push(Array.from(row.cells).map(cell => cell.innerText.trim()));
      }
    }
    
    return {
      index,
      rows,
      cols,
      headers,
      previewRows,
      selector: getTableSelector(table)
    };
  });
  
  // Helper function to get a unique selector for a table
  function getTableSelector(element) {
    // First try ID
    if (element.id) {
      return `#${element.id}`;
    }
    
    // Next try unique class combinations
    if (element.className) {
      const classes = element.className.split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        const selector = `.${classes.join('.')}`;
        // Check if this selector uniquely identifies the table
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }
    }
    
    // If no unique ID/class, create a positional selector
    let current = element;
    let nth = '';
    
    // Get position among siblings of same type
    if (current.parentNode) {
      const siblings = Array.from(current.parentNode.children).filter(
        sibling => sibling.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        nth = `:nth-of-type(${index})`;
      }
    }
    
    // Build a selector that includes table position 
    return `table${nth}`;
  }
}