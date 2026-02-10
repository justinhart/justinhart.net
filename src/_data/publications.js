const fs = require("fs");
const path = require("path");
const bibtexParse = require("bibtex-parse-js");

function texToUnicode(s) {
  return String(s || "")
    // acute
    .replace(/\{\\'a\}|\\'a/gi, "á")
    .replace(/\{\\'e\}|\\'e/gi, "é")
    .replace(/\{\\'i\}|\\'i/gi, "í")
    .replace(/\{\\'o\}|\\'o/gi, "ó")
    .replace(/\{\\'u\}|\\'u/gi, "ú")
    .replace(/\{\\'A\}|\\'A/g, "Á")
    .replace(/\{\\'E\}|\\'E/g, "É")
    .replace(/\{\\'I\}|\\'I/g, "Í")
    .replace(/\{\\'O\}|\\'O/g, "Ó")
    .replace(/\{\\'U\}|\\'U/g, "Ú")

    // umlaut
    .replace(/\{\\"a\}|\\"a/gi, "ä")
    .replace(/\{\\"e\}|\\"e/gi, "ë")
    .replace(/\{\\"i\}|\\"i/gi, "ï")
    .replace(/\{\\"o\}|\\"o/gi, "ö")
    .replace(/\{\\"u\}|\\"u/gi, "ü")
    .replace(/\{\\"A\}|\\"A/g, "Ä")
    .replace(/\{\\"E\}|\\"E/g, "Ë")
    .replace(/\{\\"I\}|\\"I/g, "Ï")
    .replace(/\{\\"O\}|\\"O/g, "Ö")
    .replace(/\{\\"U\}|\\"U/g, "Ü")

    // tilde
    .replace(/\{\\~n\}|\\~n/gi, "ñ")
    .replace(/\{\\~N\}|\\~N/g, "Ñ")

    // misc
    .replace(/\\&/g, "&")
    .replace(/[{}]/g, "")
    .trim();
}

function monthName(monthNum) {
  return [
    "", "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ][monthNum] || "";
}

function formatDate(p) {
  // Month Day, Year | Month Year | Year
  if (p.month && p.day) return `${p.monthName} ${p.day}, ${p.year}`;
  if (p.month) return `${p.monthName} ${p.year}`;
  return `${p.year}`;
}

function parseMonthName(tags) {
  const raw = texToUnicode(stripBraces(tags.month)).trim();
  if (!raw) return { month: 0, monthName: "" };

  const map = {
    jan: ["January", 1], feb: ["February", 2], mar: ["March", 3],
    apr: ["April", 4], may: ["May", 5], jun: ["June", 6],
    jul: ["July", 7], aug: ["August", 8], sep: ["September", 9],
    oct: ["October", 10], nov: ["November", 11], dec: ["December", 12],
  };

  const key = raw.toLowerCase();
  if (map[key]) return { month: map[key][1], monthName: map[key][0] };

  // handle "December" etc.
  const key3 = key.slice(0, 3);
  if (map[key3]) return { month: map[key3][1], monthName: raw[0].toUpperCase() + raw.slice(1) };

  // handle numeric month
  const n = parseInt(key.replace(/[^\d]/g, ""), 10);
  if (Number.isFinite(n) && n >= 1 && n <= 12) return { month: n, monthName: raw };

  return { month: 0, monthName: raw };
}

function splitEditors(editorField) {
  const s = texToUnicode(stripBraces(editorField));
  if (!s) return [];
  return s.split(/\s+and\s+/i).map(x => x.trim()).filter(Boolean);
}

function parseMonth(tags) {
  const raw = stripBraces(tags.month).trim();
  if (!raw) return 0;

  const m = raw.toLowerCase();

  // BibTeX + common variants
  const map = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };

  if (map[m]) return map[m];

  // Allow numeric months too: "12", "{12}", "02"
  const n = parseInt(m.replace(/[^\d]/g, ""), 10);
  if (Number.isFinite(n) && n >= 1 && n <= 12) return n;

  return 0;
}

function parseDay(tags) {
  const d = stripBraces(tags.day);
  const n = parseInt(d.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}


function stripBraces(s) {
  return String(s || "").replace(/[{}]/g, "").trim();
}

function parseYear(tags) {
  const y = stripBraces(tags.year);
  const n = parseInt(y.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function splitAuthors(authorField) {
  const s = texToUnicode(authorField);
  if (!s) return [];
  return s.split(/\s+and\s+/i).map(x => x.trim()).filter(Boolean);
}

function formatAuthorName(name) {
  // Preserve full names exactly as given in BibTeX
  // Handles both "Last, First Middle" and "First Middle Last"
  if (name.includes(",")) {
    const [last, first] = name.split(",").map(x => x.trim());
    return `${first} ${last}`.trim();
  }
  return name.trim();
}


function formatAuthors(authors) {
  return authors
    .map(formatAuthorName)
    .join(", ");
}

function classifyEntry(entryType, tags) {
  const t = (entryType || "").toLowerCase();
  if (t === "article") return "journal";
  if (t === "inproceedings") return "conference";
  if (t === "incollection") return "chapter";
  if (t === "book") return "book";
  if (t === "inbook") return "inbook";
  if (t === "phdthesis") return "thesis";
  if (t === "misc") {
    const hp = stripBraces(tags.howpublished).toLowerCase();
    if (hp.includes("arxiv")) return "preprint";
    return "misc";
  }
  return t || "other";
}

function citeThesis(p) {
  // Author. "Title." PhD thesis, Institution, Address, Date.
  const bits = [];
  if (p.authorsFmt) bits.push(`${p.authorsFmt}.`);
  bits.push(`“${p.title}.”`);
  bits.push(`PhD thesis,`);
  if (p.school) bits.push(`${p.school},`);
  if (p.address) bits.push(`${p.address},`);
  if (p.dateStr) bits.push(`${p.dateStr}.`);
  else if (p.year) bits.push(`${p.year}.`);
  return bits.join(" ").replace(/\s+,/g, ",");
}

// Very standard-ish (compact) formats
function citeJournal(p) {
  const bits = [];
  bits.push(`${p.authorsFmt}.`);
  bits.push(`“${p.title}.”`);
  if (p.journal) bits.push(p.journal + ",");
  const volno = [p.volume && `vol. ${p.volume}`, p.number && `no. ${p.number}`]
    .filter(Boolean).join(" ");
  if (volno) bits.push(volno + ",");
  if (p.pages) bits.push(`pp. ${p.pages},`);
  bits.push(`${formatDate(p)}.`);
  return bits.join(" ").replace(/\s+,/g, ",").replace(/\s+\./g, ".");
}

function citeConference(p) {
  const bits = [];
  bits.push(`${p.authorsFmt}.`);
  bits.push(`“${p.title}.”`);
  if (p.booktitle) bits.push(`In ${p.booktitle},`);
  if (p.address) bits.push(`${p.address},`);
  bits.push(`${formatDate(p)}.`);
  return bits.join(" ").replace(/\s+,/g, ",").replace(/\s+\./g, ".");
}

function citePreprint(p) {
  const bits = [];
  bits.push(`${p.authorsFmt}.`);
  bits.push(`“${p.title}.”`);
  if (p.arxiv) bits.push(`arXiv:${p.arxiv},`);
  else if (p.howpublished) bits.push(`${p.howpublished},`);
  bits.push(`${formatDate(p)}.`);
  return bits.join(" ").replace(/\s+,/g, ",").replace(/\s+\./g, ".");
}

function citeBook(p) {
  // Authors/Editors. Title. Publisher, Address, Date.
  const bits = [];
  const who = p.authorsFmt || (p.editorsFmt ? `${p.editorsFmt} (ed.)` : "");
  if (who) bits.push(`${who}.`);
  bits.push(`“${p.title}.”`);
  if (p.publisher) bits.push(`${p.publisher},`);
  if (p.address) bits.push(`${p.address},`);
  if (p.dateStr) bits.push(`${p.dateStr}.`);
  else if (p.year) bits.push(`${p.year}.`);
  return bits.join(" ").replace(/\s+,/g, ",");
}

function citeChapter(p) {
  // Authors. "Chapter Title." In Book Title, edited by Editors, Publisher, Address, Date, pp. X–Y.
  const bits = [];
  if (p.authorsFmt) bits.push(`${p.authorsFmt}.`);
  bits.push(`“${p.title}.”`);
  if (p.booktitle) bits.push(`In ${p.booktitle},`);
  if (p.editorsFmt) bits.push(`edited by ${p.editorsFmt},`);
  if (p.publisher) bits.push(`${p.publisher},`);
  if (p.address) bits.push(`${p.address},`);
  if (p.pages) bits.push(`pp. ${p.pages},`);
  if (p.dateStr) bits.push(`${p.dateStr}.`);
  else if (p.year) bits.push(`${p.year}.`);
  return bits.join(" ").replace(/\s+,/g, ",");
}


function citeGeneric(p) {
  const bits = [];
  bits.push(`${p.authorsFmt}.`);
  bits.push(`“${p.title}.”`);
  if (p.venue) bits.push(`${p.venue},`);
  bits.push(`${formatDate(p)}.`);
  return bits.join(" ").replace(/\s+,/g, ",").replace(/\s+\./g, ".");
}

module.exports = () => {
  const bibPath = path.join(__dirname, "publications.bib");

  if (!fs.existsSync(bibPath)) {
    return { error: `Missing publications.bib at: ${bibPath}`, byYear: {} };
  }
  const raw = fs.readFileSync(bibPath, "utf8");
  if (!raw.trim()) {
    return { error: `publications.bib is empty: ${bibPath}`, byYear: {} };
  }

  let parsed;
  try {
    parsed = bibtexParse.toJSON(raw);
  } catch (e) {
    return { error: `BibTeX parse failed: ${e?.message || e}`, byYear: {} };
  }

  const items = (parsed || [])
    .map(e => {
      const tags = e.entryTags || {};
      const type = classifyEntry(e.entryType, tags);


      const title = texToUnicode(tags.title);
      const journal = texToUnicode(tags.journal);
      const booktitle = texToUnicode(tags.booktitle);
      const howpublished = texToUnicode(tags.howpublished);
      const address = texToUnicode(tags.address);
      const authors = splitAuthors(tags.author); // already uses texToUnicode
      const authorsFmt = formatAuthors(authors);

      const school = texToUnicode(stripBraces(tags.school));

      const year = parseYear(tags);
      const { month, monthName } = parseMonthName(tags);
      const day = parseDay(tags);

      const publisher = texToUnicode(stripBraces(tags.publisher));

      const editors = splitEditors(tags.editor);
      const editorsFmt = formatAuthors(editors);

      const volume = stripBraces(tags.volume);
      const number = stripBraces(tags.number);
      const pages = stripBraces(tags.pages);

      const doi = stripBraces(tags.doi);
      const url = stripBraces(tags.url);

      // arXiv: try to extract id from howpublished if present
      let arxiv = stripBraces(tags.eprint || tags.arxiv);
      if (!arxiv && howpublished.toLowerCase().includes("arxiv")) {
        const m = howpublished.match(/arxiv[:\s]*([0-9]{4}\.[0-9]{4,5})/i);
        if (m) arxiv = m[1];
      }

      const venue = journal || booktitle || howpublished;

      const p = {
        key: e.citationKey,
        entryType: e.entryType,
        type,
        title,
        authors,
        authorsFmt,
        year,
        month,
        monthName,
        day,
        publisher,
        editors,
        editorsFmt,
        journal,
        booktitle,
        howpublished,
        school,
        venue,
        volume,
        number,
        pages,
        address,
        doi,
        url,
        arxiv,
        bibtex: bibtexParse.toBibtex([e]).trim(),
      };


      p.dateStr = (p.year ? formatDate(p) : "");

      if (!p.title) return null;

      if (type === "journal") p.citation = citeJournal(p);
      else if (type === "conference") p.citation = citeConference(p);
      else if (type === "preprint") p.citation = citePreprint(p);
      else if (type === "book") p.citation = citeBook(p);
      else if (type === "chapter" || type === "inbook") p.citation = citeChapter(p);
      else if (type === "thesis") p.citation = citeThesis(p);
      else p.citation = citeGeneric(p);

      return p;
    })
    .filter(Boolean);

  // group by year
  const byYear = new Map();
  for (const p of items) {
    const y = p.year || 0;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(p);
  }

  // sort years DESC, and items within year DESC by (year, month, day)
  const years = Array.from(byYear.entries())
    .sort(([a], [b]) => b - a) // years DESC
    .map(([year, list]) => {
      list.sort((a, b) => {
        const aDate = (a.year * 10000) + (a.month * 100) + a.day;
        const bDate = (b.year * 10000) + (b.month * 100) + b.day;
        if (bDate !== aDate) return bDate - aDate; // newest first
        return b.title.localeCompare(a.title);
      });
      return { year, items: list };
    });

  // after you build `years` (array of { year, items: [...] })
  const all = years.flatMap(y => y.items || []).filter(Boolean);

  return {
    years,
    all,
  };
  // return { error: null, years };

};
