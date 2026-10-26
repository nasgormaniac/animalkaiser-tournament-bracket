# Animal Kaiser Tournament

Aplikasi turnamen knockout 32, 48, atau 64 peserta berbasis HTML, CSS, dan JavaScript biasa. Tidak perlu Electron, Node, npm, server, atau proses build untuk menjalankannya.

## Menjalankan

Buka `index.html` di browser untuk melihat tampilan. Untuk penggunaan tetap dan penyimpanan browser yang konsisten, terbitkan berkas statis ini di GitHub Pages.

## Fitur

- Buat dan buka beberapa turnamen dari layar awal.
- Pilih 32, 48, atau 64 peserta, lalu masukkan satu nama per baris. Posisi diundi otomatis. Untuk 48 peserta, sebanyak 32 peserta memainkan 16 laga pembuka dan 16 peserta mendapat *bye* ke 32 besar. Semua format memakai sistem gugur tunggal tanpa fase grup.
- Klik pertandingan yang siap dimainkan untuk memilih pemenang. Mengubah hasil sebelumnya akan membatalkan hasil turunan yang perlu dimainkan ulang.
- Progres tersimpan otomatis di `localStorage` browser pada perangkat dan alamat situs yang sama.
- **Ekspor JSON** membuat berkas cadangan; **Impor JSON** menambah turnamen dari berkas itu ke daftar.
- **Hapus** pada kartu turnamen menghapus data lokal setelah konfirmasi. Data yang dihapus hanya dapat dipulihkan dari JSON yang sebelumnya diekspor.
