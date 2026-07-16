// ============================================================================
// PROJECT: G-DRIVE ULTIMATE PRO MAX
// VERSION: 20.16 (Added: AI Chat Support Feature)
// ============================================================================

// ============================================================================
// 1. KONFIGURASI GLOBAL
// ============================================================================

var SCRIPT_PROP = PropertiesService.getScriptProperties();

var DEFAULT_DEST_ID = SCRIPT_PROP.getProperty('DEFAULT_DEST_ID') || "1sw8EPAX6mgcAuxOyhz4-S9uYjcDJmL_q"; // ID Folder Tujuan Default
var LOG_SHEET_ID = SCRIPT_PROP.getProperty('LOG_SHEET_ID') || "181frqAI898WbVdFkp2AufEhHCfwXDhBhWBQ3CzBnUWo"; // ID Spreadsheet Log
var LOG_SHEET_GID = Number(SCRIPT_PROP.getProperty('LOG_SHEET_GID')) || 587199847; 
var ACCESS_PIN = SCRIPT_PROP.getProperty('ACCESS_PIN') || "1"; // PIN Akses

var SYSTEM_FOLDER_NAME = "G-Drive_System_Config";
var SCHEDULE_CONFIG_FILENAME = "schedule_config_list.json";
var REMOTE_ACCOUNTS_FILENAME = "remote_accounts_list.json"; 

var TELEGRAM_BOT_TOKEN = SCRIPT_PROP.getProperty('TELEGRAM_BOT_TOKEN') || '7799138005:AAHYqmBkBWLMvUJbaAG5vH7rEb1HtazX2CU'; 
var TELEGRAM_CHAT_ID = SCRIPT_PROP.getProperty('TELEGRAM_CHAT_ID') || '@koesmasurat'; 

// ============================================================================
// 2. API ROUTING (GATEWAY)
// ============================================================================

function doGet(e) {
  return responseJSON({ status: 'success', message: "G-Drive Ultimate Server Online v20.16" });
}

function doPost(e) {
  var cache = CacheService.getScriptCache();
  try {
    if (!e || !e.postData) return responseJSON({ status: 'error', message: "Invalid Request" });
    
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    // SECURITY CHECK
    var failedCount = Number(cache.get('failed_attempts') || 0);
    if (failedCount >= 20) return responseJSON({ status: 'error', message: "⛔ Locked." });

    // Beberapa action tidak butuh PIN ketat (public info)
    if (action !== 'get_schedule_list' && action !== 'check_quota' && action !== 'get_remote_accounts') {
         if (String(data.pin) !== String(ACCESS_PIN)) {
            cache.put('failed_attempts', String(failedCount+1), 600);
            return responseJSON({ status: 'error', message: "PIN Salah!" });
         } else { if (failedCount > 0) cache.remove('failed_attempts'); }
    }

    // --- ROUTING MENU ---
    
    // 1. GEMINI AI ROUTE
    if (action === 'gemini_ai') return handleGeminiAI(data);

    // 2. AUTH & CORE
    if (action === 'verify_pin') return responseJSON({ status: 'success', message: "Login OK" });
    if (action === 'initialize') return handleInitialize(data);
    if (action === 'process_batch') return handleBatch(data.jobId);
    if (action === 'check_stats') return handleCheckStats(data);
    
    // 3. BACKGROUND PROCESS
    if (action === 'start_background_multi') return startBackgroundJob(data);
    if (action === 'stop_background') return stopBackgroundJob();
    if (action === 'check_background_status') return checkBackgroundStatus();
    
    // 4. FILE & FOLDER OPS
    if (action === 'browse_folders') return handleBrowseFolders(data);
    if (action === 'create_folder_tool') return handleCreateFolderTool(data);
    if (action === 'search_drive') return handleSearchDrive(data);
    if (action === 'direct_upload') return handleDirectUpload(data);
    if (action === 'delete_item') return handleDeleteItem(data);
    if (action === 'check_quota') return handleCheckQuota();

    // 5. REMOTE MANAGEMENT
    if (action === 'browse_remote') return handleBrowseRemote(data); 
    if (action === 'unlock_files') return handleUnlockFiles(data);
    if (action === 'save_remote_account') return handleSaveRemoteAccount(data);
    if (action === 'get_remote_accounts') return handleGetRemoteAccounts(data);
    if (action === 'delete_remote_account') return handleDeleteRemoteAccount(data); 
    if (action === 'connect_remote_dest') return handleConnectRemoteDest(data);

    // 6. SCHEDULER & LOGGING
    if (action === 'add_schedule_item') return handleAddScheduleItem(data);
    if (action === 'delete_schedule_item') return handleDeleteScheduleItem(data);
    if (action === 'get_schedule_list') return handleGetScheduleList(data);
    if (action === 'send_report') return handleReportAndLog(data);
    if (action === 'get_log_sheet_url') return responseJSON({ status:'success', url: getSpreadsheet().getUrl() });
    
    return responseJSON({ status: 'error', message: "Unknown Action" });
  } catch (error) { return responseJSON({ status: 'error', message: error.toString() }); }
}

// ============================================================================
// 3. AI MODULE (GEMINI INTEGRATION)
// ============================================================================

