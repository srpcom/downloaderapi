// =========================================================================
// G-DRIVE ULTIMATE - REMOTE NODE SERVER CODE
// =========================================================================
// Deploy script ini sebagai Web App (Layanan Web) pada Akun Google Anda yang lain.
// 
// Panduan Deployment:
// 1. Buka https://script.google.com/
// 2. Buat Project Baru.
// 3. Hapus kode bawaan, lalu paste seluruh kode ini.
// 4. Sesuaikan variabel SECRET_TOKEN di bawah ini dengan kata sandi pilihan Anda.
// 5. Klik "Deploy" -> "New deployment".
// 6. Pilih tipe: "Web app".
// 7. Konfigurasi Web App:
//    - Execute as: Me (Email akun remote Anda)
//    - Who has access: Anyone (Siapa saja)
// 8. Klik "Deploy", berikan izin akses (Authorize), lalu salin "Web app URL" 
//    untuk dimasukkan ke dashboard utama G-Drive Ultimate pada tab "Remote Nodes".
// =========================================================================

var SECRET_TOKEN = "123456"; // UBAH INI: Token keamanan rahasia pilihan Anda

function doPost(e) {
  try {
    if (!e || !e.postData) return responseJSON({ status: 'error', message: "Permintaan tidak valid." });
    var data = JSON.parse(e.postData.contents);
    
    // Validasi Token Keamanan
    if (String(data.token) !== String(SECRET_TOKEN)) {
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
      if (itemType === 'folder') {
        var folder = DriveApp.getFolderById(itemId);
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } else {
        var file = DriveApp.getFileById(itemId);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
      return responseJSON({ status: 'success', message: "Akses berhasil dibuka. Siapa saja dengan link dapat melihat/menyalin." });
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
