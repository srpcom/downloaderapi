// =========================================================================
// G-DRIVE ULTIMATE - REMOTE NODE SERVER CODE (VERSI PAIRING OTOMATIS)
// =========================================================================
// Panduan Deployment Baru yang Canggih & Praktis:
// 
// 1. Masuk ke Google Drive akun remote Anda yang lain.
// 2. Buka https://script.google.com/
// 3. Buat Project Baru.
// 4. Hapus semua kode bawaan, lalu paste seluruh kode ini.
// 5. CRITICAL: Di bagian atas editor, pilih fungsi "getInitialInfo" lalu klik tombol "Run".
//    Akan muncul pop-up "Authorization Required". Klik "Review Permissions",
//    pilih akun Google Anda, klik "Advanced" -> "Go to (unsafe)", dan klik "Allow".
//    Ini wajib dilakukan sekali agar script memiliki izin untuk melakukan request eksternal (UrlFetchApp).
// 6. Klik "Deploy" -> "New deployment".
// 7. Pilih tipe: "Web app" (ikon gir/roda).
// 8. Konfigurasi Web App:
//    - Execute as: Me (Email akun remote Anda)
//    - Who has access: Anyone (Siapa saja)
// 9. Klik "Deploy", lalu salin "Web app URL" yang diberikan.
// 10. Buka URL Web App remote tersebut di browser Anda. Masukkan URL Web App utama Anda,
//     password server Anda (default: 1), lalu klik "Daftarkan Node (Pair)". Selesai!
// =========================================================================