function handleGeminiAI(data) {
  // Ambil Key dari kiriman Client atau Script Property
  var key = data.apiKey || SCRIPT_PROP.getProperty('GEMINI_API_KEY'); 
  if (!key) return responseJSON({status: 'error', message: "API Key Gemini Kosong!"});
  
  try {
    // MODE 1: GENERATE FILE BARU
    if (data.mode === 'generate_file') {
       var prompt = "Buatkan konten teks lengkap, rapi, dan informatif untuk permintaan ini: " + data.prompt;
       var content = callGeminiLLM(key, prompt);
       
       var folderId = data.destId || DEFAULT_DEST_ID;
       var folder;
       try { folder = DriveApp.getFolderById(folderId); } catch(e) { folder = DriveApp.getRootFolder(); }
       
       var fileName = data.fileName || "AI_Result.txt";
       // Auto extension
       if (fileName.indexOf('.') === -1) fileName += ".txt";
       
       var file = folder.createFile(fileName, content);
       return responseJSON({status: 'success', message: "✨ File berhasil dibuat!", url: file.getUrl(), name: file.getName(), folderName: folder.getName()});
    }
    
    // MODE 2: ANALISA FOLDER
    else if (data.mode === 'analyze_folder') {
       var folderId = data.destId || "root";
       var folder;
       try { folder = (folderId==='root') ? DriveApp.getRootFolder() : DriveApp.getFolderById(folderId); } catch(e) { return responseJSON({status:'error', message:'Folder tidak valid'}); }
       
       var files = folder.getFiles();
       var names = [];
       var limit = 40; // Batas baca file agar tidak overload token
       while(files.hasNext() && limit > 0) { names.push(files.next().getName()); limit--; }
       
       if (names.length === 0) return responseJSON({status: 'success', analysis: "Folder ini kosong."});
       
       var prompt = "Berikut adalah daftar nama file dalam sebuah folder Google Drive:\n" + names.join("\n") + "\n\nAnalisa daftar file di atas dan jelaskan secara singkat (Bahasa Indonesia) kira-kira folder ini berisi tentang apa, proyek apa, atau data apa.";
       var analysis = callGeminiLLM(key, prompt);
       
       return responseJSON({status: 'success', analysis: analysis, folderName: folder.getName()});
    }

    // MODE 3: CHAT SUPPORT TENTANG APLIKASI
    else if (data.mode === 'chat_app') {
       var userQ = data.prompt;
       // KNOWLEDGE BASE TENTANG APLIKASI INI (Summarized form of .gs and .html)
       var appContext = `
       Anda adalah Asisten Cerdas untuk aplikasi 'G-Drive Ultimate Pro'.
       
       INFORMASI APLIKASI (SUMBER DATA):
       1. **Fitur Utama**:
          - **Cloning**: Menyalin folder/file (termasuk subfolder) dengan mode Duplicate, Replace, Skip, atau Rename. Menggunakan sistem Batching (30 file per batch) agar tidak timeout.
          - **Upload**: Upload file langsung dari browser ke Drive (Base64).
          - **Search**: Mencari file/folder berdasarkan nama di lokasi spesifik (Recursive smart search).
          - **Remote Nodes**: Menghubungkan ke script server lain (Client Node) untuk load balancing atau bypass limit akun tunggal.
          - **AI Tools**: Membuat file teks otomatis dan menganalisa isi folder menggunakan Gemini API.
          - **Scheduling**: Menjalankan tugas copy secara otomatis per jam.
       
       2. **Struktur Kode (.gs)**:
          - **doPost(e)**: Pintu gerbang utama API. Memvalidasi PIN dan mengarahkan 'action' ke fungsi yang sesuai.
          - **handleInitialize**: Menghitung total file/size sumber sebelum proses copy dimulai.
          - **handleBatch**: Eksekusi copy yang sebenarnya. Mengambil antrian (queue) dari file JSON sementara ('job_ID.json') di Drive.
          - **handleGeminiAI**: Fungsi integrasi ke Google Gemini API.
          - **LockService**: Digunakan untuk mencegah tabrakan proses saat banyak request bersamaan.
       
       3. **Antarmuka (.html)**:
          - Menggunakan Desain Glassmorphism (Gelap, Transparan).
          - Fitur UI: Tab navigasi (Clone, Upload, Search, AI), Terminal Log, Progress Bar, SweetAlert2 untuk popup.
          - Keamanan: PIN Protection di awal load.
       
       4. **Tips Penggunaan**:
          - Gunakan 'Remote Node' jika ingin menyalin file antar akun Google berbeda tanpa mendownload.
          - 'Smart Check' digunakan untuk melihat detail file/folder sebelum diproses.
          - API Key Gemini disimpan di LocalStorage browser pengguna.

       Tugas Anda: Jawab pertanyaan pengguna tentang aplikasi ini dengan ramah, jelas, dan menggunakan Bahasa Indonesia. Jika pengguna bertanya tentang kode, jelaskan logika backend-nya.
       `;
       
       var fullPrompt = appContext + "\n\nPERTANYAAN PENGGUNA: " + userQ;
       var answer = callGeminiLLM(key, fullPrompt);
       
       return responseJSON({status: 'success', answer: answer});
    }

  } catch(e) {
    return responseJSON({status: 'error', message: "AI Error: " + e.toString()});
  }
}

function callGeminiLLM(key, prompt) {
  var model = SCRIPT_PROP.getProperty('GEMINI_MODEL') || 'gemini-2.5-flash';
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key;
  var payload = {
    "contents": [{ "parts": [{ "text": prompt }] }]
  };
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  
  var res = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(res.getContentText());
  
  if(json.error) throw new Error(json.error.message);
  if(!json.candidates || json.candidates.length === 0) throw new Error("No response from AI");
  
  return json.candidates[0].content.parts[0].text;
}


