# Project Rules - G-Drive Downloader API

- **Deployment Otomatis**: Setiap kali melakukan perubahan kode (edit berkas, penambahan fitur, perbaikan bug):
  1. Agen wajib langsung menjalankan `clasp push` untuk melakukan deployment kode ke Google Apps Script.
  2. Untuk perubahan pada `script.js` (Google Apps Script backend), file tersebut **TIDAK BOLEH** di-push ke GitHub.
  3. Untuk perubahan pada berkas lain (seperti `index.html`, `remote_node.gs`, dll.), agen wajib menjalankan `git commit` & `git push` untuk menyinkronkan ke repositori GitHub.
