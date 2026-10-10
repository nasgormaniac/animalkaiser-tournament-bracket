# Animal Kaiser Tournament

Aplikasi turnamen knockout 48 peserta berbasis HTML, CSS, dan JavaScript biasa. Tidak perlu Electron, Node, npm, server, atau proses build untuk menjalankannya.

## Menjalankan

Buka `index.html` di browser untuk melihat tampilan. Untuk penggunaan tetap dan penyimpanan browser yang konsisten, terbitkan berkas statis ini di GitHub Pages.

## Fitur

- Buat dan buka beberapa turnamen dari layar awal.
- Masukkan tepat 48 nama peserta, satu nama per baris. Posisi diundi otomatis. Sebanyak 32 peserta memainkan 16 laga pembuka, sedangkan 16 peserta mendapat *bye* ke 32 besar. Ini sistem gugur tunggal, tanpa fase grup.
- Klik pertandingan yang siap dimainkan untuk memilih pemenang. Mengubah hasil sebelumnya akan membatalkan hasil turunan yang perlu dimainkan ulang.
- Progres tersimpan otomatis di `localStorage` browser pada perangkat dan alamat situs yang sama.
- **Ekspor JSON** membuat berkas cadangan; **Impor JSON** menambah turnamen dari berkas itu ke daftar.
- **Hapus** pada kartu turnamen menghapus data lokal setelah konfirmasi. Data yang dihapus hanya dapat dipulihkan dari JSON yang sebelumnya diekspor.

**Penting:** GitHub Pages hanya menyajikan situs statis. Data turnamen tidak tersinkron antarperangkat atau antarbrowser. Menghapus data situs/browser juga menghapus progres lokal, jadi ekspor JSON secara berkala untuk cadangan.

## Publikasi di GitHub Pages

1. Unggah isi proyek ke repository GitHub. Folder `v23.7.0`, `node_modules`, dan cache dikecualikan melalui `.gitignore`.
2. Di repository, buka **Settings → Pages**.
3. Pada **Build and deployment**, pilih **Deploy from a branch**, lalu pilih branch `main` dan folder `/(root)`.
4. Simpan pengaturan. `index.html` di root akan menjadi halaman utama.

Semua referensi aset bersifat relatif, sehingga situs bekerja di URL repository seperti `https://username.github.io/nama-repository/`. Lihat [panduan resmi GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) untuk pengaturan sumber publikasi.

## Membersihkan sisa proyek Electron

Folder berikut di root boleh dihapus manual seluruhnya karena tidak diperlukan oleh situs statis: `node_modules/`, `.npm-cache/`, `.electron-cache/`, `electron/`, `scripts/`, `tests/`, dan `v23.7.0/`. Folder `v23.7.0/` adalah Node portable yang Anda tambahkan; simpan hanya jika dipakai proyek lain. Berkas `intention.txt` juga opsional dan dapat dihapus jika tidak ingin menyertakannya di repository. Pertahankan `index.html`, `styles.css`, `app.js`, `trophy.png`, dan `.nojekyll`.