// ============================================================================
// 4. CORE ENGINE (SMART CHECK & BATCH)
// ============================================================================

function handleCheckStats(data) {
  var id = extractIdFromUrl(data.url);
  if (!id) return responseJSON({ status: 'error', message: "URL Invalid" });
  try {
    var f = Drive.Files.get(id, {fields: "name, mimeType, size, capabilities, owners", supportsAllDrives: true});
    var perm = f.capabilities.canEdit ? "Writer" : (f.capabilities.canRead ? "Viewer" : "Restricted");
    var isFolder = (f.mimeType.indexOf('folder') > -1);
    var totalSize = parseInt(f.size || 0);
    var totalFiles = 1;
    var isApprox = true;

    if (data.deepScan && isFolder) {
        try {
            var folder = DriveApp.getFolderById(id);
            var stats = scanFolderRecursive(folder, null, null, true, null, false);
            totalSize = stats.size;
            totalFiles = stats.count;
            isApprox = false; 
        } catch(e) {}
    }

    return responseJSON({ status: 'success', name: f.name, type: isFolder ? 'folder' : 'file', access: perm, ownerEmail: (f.owners && f.owners[0]) ? f.owners[0].emailAddress : "-", stats: { files: totalFiles, size: formatBytes(totalSize) + (isFolder && isApprox ? " (Meta)" : "") } });
  } catch(e) { return responseJSON({ status: 'error', message: e.message }); }
}

function handleInitialize(data) {
  var lock = LockService.getScriptLock(); 
  if (!lock.tryLock(10000)) return responseJSON({ status: 'error', message: "Server Busy." });
  
  try {
    var sourceUrl = data.url; 
    var sourceId = extractIdFromUrl(sourceUrl);
    if (!sourceId) return responseJSON({ status: 'error', message: "URL Invalid" });
    
    var targetParentId = DEFAULT_DEST_ID; 
    var isRemoteTarget = false;
    
    if (data.remoteTargetUrl) {
       isRemoteTarget = true;
       var eid = extractIdFromUrl(data.destUrl); 
       if (eid) targetParentId = eid; 
    } else if (data.destUrl && data.destUrl.length > 10) { 
        var eid = extractIdFromUrl(data.destUrl); 
        if (eid) targetParentId = eid; 
    }
    
    var isFolder = false; var sourceItem = null; var sourceName = ""; var sourceOwner = "-"; var sourceAccess = "Restricted";
    try {
      var itemMeta = Drive.Files.get(sourceId, {fields: "id, name, mimeType, owners, capabilities", supportsAllDrives: true});
      sourceName = itemMeta.name;
      if(itemMeta.owners && itemMeta.owners.length > 0) sourceOwner = itemMeta.owners[0].emailAddress;
      if(itemMeta.capabilities) { if(itemMeta.capabilities.canEdit) sourceAccess = "Writer"; else if(itemMeta.capabilities.canRead) sourceAccess = "Viewer"; }
      isFolder = (itemMeta.mimeType === "application/vnd.google-apps.folder");
      sourceItem = isFolder ? DriveApp.getFolderById(sourceId) : DriveApp.getFileById(sourceId);
    } catch (e) { return responseJSON({ status: 'error', message: "Source Error" }); }
    
    var calcFiles = 0; var calcSize = 0; 
    if (isFolder) { 
        var r = scanFolderRecursive(sourceItem, null, [], true, data.filters); 
        calcFiles = r.count; calcSize = r.size; 
    } else { 
        if (isPassFilter(sourceItem, data.filters)) { calcSize = sourceItem.getSize(); calcFiles = 1; } 
    }

    var finalTargetId = targetParentId; 
    var finalTargetUrl = "";
    
    if (!isRemoteTarget) {
      if (isFolder) {
          var folderName = (data.name || sourceName).trim(); 
          if (data.isSchedule) folderName = "Backup " + folderName + " [" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd") + "]";
          
          var parentFolder;
          try {
            parentFolder = DriveApp.getFolderById(targetParentId);
          } catch(e) {
            parentFolder = DriveApp.getRootFolder();
            targetParentId = parentFolder.getId();
          }
          
          if (data.mode === 'copy_replace') {
              var existingFolders = parentFolder.getFoldersByName(folderName);
              var removedCount = 0;
              while (existingFolders.hasNext()) {
                  existingFolders.next().setTrashed(true);
                  removedCount++;
              }
              if (removedCount > 0) Utilities.sleep(2000); 
          }
          
          var newF = parentFolder.createFolder(folderName);
          finalTargetId = newF.getId(); 
          finalTargetUrl = newF.getUrl();
      } else {
          var parentFolder;
          try {
            parentFolder = DriveApp.getFolderById(targetParentId);
          } catch(e) {
            parentFolder = DriveApp.getRootFolder();
          }
          finalTargetUrl = parentFolder.getUrl();
      }
    } else {
      finalTargetUrl = data.destUrl || "Remote Server";
    }
    
    var jobData = { 
        jobId: Utilities.getUuid(), status: 'running', mode: data.mode || 'copy_duplicate', 
        filters: data.filters || {}, totalFiles: calcFiles, processedFiles: 0, totalSize: calcSize, processedSize: 0, 
        queue: [], rootTargetUrl: finalTargetUrl, renamePrefix: data.renamePrefix || "[MOVED] ",
        isSchedule: data.isSchedule, scheduleId: data.scheduleId, sourceUrl: sourceUrl, 
        targetParentIdForRetention: targetParentId, maxBackups: data.maxBackups, remoteTargetUrl: data.remoteTargetUrl,
        sourceName: sourceName, sourceOwner: sourceOwner, sourceAccess: sourceAccess
    };
    
    if (isFolder) {
        scanFolderRecursive(sourceItem, finalTargetId, jobData.queue, false, jobData.filters, isRemoteTarget, jobData.mode);
    } else if (calcFiles > 0) {
        jobData.queue.push({ type: 'file', id: sourceId, name: (data.name || sourceName), size: calcSize, targetFolderId: finalTargetId, url: sourceItem.getUrl() }); 
    }
    
    saveJobState(jobData);
    return responseJSON({ status: 'success', action: 'initialized', jobId: jobData.jobId, totalFiles: jobData.totalFiles, totalSize: formatBytes(jobData.totalSize), sourceName: sourceName, targetUrl: finalTargetUrl, type: isFolder ? 'folder' : 'file' });

  } catch (e) { return responseJSON({ status: 'error', message: "Init Error: " + e.message }); } finally { lock.releaseLock(); }
}