function doGet(e) {
  var html = getPairingHtml();
  return HtmlService.createHtmlOutput(html)
    .setTitle("Pairing Remote Node - G-Drive Ultimate")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getInitialInfo() {
  return {
    email: Session.getEffectiveUser().getEmail()
  };
}

function registerNodeToMaster(masterUrl, masterPassword, nodeLabel, nodePasscode) {
  try {
    var remoteUrl = ScriptApp.getService().getUrl();
    if (!remoteUrl) {
      throw new Error("Script belum di-deploy sebagai Web App. Silakan Deploy -> New deployment -> Web app terlebih dahulu.");
    }
    
    // Simpan passcode lokal di Script Properties remote
    var SCRIPT_PROP = PropertiesService.getScriptProperties();
    SCRIPT_PROP.setProperty('SECRET_TOKEN', nodePasscode);
    
    // Kirim registrasi ke master
    var payload = {
      action: 'register_remote_node',
      password: masterPassword,
      label: nodeLabel,
      url: remoteUrl,
      token: nodePasscode,
      email: Session.getEffectiveUser().getEmail()
    };
    
    var response = UrlFetchApp.fetch(masterUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    var res = JSON.parse(response.getContentText());
    if (res.status === 'success') {
      return { status: 'success', message: "Pemasangan Sukses!" };
    } else {
      throw new Error(res.message || "Gagal mendaftar ke server utama.");
    }
  } catch(e) {
    return { status: 'error', message: e.message };
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData) return responseJSON({ status: 'error', message: "Permintaan tidak valid." });
    var data = JSON.parse(e.postData.contents);
    
    // Ambil SECRET_TOKEN dari Script Properties
    var SCRIPT_PROP = PropertiesService.getScriptProperties();
    var secretToken = SCRIPT_PROP.getProperty('SECRET_TOKEN') || "123456";
    
    // Validasi Token Keamanan
    if (String(data.token) !== String(secretToken)) {
      return responseJSON({ status: 'error', message: "Token keamanan remote node tidak cocok/tidak valid!" });
    }
    
    var action = data.action;
    
    if (action === 'get_server_info') {
      return responseJSON({
        status: 'success',
        email: Session.getEffectiveUser().getEmail(),
        quota: MailApp.getRemainingDailyQuota(),
        driveUsed: DriveApp.getStorageUsed()
      });
    }
    
    if (action === 'list_dir') {
      var pId = data.parentId || "root";
      var parentFolder = (pId === "root") ? DriveApp.getRootFolder() : DriveApp.getFolderById(pId);
      
      var folders = [];
      var files = [];
      
      // Ambil semua sub-folder
      var folderList = parentFolder.getFolders();
      while (folderList.hasNext()) {
        var f = folderList.next();
        folders.push({
          id: f.getId(),
          name: f.getName(),
          type: 'folder',
          dateCreated: f.getDateCreated().getTime()
        });
      }
      
      // Ambil semua file
      var fileList = parentFolder.getFiles();
      while (fileList.hasNext()) {
        var file = fileList.next();
        files.push({
          id: file.getId(),
          name: file.getName(),
          type: 'file',
          mimeType: file.getMimeType(),
          size: file.getSize(),
          dateCreated: file.getDateCreated().getTime(),
          downloadUrl: file.getDownloadUrl()
        });
      }
      
      // Dapatkan ID folder induk (parent) untuk navigasi kembali (back)
      var parentOfCurrent = null;
      try {
        var parents = parentFolder.getParents();
        if (parents.hasNext()) {
          parentOfCurrent = parents.next().getId();
        }
      } catch(e) {}
      
      return responseJSON({
        status: 'success',
        currentId: parentFolder.getId(),
        currentName: parentFolder.getName(),
        parentId: parentOfCurrent,
        folders: folders,
        files: files
      });
    }
    
    if (action === 'search') {
      var q = data.query || "";
      if (!q) return responseJSON({ status: 'error', message: "Kata kunci pencarian kosong." });
      
      var files = [];
      // Cari file berdasarkan nama
      var fileList = DriveApp.searchFiles("name contains '" + q.replace(/'/g, "\\'") + "' and trashed = false");
      var count = 0;
      while (fileList.hasNext() && count < 100) {
        var file = fileList.next();
        files.push({
          id: file.getId(),
          name: file.getName(),
          type: 'file',
          mimeType: file.getMimeType(),
          size: file.getSize(),
          dateCreated: file.getDateCreated().getTime()
        });
        count++;
      }
      
      var folders = [];
      var folderList = DriveApp.searchFolders("name contains '" + q.replace(/'/g, "\\'") + "' and trashed = false");
      count = 0;
      while (folderList.hasNext() && count < 50) {
        var f = folderList.next();
        folders.push({
          id: f.getId(),
          name: f.getName(),
          type: 'folder',
          dateCreated: f.getDateCreated().getTime()
        });
        count++;
      }
      
      return responseJSON({
        status: 'success',
        folders: folders,
        files: files
      });
    }
    
    if (action === 'create_folder') {
      var pId = data.parentId || "root";
      var name = data.name || "Folder Baru";
      var parent = (pId === "root") ? DriveApp.getRootFolder() : DriveApp.getFolderById(pId);
      var newFolder = parent.createFolder(name);
      return responseJSON({
        status: 'success',
        id: newFolder.getId(),
        name: newFolder.getName()
      });
    }
    
    if (action === 'delete_item') {
      var itemId = data.itemId;
      var itemType = data.itemType; // 'file' atau 'folder'
      if (itemType === 'folder') {
        DriveApp.getFolderById(itemId).setTrashed(true);
      } else {
        DriveApp.getFileById(itemId).setTrashed(true);
      }
      return responseJSON({ status: 'success', message: "Item berhasil dipindahkan ke Sampah (Trash)." });
    }
    
    if (action === 'share_item') {
      var itemId = data.itemId;
      var itemType = data.itemType;
      var perm = data.permission || 'view'; // 'private', 'view', 'edit'
      
      var access = DriveApp.Access.ANYONE_WITH_LINK;
      var permission = DriveApp.Permission.VIEW;
      var msg = "Akses diubah menjadi: Siapa saja dengan link dapat melihat.";
      
      if (perm === 'private') {
        access = DriveApp.Access.PRIVATE;
        permission = DriveApp.Permission.NONE;
        msg = "Akses diubah menjadi: Privat (Hanya pemilik yang dapat mengakses).";
      } else if (perm === 'edit') {
        access = DriveApp.Access.ANYONE_WITH_LINK;
        permission = DriveApp.Permission.EDIT;
        msg = "Akses diubah menjadi: Siapa saja dengan link dapat mengedit.";
      }
      
      if (itemType === 'folder') {
        var folder = DriveApp.getFolderById(itemId);
        folder.setSharing(access, permission);
      } else {
        var file = DriveApp.getFileById(itemId);
        file.setSharing(access, permission);
      }
      return responseJSON({ status: 'success', message: msg });
    }
    
    if (action === 'unlock_files') {
      var ids = data.ids || [];
      var c = 0;
      for (var i = 0; i < ids.length; i++) {
        try {
          var item = ids[i];
          var itemId = typeof item === 'object' ? item.id : item;
          var itemType = typeof item === 'object' ? item.type : 'file';
          
          if (itemType === 'folder') {
            DriveApp.getFolderById(itemId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } else {
            DriveApp.getFileById(itemId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          }
          c++;
        } catch(e) {}
      }
      return responseJSON({ status: 'success', unlocked: c });
    }
    
    if (action === 'prepare_destination') {
      return responseJSON({ status: 'success', message: "Koneksi teruji. Node siap menerima transfer data." });
    }
    
    return responseJSON({ status: 'error', message: "Tindakan (action) tidak dikenal." });
    
  } catch(err) {
    return responseJSON({ status: 'error', message: err.message });
  }
}

function responseJSON(d) {
  return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON);
}

function getPairingHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pairing Remote Node - G-Drive Ultimate</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <style>
    :root {
      --primary: #00d2ff;
      --accent: #0081ff;
      --bg: #0b091a;
      --card-bg: rgba(255, 255, 255, 0.03);
      --border: rgba(255, 255, 255, 0.08);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 50% 50%, #1f1245 0%, var(--bg) 80%);
      font-family: 'Poppins', sans-serif;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      color: white;
      padding: 20px;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 40px 30px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    h2 { font-weight: 700; font-size: 1.8rem; margin-bottom: 8px; letter-spacing: -0.5px; }
    p { color: #a0a0b0; font-size: 0.9rem; margin-bottom: 30px; line-height: 1.5; }
    .form-group { text-align: left; margin-bottom: 20px; }
    label { display: block; font-size: 0.85rem; color: #00d2ff; margin-bottom: 6px; font-weight: 500; }
    input {
      width: 100%;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(0,0,0,0.3);
      color: white;
      font-size: 0.95rem;
      outline: none;
      transition: border 0.3s;
    }
    input:focus { border-color: var(--primary); }
    .btn {
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: white;
      font-weight: 600;
      cursor: pointer;
      font-size: 1rem;
      transition: transform 0.2s;
      margin-top: 10px;
    }
    .btn:hover { transform: scale(1.02); }
    .email-display { font-size: 0.85rem; color: #888; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="card" id="cardContainer">
    <div style="font-size: 3.5rem; margin-bottom: 15px;">🔌</div>
    <h2>Pairing Remote Node</h2>
    <p>Hubungkan akun Google Drive ini sebagai node penyimpanan/sumber ke aplikasi utama G-Drive Ultimate Anda.</p>
    
    <div class="form-group">
      <label>URL Web App Server Utama (Master)</label>
      <input type="text" id="masterUrl" value="https://script.google.com/macros/s/AKfycbz4RFANjPjkHL6nuMbNBtRUf3cRtQ5vz2DpIUF6mql8z4PMRgFxBKeTWVX_4pQUGENa/exec" placeholder="https://script.google.com/macros/s/.../exec">
    </div>
    
    <div class="form-group">
      <label>Password Server Utama (Master)</label>
      <input type="password" id="masterPassword" value="1" placeholder="Masukkan password server utama">
    </div>
    
    <div class="form-group">
      <label>Label Node Remote Ini</label>
      <input type="text" id="nodeLabel" placeholder="Contoh: Akun Cadangan B">
    </div>
    
    <div class="form-group">
      <label>Token Keamanan Node (Passcode)</label>
      <input type="text" id="nodePasscode" placeholder="Token otomatis di-generate" readonly style="color: #2ed573; font-weight:600; border-color: rgba(46, 213, 115, 0.2);">
    </div>
    
    <button class="btn" onclick="startPairing()">Daftarkan Node (Pair)</button>
    
    <div class="email-display" id="emailDisplay"></div>
  </div>

  <script>
    // Generate secure random passcode on load
    const randPasscode = Math.random().toString(36).substring(2, 10).toUpperCase();
    document.getElementById('nodePasscode').value = randPasscode;
    
    // Auto-fill master URL if present in query param
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('master')) {
      document.getElementById('masterUrl').value = urlParams.get('master');
    }
    
    // Set auto label from email
    google.script.run.withSuccessHandler(info => {
      if (info && info.email) {
        document.getElementById('emailDisplay').textContent = "Terhubung dengan akun: " + info.email;
        const shortEmail = info.email.split('@')[0];
        document.getElementById('nodeLabel').value = "Akun " + shortEmail.toUpperCase();
      }
    }).getInitialInfo();

    function startPairing() {
      const masterUrl = document.getElementById('masterUrl').value.trim();
      const masterPassword = document.getElementById('masterPassword').value.trim();
      const nodeLabel = document.getElementById('nodeLabel').value.trim();
      const nodePasscode = document.getElementById('nodePasscode').value.trim();
      
      if (!masterUrl || !masterPassword || !nodeLabel || !nodePasscode) {
        Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Semua kolom input wajib diisi!' });
        return;
      }
      
      Swal.fire({
        title: 'Menghubungkan Node...',
        text: 'Mengirim informasi registrasi ke server utama...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
      });
      
      google.script.run
        .withSuccessHandler(res => {
          if (res.status === 'success') {
            Swal.fire({
              icon: 'success',
              title: 'Pemasangan Sukses! 🎉',
              html: \`<div style="text-align:left; font-size:0.9rem; color:#ccc;">
                      Node <b>\${nodeLabel}</b> sekarang telah terdaftar secara otomatis di dashboard utama Anda.<br><br>
                      Anda sudah bisa menutup tab browser ini sekarang.
                     </div>\`,
              confirmButtonText: 'Tutup',
              confirmButtonColor: 'var(--accent)'
            }).then(() => {
              // Ganti card UI
              document.getElementById('cardContainer').innerHTML = \`
                <div style="font-size: 4rem; margin-bottom: 20px;">✅</div>
                <h2>Node Terhubung</h2>
                <p style="color:#2ed573;">✔ Hubungan antara akun remote dan server utama sukses dibuat.</p>
                <div style="font-size:0.85rem; color:#888;">Anda sekarang dapat menutup halaman ini.</div>
              \`;
            });
          } else {
            Swal.fire({ icon: 'error', title: 'Gagal Menghubungkan', text: res.message });
          }
        })
        .withFailureHandler(err => {
          Swal.fire({ icon: 'error', title: 'Error internal', text: err.message });
        })
        .registerNodeToMaster(masterUrl, masterPassword, nodeLabel, nodePasscode);
    }
  </script>
</body>
</html>
  `;
}
