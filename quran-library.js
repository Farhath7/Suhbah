// Surah starts verified against the Janathi Message Juz PDFs, not Madani page numbers.
// Pages are 1-based PDF positions (which differ from the printed page numbers).
const QuranLibrary = (() => {
  const names = [
    'Al-Fatihah', 'Al-Baqarah', 'Ali Imran', 'An-Nisa', 'Al-Maidah', 'Al-Anam',
    'Al-Araf', 'Al-Anfal', 'At-Tawbah', 'Yunus', 'Hud', 'Yusuf', 'Ar-Rad',
    'Ibrahim', 'Al-Hijr', 'An-Nahl', 'Al-Isra', 'Al-Kahf', 'Maryam', 'Ta-Ha',
    'Al-Anbiya', 'Al-Hajj', 'Al-Muminun', 'An-Nur', 'Al-Furqan', 'Ash-Shuara',
    'An-Naml', 'Al-Qasas', 'Al-Ankabut', 'Ar-Rum', 'Luqman', 'As-Sajdah',
    'Al-Ahzab', 'Saba', 'Fatir', 'Ya-Sin', 'As-Saffat', 'Sad', 'Az-Zumar',
    'Ghafir', 'Fussilat', 'Ash-Shura', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jathiyah',
    'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat', 'Qaf', 'Adh-Dhariyat',
    'At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman', 'Al-Waqiah', 'Al-Hadid',
    'Al-Mujadilah', 'Al-Hashr', 'Al-Mumtahanah', 'As-Saff', 'Al-Jumuah',
    'Al-Munafiqun', 'At-Taghabun', 'At-Talaq', 'At-Tahrim', 'Al-Mulk',
    'Al-Qalam', 'Al-Haqqah', 'Al-Maarij', 'Nuh', 'Al-Jinn', 'Al-Muzzammil',
    'Al-Muddaththir', 'Al-Qiyamah', 'Al-Insan', 'Al-Mursalat', 'An-Naba',
    'An-Naziat', 'Abasa', 'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin',
    'Al-Inshiqaq', 'Al-Buruj', 'At-Tariq', 'Al-Ala', 'Al-Ghashiyah', 'Al-Fajr',
    'Al-Balad', 'Ash-Shams', 'Al-Layl', 'Ad-Duha', 'Ash-Sharh', 'At-Tin',
    'Al-Alaq', 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', 'Al-Adiyat',
    'Al-Qariah', 'At-Takathur', 'Al-Asr', 'Al-Humazah', 'Al-Fil', 'Quraysh',
    'Al-Maun', 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr', 'Al-Masad', 'Al-Ikhlas',
    'Al-Falaq', 'An-Nas',
  ];
  // Each row lists [surah number, starting PDF page] for a Juz.
  // Al-Hijr's first ayah is at the end of para13.pdf in this edition.
  const starts = [
    [[1, 1], [2, 2]], [], [[3, 12]], [[4, 22]], [], [[5, 7]], [[6, 9]],
    [[7, 13]], [[8, 22]], [[9, 8]], [[10, 8], [11, 28]], [[12, 20]],
    [[13, 10], [14, 19], [15, 28]], [[16, 8]], [[17, 1], [18, 16]],
    [[19, 5], [20, 15]], [[21, 1], [22, 14]], [[23, 1], [24, 11], [25, 25]],
    [[26, 7], [27, 21]], [[28, 5], [29, 20]],
    [[30, 4], [31, 13], [32, 19], [33, 23]], [[34, 9], [35, 17], [36, 25]],
    [[37, 6], [38, 16], [39, 23]], [[40, 7], [41, 19]],
    [[42, 2], [43, 11], [44, 20], [45, 25]],
    [[46, 1], [47, 8], [48, 14], [49, 20], [50, 25], [51, 29]],
    [[52, 3], [53, 6], [54, 10], [55, 14], [56, 19], [57, 24]],
    [[58, 1], [59, 5], [60, 10], [61, 14], [62, 17], [63, 19], [64, 21], [65, 24], [66, 27]],
    [[67, 1], [68, 4], [69, 8], [70, 11], [71, 14], [72, 17], [73, 20], [74, 22], [75, 25], [76, 27], [77, 30]],
    [[78, 1], [79, 2], [80, 4], [81, 6], [82, 7], [83, 8], [84, 10],
      [85, 11], [86, 12], [87, 13], [88, 14], [89, 15], [90, 17], [91, 18],
      [92, 19], [93, 20], [94, 20], [95, 21], [96, 21], [97, 22], [98, 22],
      [99, 23], [100, 24], [101, 25], [102, 25], [103, 26], [104, 26],
      [105, 26], [106, 27], [107, 27], [108, 28], [109, 28], [110, 28],
      [111, 29], [112, 29], [113, 29], [114, 30]],
  ];
  const ranges = [
    [1, 2], [2, 2], [2, 3], [3, 4], [4, 4], [4, 5], [5, 6], [6, 7],
    [7, 8], [8, 9], [9, 11], [11, 12], [12, 15], [15, 16], [17, 18],
    [18, 20], [21, 22], [23, 25], [25, 27], [27, 29], [29, 33], [33, 36],
    [36, 39], [39, 41], [41, 45], [46, 51], [51, 57], [58, 66], [67, 77], [78, 114],
  ];
  const surahs = names.map((name, index) => ({ number: index + 1, name }));
  starts.forEach((entries, index) => entries.forEach(([number, page]) => {
    Object.assign(surahs[number - 1], { juz: index + 1, page });
  }));
  return {
    surahs,
    juz: ranges.map(([first, last], index) => ({
      number: index + 1,
      surahs: surahs.slice(first - 1, last),
    })),
    pdfUrl: (juz, page = 1) => `http://www.janathimessage.co.uk/quran/para${juz}.pdf#page=${page}`,
  };
})();