function scanFolderRecursive(folder, targetId, queue, isDry, filters, isRemoteTarget, mode) { 
    var s = {size:0, count:0};
    var files = folder.getFiles(); 
    while (files.hasNext()) { 
        var f = files.next(); 
        if (isDry) { s.size += f.getSize(); s.count++; } else { 
            if (!isPassFilter(f, filters)) continue; 
            queue.push({ type: 'file', id: f.getId(), name: f.getName(), size: f.getSize(), targetFolderId: targetId }); 
        }
    } 
    var subs = folder.getFolders(); 
    while (subs.hasNext()) { 
        var sub = subs.next(); 
        if (isDry) { 
            var r = scanFolderRecursive(sub, null, null, true, filters, isRemoteTarget, mode); 
            s.size += r.size; s.count += r.count; 
        } else { 
            var nextId = targetId;
            if (!isRemoteTarget) { 
                var currentParent = DriveApp.getFolderById(targetId);
                var subName = sub.getName().trim();
                if (mode === 'copy_replace') {
                    var oldSubs = currentParent.getFoldersByName(subName);
                    var delCount = 0;
                    while(oldSubs.hasNext()) { oldSubs.next().setTrashed(true); delCount++; }
                    if(delCount > 0) Utilities.sleep(1000); 
                }
                nextId = currentParent.createFolder(subName).getId(); 
            }
            scanFolderRecursive(sub, nextId, queue, false, filters, isRemoteTarget, mode); 
        }
    } 
    return s;
}

function handleBatch(jobId) {
  var BATCH = 30; var items = []; var job = null; var lock = LockService.getScriptLock(); lock.waitLock(10000); 
  try {
    job = loadJobState(jobId); if (!job) return responseJSON({ status: 'error', message: "Job Expired" });
    
    if (job.queue.length === 0) { 
        if(job.isSchedule && !job.remoteTargetUrl) cleanupOldBackups(job.targetParentIdForRetention, "Backup ", job.maxBackups);
        var finalProcessed = job.processedFiles; var finalTotal = job.totalFiles; var finalSize = job.processedSize;
        try {
            var destFolderName = "Remote Server"; var destFolderUrl = ""; 
            if(!job.remoteTargetUrl) { try { var df = DriveApp.getFolderById(job.targetParentIdForRetention); destFolderName = df.getName(); destFolderUrl = df.getUrl(); } catch(e){} }
            var usedStorage = DriveApp.getStorageUsed(); var quotaEmail = MailApp.getRemainingDailyQuota();
            var summaryMsg = "🤖 <b>G-Drive Manual Run</b>\n\nowner folder sumber : " + (job.sourceOwner || "-") + "\nlink : <a href='" + job.sourceUrl + "'>" + job.sourceName + "</a>\nstatus folder : " + (job.sourceAccess || "Restricted") + "\nStatus: ✅ Selesai\nTotal folder/File: " + finalTotal + "\nTotal Size: " + formatBytes(finalSize) + "\n--------------\nTotal Link: 1\n\n📊 <b>Info Akun Tujuan:</b> " + Session.getEffectiveUser().getEmail() + "\n";
            if(destFolderUrl) { summaryMsg += "folder tujuan : <a href='" + destFolderUrl + "'>" + destFolderName + "</a>\n"; } else { summaryMsg += "folder tujuan : " + destFolderName + "\n"; }
            summaryMsg += "• Sisa Email: " + quotaEmail + "\n• Storage: " + formatBytes(usedStorage) + " (Used)\n\n📄 <a href='" + getSpreadsheet().getUrl() + "'>Lihat Log Sheet</a>";
            sendTelegramNotification(summaryMsg);
            logJobToSheet(job, finalTotal, finalSize);
        } catch(e) { console.log("Error summary: " + e.message); }
        deleteJobState(jobId); 
        return responseJSON({ status: 'success', action: 'complete', progress: { percent: 100, processed: finalProcessed, total: finalTotal, currentSize: formatBytes(finalSize) } }); 
    }
    
    var c = 0; while (c < BATCH && job.queue.length > 0) { items.push(job.queue.shift()); job.processedFiles++; job.processedSize += (items[items.length-1].size||0); c++; }
    saveJobState(job); 
  } finally { lock.releaseLock(); }

  var processed = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    try {
        var status = "success"; var info = "Copied"; var newUrl = "#";
        if (job.remoteTargetUrl) {
            var srcF = DriveApp.getFileById(it.id); var originalAccess = srcF.getSharingAccess(); var isPublic = (originalAccess === DriveApp.Access.ANYONE_WITH_LINK || originalAccess === DriveApp.Access.ANYONE);
            if (!isPublic) { try { srcF.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); Utilities.sleep(1500); } catch(permErr) {} }
            try { 
                var payload = { action: 'absorb_file', fileId: it.id, folderId: job.targetParentIdForRetention, name: it.name, mode: job.mode }; 
                var response = UrlFetchApp.fetch(job.remoteTargetUrl, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true }); var resJson = JSON.parse(response.getContentText()); if (resJson.status === 'success') { newUrl = resJson.newUrl; info = "Remote Saved"; } else throw new Error("Remote Error"); 
            } catch(copyErr) { throw copyErr; } 
            finally { if (!isPublic) { try { srcF.setSharing(originalAccess, srcF.getSharingPermission()); } catch(revErr) {} } }
        } else {
            var destF = DriveApp.getFolderById(it.targetFolderId); 
            var cleanName = it.name.trim();
            var existing = destF.getFilesByName(cleanName);
            if (existing.hasNext()) {
                if (job.mode === 'copy_skip') { status = 'skipped'; info = 'Skipped'; }
                else if (job.mode === 'copy_replace') { 
                    while(existing.hasNext()) { existing.next().setTrashed(true); } 
                    var c = DriveApp.getFileById(it.id).makeCopy(cleanName, destF); newUrl = c.getUrl(); info = "Replaced"; 
                }
                else if (job.mode.indexOf('rename') > -1) { var c = DriveApp.getFileById(it.id).makeCopy(job.renamePrefix + cleanName, destF); newUrl = c.getUrl(); info = "Renamed"; }
                else { var c = DriveApp.getFileById(it.id).makeCopy(cleanName, destF); newUrl = c.getUrl(); info = "Duplicated"; }
            } else { var c = DriveApp.getFileById(it.id).makeCopy(cleanName, destF); newUrl = c.getUrl(); }
        }
        processed.push({ name: it.name, url: newUrl, size: formatBytes(it.size), status: status, info: info });
    } catch (e) { processed.push({ name: it.name, status: 'error', info: e.message }); }
  }
  return responseJSON({ status: 'success', action: 'continue', jobId: jobId, processedList: processed, progress: { processed: job.processedFiles, total: job.totalFiles, percent: Math.round((job.processedFiles/job.totalFiles)*100) } });
}

