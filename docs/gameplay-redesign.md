# Playground kendaraan untuk Zee

Status: desain 2D sebelumnya. [ADR 0003](adr/0003-render-depot-tenang-in-3d.md) menjelaskan Game 3D sekarang. Target Zee sekitar dua tahun, dikonfirmasi pengguna.

## Perubahan

Gameplay sekarang berpusat pada benda yang disentuh. Tiga tombol bergambar memilih tempat bermain. Kendaraan tampil besar; hanya mainan dan permukaan untuk kegiatan aktif yang terlihat. Latar diam dan sederhana. Perjalanan rutin berlangsung otomatis setelah pemain menyentuh tujuannya.

| Aktivitas | Sentuhan pemain | Hasil yang terlihat |
| --- | --- | --- |
| Batu & kereta | Sentuh batu, tempat bongkar, lalu bak | Batu masuk truk; rel kosong membuat kereta lewat; bak menjatuhkan batu dan menumbangkan balok |
| Bangun jembatan | Sentuh tiga cetakan | Molen mendekat dan menuang; truk kargo melintasi jembatan yang selesai |
| Cuci pesawat | Sentuh atau usap lumpur | Truk air menyemprot, lumpur hilang, pesawat bersih terbang |

Kotak persediaan mengulang kegiatan. Pilihan kegiatan tetap tersedia tanpa urutan wajib, skor, atau batas waktu. Keadaan jembatan, batu, dan pesawat tersimpan selama berpindah kegiatan.

## Input dan respons

Sentuhan singkat cukup untuk setiap kegiatan. Pemain juga dapat menyeret bak ke atas untuk mengatur pelepasan batu dan menyeret batu yang sudah jatuh kembali ke truk. Space atau Enter menjalankan aksi berikutnya pada kegiatan aktif. Tombol aksi yang setara tersedia saat menerima fokus keyboard.

Satu lingkaran diam menunjukkan benda berikutnya yang dapat dimainkan. Kegiatan lain tersembunyi dan berhenti. Kereta serta truk jembatan lewat sekali setelah berhasil. Molen berputar hanya saat menuang; baling-baling bergerak saat pesawat lepas landas. Status singkat menyediakan petunjuk tambahan dan umpan balik untuk pembaca layar. Suara lembut mengikuti interaksi dan hasil kegiatan. Companion Gate menghentikan gerakan dan fisika; Continue melanjutkan keadaan yang sama.

Badan truk mengayun saat bergerak atau menerima batu; roda tetap menyentuh jalan. Air dan semen memiliki aliran tersambung dengan percikan di titik benturan. Lumpur luruh setelah dicuci. Kilau singkat menandai cetakan selesai dan pesawat bersih. Pesawat berakselerasi, sedikit menukik naik, dan bayangannya mengecil saat meninggalkan tanah. Efek berhenti setelah aksi selesai, dibersihkan saat berpindah kegiatan, dan mengikuti pause. Reduced Motion meniadakan ayunan suspensi, partikel terbang, dan kemiringan pesawat.

## Batas simulasi

Batu dan balok memakai gravitasi serta tabrakan Matter. Gerbong memakai sambungan fisik pada titik kopling model. Kendaraan, batu, balok, cetakan beton, air, lumpur, karung semen, ember, dan selang memakai sprite dari model Blender. Titik corong dan nosel diekspor bersama model agar aliran menempel pada sumbernya. Jalan, rel, dan petunjuk digambar langsung.

Pemuatan batu memakai gerakan melengkung dengan bantuan. Beton dan air berupa ilustrasi animasi; penerbangan mengikuti lintasan sederhana. Ini mekanisme mainan 2.5D.

## Evaluasi bersama Zee

Tes browser memeriksa respons sentuhan, hubungan sebab-akibat, pengulangan, pause, dan tata letak. Ketertarikan Zee perlu diamati saat bermain: benda yang pertama disentuh, kegiatan yang diulang, dan bagian yang masih memerlukan penjelasan Companion.
