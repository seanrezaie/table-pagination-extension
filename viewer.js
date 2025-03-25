// global state for store all data we need
let state = {
    tables: [],             // list of tables found on page
    currentTableIndex: -1,  // which table we looking at now (-1 mean none)
    tabId: null,            // id of tab where tables found
    url: '',                // url of the page with tables
    tableData: null,        // actual data for selected table
    stats: {
      pagesScrapped: 0,     // how many pages we already get
      rowsCollected: 0,     // total rows collected from all pages
      rowsLastPage: 0,      // rows from last page only
      workingTime: 0,       // how long we working in seconds
      startTime: null       // when we started the extraction
    },
    nextButtonSelector: null, // css selector for find next button
    scraping: false         // if we currently scraping pages
  };
  
  // start everything when page is ready
  document.addEventListener('DOMContentLoaded', async () => {
    // setup all buttons click handlers
    document.getElementById('try-another-table').addEventListener('click', showTableSelection);
    document.getElementById('locate-next-button').addEventListener('click', locateNextButton);
    document.getElementById('exportCSV').addEventListener('click', exportToCSV);
    document.getElementById('exportXLSX').addEventListener('click', exportToXLSX);
    document.getElementById('copyAll').addEventListener('click', copyAllData);
    
    // get tables data from storage or url
    await loadTablesData();
    
    // show dialog to let user pick a table
    showTableSelection();

    // log for debug purpose
    console.log('viewer loaded, initial state:', state);
  });
  
  // get tables data from background script or url parameters
  async function loadTablesData() {
    return new Promise((resolve) => {
      // first try get from url (this is backup method)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('data')) {
        try {
          // decode and parse json data from url
          const data = JSON.parse(decodeURIComponent(urlParams.get('data')));
          state.tables = data.tables;
          state.tabId = data.tabId;
          state.url = data.url;
          console.log('loaded data from url parameters:', data);
          resolve();
          return;
        } catch (error) {
          // if error happen during parse
          console.error('error when parsing url data:', error);
        }
      }
      
      // if no url data, try get from background script
      console.log('trying to get data from background script');
      chrome.runtime.sendMessage({action: 'getTableData'}, (response) => {
        console.log('background script response:', response);
        if (response && response.data) {
          // save data to our state
          state.tables = response.data.tables;
          state.tabId = response.data.tabId;
          state.url = response.data.url;
          console.log('loaded data from background script:', state);
          resolve();
        } else {
          // no data found, show error
          showToast('No table data found. Please scan for tables first.', 'error');
          resolve();
        }
      });
    });
  }
  
  // show popup for user to select which table they want
  function showTableSelection() {
    // remove old modal if exist already
    const existingModal = document.getElementById('table-selection-modal');
    if (existingModal) {
      document.body.removeChild(existingModal);
    }
    
    // create big container for modal
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    modalOverlay.id = 'table-selection-modal';
    modalOverlay.style.overflow = 'auto'; // let user scroll whole modal
    modalOverlay.style.padding = '1rem';
    
    // create actual modal box
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-card rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] flex flex-col';
    modalContent.style.maxHeight = '80vh';
    modalContent.style.position = 'relative'; // for position stuff inside
    
    // create header that stay at top when scroll
    const modalHeader = document.createElement('div');
    modalHeader.className = 'flex items-center justify-between p-4 border-b bg-card sticky top-0';
    modalHeader.style.zIndex = '10'; // make sure header on top
    modalHeader.innerHTML = `
      <div class="flex items-center gap-2">
        <img src="icons/logo_to_use_48.png" width="24" height="24" alt="Table Scraper Logo">
        <h2 class="text-lg font-semibold">Select a Table</h2>
      </div>
      <button id="close-selection" class="p-1 rounded-md hover:bg-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;
    
    // body part with content that can scroll
    const modalBody = document.createElement('div');
    modalBody.className = 'overflow-y-auto p-4 flex-1';
    modalBody.style.maxHeight = 'calc(80vh - 60px)'; // make room for header
    modalBody.style.overflowY = 'auto';
    
    // if no tables found show message
    if (state.tables.length === 0) {
      modalBody.innerHTML = `
        <div class="flex flex-col items-center justify-center h-40 text-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="mb-4">
            <path d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>No tables found on this page.</p>
        </div>
      `;
    } else {
      // if many tables add search box for find tables more easy
      let searchHTML = '';
      if (state.tables.length > 5) {
        searchHTML = `
          <div class="mb-4">
            <input type="text" id="table-search" placeholder="Search tables..." 
              class="w-full p-2 border border-border rounded-md" 
              style="border: 1px solid var(--border);">
          </div>
        `;
      }
      
      // build html for all tables we found
      modalBody.innerHTML = searchHTML + state.tables.map((table, index) => {
        // create small preview of the table to see data
        let previewHTML = '<div class="overflow-x-auto mb-3" style="max-height: 200px; overflow-y: auto;">';
        previewHTML += '<table class="min-w-full">';
        
        // add header row if table has headers
        if (table.headers && table.headers.length > 0) {
          previewHTML += '<thead><tr>';
          table.headers.forEach(header => {
            previewHTML += `<th class="text-sm sticky top-0 bg-secondary">${header}</th>`;
          });
          previewHTML += '</tr></thead>';
        }
        
        // add some rows as preview
        if (table.previewRows && table.previewRows.length > 0) {
          previewHTML += '<tbody>';
          table.previewRows.forEach((row, i) => {
            previewHTML += `<tr class="${i % 2 === 0 ? '' : 'bg-muted'}">`;
            row.forEach(cell => {
              previewHTML += `<td class="text-sm truncate max-w-[150px]">${cell}</td>`;
            });
            previewHTML += '</tr>';
          });
          previewHTML += '</tbody>';
        }
        
        previewHTML += '</table>';
        previewHTML += '</div>';
        
        // return complete html for each table card
        return `
          <div class="card mb-4 table-item" data-index="${index}">
            <h3 class="text-lg font-medium mb-2">Table ${index + 1} (${table.rows} rows × ${table.cols} columns)</h3>
            ${previewHTML}
            <div class="flex justify-end mt-3 px-4 pb-2">
              <button class="button button-primary select-table-btn" data-index="${index}">
                Select This Table
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
    
    // put all parts together and add to page
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // make close button work
    document.getElementById('close-selection').addEventListener('click', () => {
      document.body.removeChild(modalOverlay);
    });
    
    // also close when click outside modal
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        document.body.removeChild(modalOverlay);
      }
    });
    
    // keyboard support - ESC key to close modal
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(modalOverlay);
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    // make search box work if exist
    const searchInput = document.getElementById('table-search');
    if (searchInput) {
      searchInput.focus(); // put cursor in search box
      searchInput.addEventListener('input', (e) => {
        // search as user type
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('.table-item').forEach(item => {
          const text = item.textContent.toLowerCase();
          // show only table that match search term
          if (text.includes(searchTerm)) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      });
    }
    
    // handle clicking on select buttons for tables
    document.querySelectorAll('.select-table-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // get which table was picked and load it
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        selectTable(index);
        document.body.removeChild(modalOverlay);
        document.removeEventListener('keydown', handleKeyDown);
      });
    });
  }
  
  // when user select a table, load all its data
  async function selectTable(index) {
    if (index < 0 || index >= state.tables.length) {
      showToast('Invalid table index', 'error');
      return;
    }
    
    // save which table user choose
    state.currentTableIndex = index;
    
    try {
      // run script in webpage to get full table data
      const results = await chrome.scripting.executeScript({
        target: { tabId: state.tabId },
        function: scrapeTable,
        args: [state.tables[index].selector]
      });
      
      const tableData = results[0].result;
      
      // if something went wrong
      if (!tableData) {
        showToast('Could not load table data', 'error');
        return;
      }
      
      // save data and reset statistics
      state.tableData = tableData;
      state.stats.pagesScrapped = 1; // start with 1 page
      state.stats.rowsCollected = tableData.rows.length;
      state.stats.rowsLastPage = tableData.rows.length;
      state.stats.workingTime = 0;
      state.stats.startTime = new Date().getTime(); // start timer
      
      // show data on screen
      updateTableDisplay();
      updateStats();
    } catch (error) {
      showToast(`Error: ${error.message}`, 'error');
      console.error(error);
    }
  }
  
  // show table data in html table
  function updateTableDisplay() {
    const tableContainer = document.getElementById('tableContainer');
    
    // if no data yet, show placeholder
    if (!state.tableData || !state.tableData.headers || !state.tableData.rows) {
      tableContainer.innerHTML = `
        <div class="flex items-center justify-center p-8 text-muted">
          <div>Select a table to view data</div>
        </div>
      `;
      return;
    }
    
    // create html table element with data
    let html = '<table>';
    
    // add header row first
    html += '<thead><tr>';
    state.tableData.headers.forEach(header => {
      html += `<th>${header}</th>`;
    });
    html += '</tr></thead>';
    
    // then add all data rows
    html += '<tbody>';
    state.tableData.rows.forEach((row, i) => {
      // stripe rows for better reading
      html += `<tr class="${i % 2 === 0 ? '' : 'bg-muted'}">`;
      row.forEach(cell => {
        html += `<td>${cell || ''}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    
    // put html into container
    tableContainer.innerHTML = html;
  }
  
  // update statistics numbers on screen
  function updateStats() {
    // update all the statistic values
    document.getElementById('pagesScrapped').textContent = state.stats.pagesScrapped;
    document.getElementById('rowsCollected').textContent = state.stats.rowsCollected;
    document.getElementById('rowsLastPage').textContent = state.stats.rowsLastPage;
    
    // calculate elapsed time
    const currentTime = new Date().getTime();
    const elapsedSeconds = Math.floor((currentTime - state.stats.startTime) / 1000);
    state.stats.workingTime = elapsedSeconds;
    document.getElementById('workingTime').textContent = `${elapsedSeconds}s`;
  }
  
  // help user choose which button is next page
  function locateNextButton() {
    if (!state.tabId) {
      showToast('No active tab found', 'error');
      return;
    }
    
    // tell user what to do
    showToast('Please click on the "Next" button or link in the page to enable pagination', 'info');
    
    // inject script to highlite elements when mouse over
    chrome.scripting.executeScript({
      target: { tabId: state.tabId },
      function: prepareForNextButtonSelection
    });
  }
  
  // this function gets injected into webpage to help select next button
  function prepareForNextButtonSelection() {
    // save original style of elements
    const originalStyles = new Map();
    
    // when mouse move over element, highlight it
    function handleMouseOver(e) {
      // dont select table itself
      if (e.target.tagName === 'TABLE') return;
      
      // remember original style so we can put back
      if (!originalStyles.has(e.target)) {
        originalStyles.set(e.target, {
          outline: e.target.style.outline,
          backgroundColor: e.target.style.backgroundColor,
          cursor: e.target.style.cursor
        });
      }
      
      // make element stand out with blue outline
      e.target.style.outline = '2px solid #4285f4';
      e.target.style.backgroundColor = 'rgba(66, 133, 244, 0.1)';
      e.target.style.cursor = 'pointer';
      
      e.stopPropagation(); // stop event bubble up
    }
    
    // when mouse leave element, remove highlight
    function handleMouseOut(e) {
      const target = e.target;
      
      // put original style back
      if (originalStyles.has(target)) {
        const styles = originalStyles.get(target);
        target.style.outline = styles.outline;
        target.style.backgroundColor = styles.backgroundColor;
        target.style.cursor = styles.cursor;
      }
      
      e.stopPropagation(); // stop event bubble up
    }
    
    // when user click on element they want as next button
    function handleClick(e) {
      e.preventDefault(); // dont follow links
      e.stopPropagation(); // dont trigger other click handlers
      
      const target = e.target;
      
      // generate css selector we can use later to find element
      const selector = getElementSelector(target);
      
      // put original style back
      if (originalStyles.has(target)) {
        const styles = originalStyles.get(target);
        target.style.outline = styles.outline;
        target.style.backgroundColor = styles.backgroundColor;
        target.style.cursor = styles.cursor;
      }
      
      // remove all event listeners
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      
      // tell extension which element was selected
      chrome.runtime.sendMessage({
        action: 'nextButtonSelected',
        selector: selector
      });
      
      return false; // stop event 
    }
    
    // create css selector to find element later
    function getElementSelector(element) {
      // easiest if element has id
      if (element.id) {
        return `#${element.id}`;
      }
      
      // next best is class if unique
      if (element.className) {
        const classes = element.className.split(/\s+/).filter(c => c);
        
        if (classes.length > 0) {
          const selector = `.${classes.join('.')}`;
          
          // check if only one element match this selector
          if (document.querySelectorAll(selector).length === 1) {
            return selector;
          }
        }
      }
      
      // need more specific selector
      let selector = element.tagName.toLowerCase();
      
      // add position info to selector
      const parent = element.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(element);
        
        if (siblings.length > 1) {
          selector += `:nth-child(${index + 1})`;
        }
        
        // include parent info in selector to be more specific
        const parentSelector = parent.id ? `#${parent.id}` : parent.tagName.toLowerCase();
        return `${parentSelector} > ${selector}`;
      }
      
      return selector;
    }
    
    // add all event listeners
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    
    // tell extension we ready
    return { status: 'Selection mode activated' };
  }
  
  // save table data as csv file
  function exportToCSV() {
    if (!state.tableData) {
      showToast('No data to export', 'error');
      return;
    }
    
    try {
      // first convert data to csv text format
      const csv = convertToCSV(state.tableData);
      
      // create file to download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // trick to make browser download file
      const link = document.createElement('a');
      link.href = url;
      const fileName = `table_export_${new Date().toISOString().slice(0,10)}.csv`;
      link.setAttribute('download', fileName);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // tell user it worked
      showToast(`Exported to ${fileName}`, 'success');
    } catch (error) {
      showToast(`Error exporting to CSV: ${error.message}`, 'error');
      console.error(error);
    }
  }
  
  // export to excel format (not implemented yet)
  function exportToXLSX() {
    showToast('XLSX export will be implemented in a future version', 'info');
  }
  
  // copy all table data to clipboard
  function copyAllData() {
    if (!state.tableData) {
      showToast('No data to copy', 'error');
      return;
    }
    
    try {
      // create text version of data
      const text = convertToTabDelimited(state.tableData);
      
      // copy to clipboard
      navigator.clipboard.writeText(text).then(() => {
        showToast('All data copied to clipboard', 'success');
      }, (err) => {
        showToast(`Could not copy text: ${err.message}`, 'error');
      });
    } catch (error) {
      showToast(`Error copying data: ${error.message}`, 'error');
    }
  }
  
  // help function to make csv format
  function convertToCSV(tableData) {
    // first add headers row
    let csv = tableData.headers.map(header => 
      `"${(header || '').toString().replace(/"/g, '""')}"`
    ).join(',') + '\r\n';
    
    // then add all data rows
    tableData.rows.forEach(row => {
      csv += row.map(cell => 
        `"${(cell || '').toString().replace(/"/g, '""')}"`
      ).join(',') + '\r\n';
    });
    
    return csv;
  }
  
  // help function to make tab delimited format (good for paste to excel)
  function convertToTabDelimited(tableData) {
    // first add headers
    let text = tableData.headers.join('\t') + '\r\n';
    
    // then add all data rows
    tableData.rows.forEach(row => {
      text += row.join('\t') + '\r\n';
    });
    
    return text;
  }
  
  // begin the automatic scraping process
  function startScraping() {
    if (state.scraping) return; // dont start if already running
    
    if (!state.nextButtonSelector) {
      showToast('Please locate the "Next" button first', 'error');
      return;
    }
    
    // mark that we start scraping
    state.scraping = true;
    
    // change ui to show scraping active
    const startBtn = document.getElementById('start-scraping');
    const stopBtn = document.getElementById('stop-scraping');
    
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.style.opacity = '0.5'; // make button look disabled
    }
    
    if (stopBtn) {
      stopBtn.style.display = 'block'; // show stop button
      stopBtn.addEventListener('click', stopScraping);
    }
    
    showToast('Starting pagination crawl...', 'info');
    
    // start the actual process
    crawlNextPage();
  }
  
  // stop the automatic scraping process
  function stopScraping() {
    state.scraping = false;
    
    // return ui to normal state
    const startBtn = document.getElementById('start-scraping');
    const stopBtn = document.getElementById('stop-scraping');
    
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
    }
    
    if (stopBtn) {
      stopBtn.style.display = 'none';
    }
    
    showToast('Crawling stopped', 'info');
  }
  
  // process to get data from next page
  function crawlNextPage() {
    if (!state.scraping) return;
    
    // get delay settings from inputs
    const minDelay = parseFloat(document.getElementById('minDelay').value) || 1;
    const maxDelay = parseFloat(document.getElementById('maxDelay').value) || 20;
    
    // convert to millisecond (1000ms = 1s)
    const minDelayMs = minDelay * 1000;
    
    // show indicator that we doing something
    const indicator = document.createElement('div');
    indicator.className = 'toast toast-info';
    indicator.textContent = `Crawling page ${state.stats.pagesScrapped + 1}...`;
    
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
      toastContainer.appendChild(indicator);
    }
    
    // now click the next button in original page
    chrome.scripting.executeScript({
      target: { tabId: state.tabId },
      function: clickNextButton,
      args: [state.nextButtonSelector]
    })
    .then(results => {
      const result = results[0].result;
      
      // if error when clicking button
      if (result.error) {
        if (toastContainer && toastContainer.contains(indicator)) {
          toastContainer.removeChild(indicator);
        }
        showToast(`Error clicking next button: ${result.error}`, 'error');
        stopScraping();
        return;
      }
      
      // wait for page to load after clicking next
      setTimeout(() => {
        // now scrape table from new page
        chrome.scripting.executeScript({
          target: { tabId: state.tabId },
          function: scrapeTable,
          args: [state.tables[state.currentTableIndex].selector]
        })
        .then(results => {
          // remove progress indicator
          if (toastContainer && toastContainer.contains(indicator)) {
            toastContainer.removeChild(indicator);
          }
          
          const tableData = results[0].result;
          
          // check if we got data
          if (!tableData) {
            showToast('Could not find table on the next page', 'error');
            stopScraping();
            return;
          }
          
          // add new rows to our collected data
          if (state.tableData) {
            state.tableData.rows = state.tableData.rows.concat(tableData.rows);
          } else {
            state.tableData = tableData;
          }
          
          // update statistics
          state.stats.pagesScrapped++;
          state.stats.rowsLastPage = tableData.rows.length;
          state.stats.rowsCollected = state.tableData.rows.length;
          
          // refresh display with new data
          updateTableDisplay();
          updateStats();
          showToast(`Added ${tableData.rows.length} rows from page ${state.stats.pagesScrapped}`, 'success');
          
          // see if we should continue to next page
          if (document.getElementById('infiniteScroll').checked) {
            // yes, continue after small delay
            setTimeout(crawlNextPage, 1000);
          } else {
            // no, stop here
            stopScraping();
          }
        })
        .catch(error => {
          if (toastContainer && toastContainer.contains(indicator)) {
            toastContainer.removeChild(indicator);
          }
          showToast(`Error scraping table: ${error.message}`, 'error');
          stopScraping();
        });
      }, minDelayMs); // wait at least min delay for page to load
    })
    .catch(error => {
      if (toastContainer && toastContainer.contains(indicator)) {
        toastContainer.removeChild(indicator);
      }
      showToast(`Error injecting script: ${error.message}`, 'error');
      stopScraping();
    });
  }
  
  // function injected to click next button
  function clickNextButton(selector) {
    try {
      // find the next button using selector
      const element = document.querySelector(selector);
      
      if (!element) {
        return { error: 'Next button not found' };
      }
      
      // check button not disabled
      if (element.disabled || element.classList.contains('disabled')) {
        return { error: 'Next button is disabled' };
      }
      
      // click the button
      element.click();
      
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }
  
  // update working time every 1 second
  setInterval(() => {
    if (state.stats.startTime) {
      const currentTime = new Date().getTime();
      const elapsedSeconds = Math.floor((currentTime - state.stats.startTime) / 1000);
      state.stats.workingTime = elapsedSeconds;
      document.getElementById('workingTime').textContent = `${elapsedSeconds}s`;
    }
  }, 1000);

  // show notification popup to user
  function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    // create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // add to screen
    toastContainer.appendChild(toast);
    
    // remove after time passes
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, duration);
  }

  // listen for message from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'nextButtonSelected') {
      // save selector for next button
      state.nextButtonSelector = message.selector;
      
      // tell user it worked
      showToast(`"Next" button selected: ${message.selector}`, 'success');
      
      // show button to start scraping
      const startScrapingBtn = document.getElementById('start-scraping');
      if (startScrapingBtn) {
        startScrapingBtn.style.display = 'block';
        startScrapingBtn.addEventListener('click', startScraping);
      }
      
      // tell sender we got message
      sendResponse({received: true});
      return true;
    }
  });

  // function that runs in webpage to get table data
  function scrapeTable(selector) {
    try {
      // find the table
      const table = document.querySelector(selector);
      
      if (!table) {
        return null;
      }
      
      // get headers from first row
      const headerRow = table.rows[0];
      const headers = headerRow ? Array.from(headerRow.cells).map(cell => cell.innerText.trim()) : [];
      
      // get all other rows data
      const rows = [];
      for (let i = 1; i < table.rows.length; i++) {
        const row = table.rows[i];
        if (row) {
          rows.push(Array.from(row.cells).map(cell => cell.innerText.trim()));
        }
      }
      
      // return all data
      return { headers, rows };
    } catch (error) {
      console.error('Error scraping table:', error);
      return null;
    }
  }