// ============================================================================
// 5. HELPER & UTILS
// ============================================================================

function handleDeleteRemoteAccount(data) {
    try {
        var idToDelete = data.id;
        var list = loadRemoteList();
        var newList = list.filter(function(item) { return item.id !== idToDelete; });
        saveRemoteList(newList);
        return responseJSON({ status: 'success' });
    } catch (e) {
        return responseJSON({ status: 'error', message: e.message });
    }
}

function logJobToSheet(job, totalFiles, totalSize) {
  try {
    var ss = SpreadsheetApp.openById(LOG_SHEET_ID); var sheet = null; var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) { if (sheets[i].getSheetId() == LOG_SHEET_GID) { sheet = sheets[i]; break; } }
    if (!sheet) sheet = ss.getSheets()[0]; 
    var time = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    var sourceName = job.sourceName; var sourceOwner = job.sourceOwner; var totalInfo = totalFiles + " files / " + formatBytes(totalSize); var status = "✅ Success"; var account = Session.getEffectiveUser().getEmail();
    var destUrlInfo = job.remoteTargetUrl ? "Remote (" + job.remoteTargetUrl + ")" : (function(){try{return DriveApp.getFolderById(job.targetParentIdForRetention).getUrl();}catch(e){return "Local ID: "+job.targetParentIdForRetention}})();
    var color = getRandomSoftColor();
    sheet.insertRowBefore(2);
    var rowData = [[time, sourceName, sourceOwner, status, totalInfo, account, job.sourceUrl, destUrlInfo]];
    var range = sheet.getRange(2, 1, 1, rowData[0].length); range.setValues(rowData); range.setBackground(color);
  } catch (e) { console.log("Log Sheet Error: " + e.message); }
}

function getRandomSoftColor() { var min = 210; var r = Math.floor(Math.random() * (255 - min) + min); var g = Math.floor(Math.random() * (255 - min) + min); var b = Math.floor(Math.random() * (255 - min) + min); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }
function handleDirectUpload(data) { try { var folderId = data.destId; if (folderId && folderId.indexOf('http') > -1) folderId = extractIdFromUrl(folderId); if (!folderId) folderId = DEFAULT_DEST_ID; var folder; try { folder = DriveApp.getFolderById(folderId); } catch(e) { folder = DriveApp.getRootFolder(); } var base64Data = data.fileData; if (base64Data.indexOf(',') > -1) base64Data = base64Data.split(',')[1]; var decoded = Utilities.base64Decode(base64Data); var blob = Utilities.newBlob(decoded, data.mimeType, data.fileName); var file = folder.createFile(blob); try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (permErr) {} try { var ownerEmail = "Shared Drive / Unknown"; try { var o = folder.getOwner(); if(o) ownerEmail = o.getEmail(); } catch(e){} var msg = "📤 <b>Direct Upload Berhasil</b>\n\n📄 File: " + file.getName() + "\n💾 Size: " + formatBytes(file.getSize()) + "\n📂 Folder: " + folder.getName() + "\npemilik folder : " + ownerEmail + "\n🔗 <a href='" + file.getUrl() + "'>Buka File</a>"; sendTelegramNotification(msg); } catch(tgErr) {} return responseJSON({ status: 'success', fileName: file.getName(), fileUrl: file.getUrl(), size: formatBytes(file.getSize()), folderName: folder.getName() }); } catch (e) { return responseJSON({ status: 'error', message: "Upload Gagal: " + e.message }); } }
function handleDeleteItem(data) { try { var id = data.id; var type = data.type; if (type === 'folder' || type === 'application/vnd.google-apps.folder') { DriveApp.getFolderById(id).setTrashed(true); } else { DriveApp.getFileById(id).setTrashed(true); } return responseJSON({ status: 'success', message: "Item Trash." }); } catch (e) { return responseJSON({ status: 'error', message: "Gagal Hapus: " + e.message }); } }

