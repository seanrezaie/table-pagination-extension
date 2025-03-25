// global variable to store table data
let tableData = null;

// listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'storeTableData') {
    tableData = message.data;
    sendResponse({success: true});
    return true;
  }
  
  if (message.action === 'getTableData') {
    sendResponse({data: tableData});
    return true;
  }
}); 