function handleSearchDrive(data) {
  try {
    var query = data.query || "";
    var parentId = data.parentId || "root";
    var folder = null;
    
    // RESOLVE FOLDER (SMART SEARCH: ID FIRST, THEN NAME)
    if (parentId === 'root') {
      folder = DriveApp.getRootFolder();
    } else {
      try {
        folder = DriveApp.getFolderById(parentId);
      } catch (e) {
        var folders = DriveApp.getFoldersByName(parentId);
        if (folders.hasNext()) folder = folders.next();
        else return responseJSON({ status: 'error', message: "Folder tidak ditemukan (Cek ID atau Nama)" });
      }
    }

    var searchParams = "trashed = false";
    if (query.trim().length > 0) searchParams += " and title contains '" + query.replace(/'/g, "\\'") + "'";

    var results = [];
    var files = folder.searchFiles(searchParams);
    var count = 0; 
    
    while (files.hasNext() && count < 50) {
      var file = files.next();
      results.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getMimeType(),
        url: file.getUrl(),
        size: formatBytes(file.getSize()),
        date: Utilities.formatDate(file.getLastUpdated(), Session.getScriptTimeZone(), "dd/MM/yy")
      });
      count++;
    }
    
    try {
        var subFolders = folder.searchFolders(searchParams);
        var fCount = 0;
        while (subFolders.hasNext() && fCount < 10) {
             var sf = subFolders.next();
             results.push({ id: sf.getId(), name: sf.getName(), mimeType: "application/vnd.google-apps.folder", url: sf.getUrl(), size: "-", date: Utilities.formatDate(sf.getLastUpdated(), Session.getScriptTimeZone(), "dd/MM/yy") });
             fCount++;
        }
    } catch(err){}

    return responseJSON({ status: 'success', results: results, filteredBy: folder.getName() });

  } catch (e) {
    return responseJSON({ status: 'error', message: "Search Error: " + e.message });
  }
}

function handleBrowseFolders(data) { var p = data.parentId || "root"; var f = []; try { var parentFolder = (p === "root") ? DriveApp.getRootFolder() : DriveApp.getFolderById(p); var list = parentFolder.getFolders(); while(list.hasNext()) { var i = list.next(); f.push({ id: i.getId(), name: i.getName() }); } var parentOfCurrent = null; try { var parents = parentFolder.getParents(); if (parents.hasNext()) parentOfCurrent = parents.next().getId(); } catch(e) {} return responseJSON({ status:'success', folders:f, currentId: p==="root"?parentFolder.getId():p, currentName: parentFolder.getName(), parentId: parentOfCurrent }); } catch(e) { return responseJSON({ status:'error', message: e.message }); } }
function handleCreateFolderTool(d) { try { return responseJSON({ status:'success', id: DriveApp.getFolderById(d.parentId).createFolder(d.name).getId() }); } catch(e) { return responseJSON({ status:'error', message: e.message }); } }
function handleSaveRemoteAccount(data) { var url = data.targetUrl; var isScript = (url.indexOf("script.google.com") > -1); var email = "-"; try { if (isScript) { var res = UrlFetchApp.fetch(url, {method:'post', contentType:'application/json', payload:JSON.stringify({action:'get_server_info'}), muteHttpExceptions:true}); var r = JSON.parse(res.getContentText()); if (r.status === 'success') email = r.email; } var list = loadRemoteList() || []; list.push({ id: Utilities.getUuid(), label: data.label, url: url, type: isScript?'server':'link', email: email }); saveRemoteList(list); return responseJSON({ status: 'success', email: email }); } catch (e) { return responseJSON({ status: 'error', message: e.message }); } }
function handleGetRemoteAccounts(data) { return responseJSON({ status: 'success', list: loadRemoteList() || [] }); }
function handleConnectRemoteDest(data) { try { if (data.targetUrl.indexOf("script.google.com") === -1) return responseJSON({ status: 'error', message: "URL bukan Server Script." }); var payload = { action: 'prepare_destination', requester: Session.getEffectiveUser().getEmail(), targetId: data.targetId || null, folderName: "Inbox Transfer" }; var response = UrlFetchApp.fetch(data.targetUrl, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true }); return ContentService.createTextOutput(response.getContentText()).setMimeType(ContentService.MimeType.JSON); } catch (e) { return responseJSON({ status: 'error', message: e.message }); } }
function handleBrowseRemote(data) { return handleBrowseFolders(data); }
function handleUnlockFiles(data) { var ids = data.ids || []; var c = 0; for (var i = 0; i < ids.length; i++) { try { DriveApp.getFileById(ids[i]).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); c++; } catch(e) {} } return responseJSON({ status: 'success', unlocked: c }); }
function handleCheckQuota() { try { return responseJSON({ status: 'success', emailQuota: MailApp.getRemainingDailyQuota(), driveUsed: formatBytes(DriveApp.getStorageUsed()) }); } catch(e) { return responseJSON({ status: 'error', message: e.message }); } }
function sendTelegramNotification(text) { if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return; try { UrlFetchApp.fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", { method: "post", payload: JSON.stringify({ "chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML", "disable_web_page_preview": true }), contentType: "application/json" }); } catch (e) {} }
function startBackgroundJob(data) { var master = { urls: data.urls, destUrl: data.destUrl, mode: data.mode, filters: data.filters, email: data.email, currentIndex: 0, currentJobId: null, startTime: new Date().getTime(), status: 'RUNNING', stats: { success: 0, fail: 0 }, isSchedule: !!data.scheduleId, scheduleId: data.scheduleId, maxBackups: data.maxBackups }; saveMasterJob(master); SCRIPT_PROP.setProperty('BG_JOB_STATUS', 'RUNNING'); deleteTriggers(); ScriptApp.newTrigger('backgroundTriggerHandler').timeBased().everyMinutes(1).create(); return responseJSON({ status: 'success', message: "Background Started" }); }
function stopBackgroundJob() { deleteTriggers(); SCRIPT_PROP.setProperty('BG_JOB_STATUS', 'STOPPED'); return responseJSON({ status:'success' }); }
function checkBackgroundStatus() { return responseJSON({ status:'success', bgStatus: SCRIPT_PROP.getProperty('BG_JOB_STATUS') }); }
function backgroundTriggerHandler() { 
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // Batasi eksekusi ganda jika trigger sebelumnya masih berjalan
  
  try {
    var m = loadMasterJob(); 
    if(!m || SCRIPT_PROP.getProperty('BG_JOB_STATUS') !== 'RUNNING') { 
      deleteTriggers(); 
      return; 
    } 
    var start = new Date().getTime(); 
    while (m.currentIndex < m.urls.length) { 
      if (new Date().getTime() - start > 220000) return; 
      if (!m.currentJobId) { 
        var initRes = handleInitialize({ url: m.urls[m.currentIndex], destUrl: m.destUrl, mode: m.mode, filters: m.filters, isSchedule: m.isSchedule, scheduleId: m.scheduleId, maxBackups: m.maxBackups }); 
        var initD = JSON.parse(initRes.getContent()); 
        if (initD.status === 'success') { 
          m.currentJobId = initD.jobId; 
          saveMasterJob(m); 
        } else { 
          m.stats.fail++; 
          m.currentIndex++; 
          saveMasterJob(m); 
          continue; 
        } 
      } 
      var done = false; 
      while (!done) { 
        if (new Date().getTime() - start > 220000) return; 
        var batchRes = handleBatch(m.currentJobId); 
        var batchD = JSON.parse(batchRes.getContent()); 
        if (batchD.status !== 'success' || batchD.action === 'complete') done = true; 
      } 
      if (done) { 
        m.currentIndex++; 
        m.currentJobId = null; 
        m.stats.success++; 
        saveMasterJob(m); 
      } 
    } 
    handleReportAndLog({ email: m.email, urls: m.urls, stats: m.stats }); 
    stopBackgroundJob(); 
  } catch(e) {
    console.log("Trigger Error: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}
function handleAddScheduleItem(d) { var l=loadScheduleList()||[]; l.push({id:Utilities.getUuid(), label:d.label, config:d.config, lastRun:0}); saveScheduleList(l); ensureHourlyTrigger(); return responseJSON({status:'success'}); }
function handleDeleteScheduleItem(d) { var l=loadScheduleList()||[]; saveScheduleList(l.filter(function(i){return i.id!==d.id})); return responseJSON({status:'success'}); }
function handleGetScheduleList(d) { return responseJSON({ status:'success', list: loadScheduleList()||[] }); }
function scheduledAutoRunner() { var l = loadScheduleList(); if(!l) return; var now = new Date().getTime(); for(var i=0; i<l.length; i++) { if (now - (l[i].lastRun||0) > 82800000) { l[i].lastRun = now; saveScheduleList(l); var conf = l[i].config; conf.scheduleId = l[i].id; startBackgroundJob(conf); break; } } }
function ensureHourlyTrigger() { var t = ScriptApp.getProjectTriggers(); for(var i=0; i<t.length; i++) { if(t[i].getHandlerFunction() === 'scheduledAutoRunner') return; } ScriptApp.newTrigger('scheduledAutoRunner').timeBased().everyHours(1).create(); }
function getSystemFolder() { var f = DriveApp.getFoldersByName(SYSTEM_FOLDER_NAME); return f.hasNext() ? f.next() : DriveApp.createFolder(SYSTEM_FOLDER_NAME); }
function saveJobState(d) { var f = getSystemFolder(); var n = "job_"+d.jobId+".json"; var x = f.getFilesByName(n); if(x.hasNext()) x.next().setContent(JSON.stringify(d)); else f.createFile(n, JSON.stringify(d)); } 
function loadJobState(id) { var f = getSystemFolder(); var x = f.getFilesByName("job_"+id+".json"); return x.hasNext() ? JSON.parse(x.next().getBlob().getDataAsString()) : null; } 
function deleteJobState(id) { var f = getSystemFolder(); var x = f.getFilesByName("job_"+id+".json"); if(x.hasNext()) x.next().setTrashed(true); } 
function saveMasterJob(d) { var f = getSystemFolder(); var x = f.getFilesByName("bg_master.json"); if(x.hasNext()) x.next().setContent(JSON.stringify(d)); else f.createFile("bg_master.json", JSON.stringify(d)); } 
function loadMasterJob() { var f = getSystemFolder(); var x = f.getFilesByName("bg_master.json"); return x.hasNext() ? JSON.parse(x.next().getBlob().getDataAsString()) : null; } 
function saveScheduleList(d) { var f = getSystemFolder(); var x = f.getFilesByName(SCHEDULE_CONFIG_FILENAME); if(x.hasNext()) x.next().setContent(JSON.stringify(d)); else f.createFile(SCHEDULE_CONFIG_FILENAME, JSON.stringify(d)); } 
function loadScheduleList() { try { var x = getSystemFolder().getFilesByName(SCHEDULE_CONFIG_FILENAME); return x.hasNext() ? JSON.parse(x.next().getBlob().getDataAsString()) : []; } catch(e) { return []; } } 
function saveRemoteList(d) { var f = getSystemFolder(); var x = f.getFilesByName(REMOTE_ACCOUNTS_FILENAME); if(x.hasNext()) x.next().setContent(JSON.stringify(d)); else f.createFile(REMOTE_ACCOUNTS_FILENAME, JSON.stringify(d)); } 
function loadRemoteList() { try { var x = getSystemFolder().getFilesByName(REMOTE_ACCOUNTS_FILENAME); return x.hasNext() ? JSON.parse(x.next().getBlob().getDataAsString()) : []; } catch(e) { return []; } } 
function deleteTriggers() { var t = ScriptApp.getProjectTriggers(); for(var i=0; i<t.length; i++) { if(t[i].getHandlerFunction() === 'backgroundTriggerHandler') ScriptApp.deleteTrigger(t[i]); } }
function getSpreadsheet() { 
  var sheetId = SCRIPT_PROP.getProperty('LOG_SHEET_ID') || LOG_SHEET_ID;
  var ss;
  try { 
    ss = SpreadsheetApp.openById(sheetId); 
  } catch(e) { 
    ss = SpreadsheetApp.create("Log G-Drive"); 
    SCRIPT_PROP.setProperty('LOG_SHEET_ID', ss.getId());
    // Setup initial headers
    var sheet = ss.getSheets()[0];
    sheet.appendRow(["Waktu", "Nama Sumber", "Owner Sumber", "Status", "Total Info", "Akun Tujuan", "Link Sumber", "Folder Tujuan"]);
    sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#302b63").setFontColor("#ffffff");
  } 
  return ss;
} 
function logSummaryToSheet(d) { try { var s = getSpreadsheet().getSheets()[0]; s.appendRow([new Date(), d.mode, d.email, d.success, d.fail, d.totalFiles, d.totalSize]); return { url: getSpreadsheet().getUrl() }; } catch(e) { return {url:""}; } } 
function logDetailsToSheet(arr, em) { 
  try { 
    var s = getSpreadsheet(); 
    var sh = s.getSheetByName("Details");
    if (!sh) {
      sh = s.insertSheet("Details");
      sh.appendRow(["Tanggal", "Email Pengguna", "Nama File", "Status", "Info Tambahan", "URL File"]);
      sh.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#302b63").setFontColor("#ffffff");
    }
    var r = arr.map(function(i){ return [new Date(), em, i.name, i.status, i.info, i.url]; }); 
    if(r.length) sh.getRange(sh.getLastRow()+1,1,r.length,6).setValues(r); 
  } catch(e){} 
}
function handleReportAndLog(d) { 
  var sheetUrl = "";
  try { 
    var ss = getSpreadsheet();
    sheetUrl = ss.getUrl();
    var s = ss.getSheets()[0]; 
    s.appendRow([new Date(), "Report", d.email, d.stats.success, d.stats.fail]); 
    if (d.details && d.details.length > 0) {
      logDetailsToSheet(d.details, d.email);
    }
    if (d.email) { 
      MailApp.sendEmail(d.email, "G-Drive Report", "Sukses: " + d.stats.success + "\nGagal: " + d.stats.fail); 
    } 
  } catch(e){} 
  return responseJSON({status:'success', sheetUrl: sheetUrl}); 
}
function isPassFilter(f, fil) { if(!fil) return true; if(fil.maxSizeMB && (f.getSize()/1024/1024) > fil.maxSizeMB) return false; if(fil.ignoredExt) { var ext = f.getName().split('.').pop(); if(fil.ignoredExt.indexOf(ext) > -1) return false; } return true; }
function cleanupOldBackups(pId, prefix, max) { try { var f = DriveApp.getFolderById(pId).getFolders(); var arr = []; while(f.hasNext()){ var i = f.next(); if(i.getName().indexOf(prefix)===0) arr.push(i); } if(arr.length > max) { arr.sort(function(a,b){ return a.getDateCreated() - b.getDateCreated(); }); for(var k=0; k<(arr.length-max); k++) { arr[k].setTrashed(true); } } } catch(e){} }
function extractIdFromUrl(u) { if(!u) return null; var m = u.match(/[-\w]{25,}/); return m ? m[0] : null; }
function formatBytes(b) { if(b===0) return '0 B'; var k=1024; var i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(2)) + ' ' + ['B','KB','MB','GB','TB'][i]; }
function parseBytesFromFormat(s) { if(!s) return 0; var u={'B':1,'KB':1024,'MB':1024*1024,'GB':1024*1024*1024}; var p=s.split(' '); return parseFloat(p[0]) * (u[p[1]]||1); }
function responseJSON(d) { return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON); }